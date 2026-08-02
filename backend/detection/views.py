from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Camera, Alert, Notification
from .serializers import CameraSerializer, AlertSerializer, NotificationSerializer
from school.models import Student
import cv2

# Fix for OpenCV thread contention crashes in multi-threaded environment
cv2.setNumThreads(1)
cv2.ocl.setUseOpenCL(False)

import time
import json
import uuid
import numpy as np
import os
from django.http import StreamingHttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.core.files.base import ContentFile
from ultralytics import YOLO
import logging
import threading

logger = logging.getLogger(__name__)

# --- YOLO Model ---
yolo_lock = threading.Lock()
try:
    yolo_model = YOLO('yolov8n.pt')
except Exception as e:
    logger.error(f"Error loading YOLO model: {e}")
    yolo_model = None

# --- Alert throttling ---
last_alert_time = {}

# --- Face recognition data (loaded lazily) ---
known_faces = {}  # {student_id: {'name': str, 'encoding': np.array}}
known_faces_loaded_at = 0


def load_known_faces():
    """Load face encodings from database."""
    global known_faces, known_faces_loaded_at
    try:
        students = Student.objects.filter(
            face_encoding__isnull=False,
            photo__isnull=False
        ).exclude(face_encoding='')
        
        new_faces = {}
        for student in students:
            try:
                encoding = json.loads(student.face_encoding)
                face_array = np.array(encoding, dtype=np.uint8).reshape(100, 100)
                new_faces[student.id] = {
                    'name': student.name,
                    'encoding': face_array,
                }
                logger.debug(f"Loaded face encoding for student: {student.name} (id={student.id})")
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Invalid face encoding for student {student.name}: {e}")
        
        known_faces = new_faces
        known_faces_loaded_at = time.time()
        logger.info(f"Loaded {len(known_faces)} face encodings from database")
    except Exception as e:
        logger.error(f"Error loading known faces: {e}")


def match_face(face_gray):
    """Try to match a detected face against known student faces.
    Returns (student_id, student_name, confidence) or (None, None, 0).
    Uses both histogram correlation and template matching for robust results.
    """
    if not known_faces:
        logger.debug("match_face: No known faces loaded.")
        return None, None, 0
    
    face_resized = cv2.resize(face_gray, (100, 100))
    # Normalize brightness/contrast for better matching
    face_resized = cv2.equalizeHist(face_resized)
    
    best_match_id = None
    best_match_name = None
    best_score = -1  # Higher is better for correlation
    
    for student_id, data in known_faces.items():
        known_face = data['encoding']
        # Also equalize the known face for fair comparison
        known_equalized = cv2.equalizeHist(known_face)
        
        # Method 1: Histogram correlation (lighting-invariant)
        hist_input = cv2.calcHist([face_resized], [0], None, [256], [0, 256])
        hist_known = cv2.calcHist([known_equalized], [0], None, [256], [0, 256])
        cv2.normalize(hist_input, hist_input)
        cv2.normalize(hist_known, hist_known)
        hist_score = cv2.compareHist(hist_input, hist_known, cv2.HISTCMP_CORREL)
        
        # Method 2: Template matching (structural similarity)
        result = cv2.matchTemplate(face_resized, known_equalized, cv2.TM_CCOEFF_NORMED)
        template_score = float(result[0][0])
        
        # Combined score (weighted average)
        combined_score = (hist_score * 0.4) + (template_score * 0.6)
        
        logger.debug(f"match_face: student={data['name']} hist={hist_score:.3f} template={template_score:.3f} combined={combined_score:.3f}")
        
        if combined_score > best_score:
            best_score = combined_score
            best_match_id = student_id
            best_match_name = data['name']
    
    # Threshold for match (higher = more similar, max 1.0)
    if best_score > 0.35:
        confidence = min(100, max(0, best_score * 100))
        logger.info(f"match_face: MATCHED {best_match_name} with score={best_score:.3f} confidence={confidence:.0f}%")
        return best_match_id, best_match_name, confidence
    
    logger.debug(f"match_face: No match found. Best score was {best_score:.3f} for {best_match_name}")
    return None, None, 0


def save_snapshot(frame, prefix='snapshot'):
    """Save a frame as a snapshot image and return the file path."""
    try:
        snapshots_dir = os.path.join(settings.MEDIA_ROOT, 'snapshots')
        os.makedirs(snapshots_dir, exist_ok=True)
        
        # --- Security: Use UUID for unpredictable filenames ---
        filename = f"{prefix}_{uuid.uuid4().hex}.jpg"
        filepath = os.path.join(snapshots_dir, filename)
        
        cv2.imwrite(filepath, frame)
        return f"snapshots/{filename}"
    except Exception as e:
        logger.error(f"Error saving snapshot: {e}")
        return None


class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer
    permission_classes = [IsAuthenticated]


from rest_framework.decorators import action, api_view, permission_classes as perm_classes
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from school.models import Schedule, Student, Staff
from django.contrib.auth import get_user_model

User = get_user_model()

from twilio.rest import Client

class AlertViewSet(viewsets.ModelViewSet):
    # order by newest first
    queryset = Alert.objects.all().order_by('-created_at')
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    
    def _send_twilio_alert(self, to_number, message, channel='whatsapp', media_url=None):
        try:
            account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
            auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
            from_number = getattr(settings, 'TWILIO_WHATSAPP_NUMBER' if channel == 'whatsapp' else 'TWILIO_PHONE_NUMBER', '')
            
            if not account_sid or not auth_token or not from_number:
                logger.error("Twilio credentials not fully configured in settings.")
                return False
                
            # Ensure number has country code for Twilio
            if not to_number.startswith('+'):
                if len(to_number) == 10:
                    to_number = '+91' + to_number
                else:
                    to_number = '+' + to_number
                
            client = Client(account_sid, auth_token)
            
            kwargs = {
                'body': message,
                'from_': f'whatsapp:{from_number}' if channel == 'whatsapp' and not from_number.startswith('whatsapp:') else from_number,
                'to': f'whatsapp:{to_number}' if channel == 'whatsapp' else to_number
            }
            if media_url:
                kwargs['media_url'] = [media_url]

            try:
                msg = client.messages.create(**kwargs)
                logger.info(f"Twilio message sent successfully: {msg.sid}")
                return True
            except Exception as e:
                if 'Invalid media URL' in str(e) and media_url:
                    logger.warning(f"Twilio rejected media_url (usually localhost). Falling back to text.")
                    del kwargs['media_url']
                    kwargs['body'] += f"\n\n(Note: Twilio cannot attach local images.)"
                    msg = client.messages.create(**kwargs)
                    logger.info(f"Twilio message sent successfully on fallback: {msg.sid}")
                    return True
                else:
                    raise e
        except Exception as e:
            # --- Security: Log full error server-side, don't expose to client ---
            logger.error(f"Failed to send Twilio message: {e}")
            return False

    @action(detail=True, methods=['post'])
    def forward(self, request, pk=None):
        alert = self.get_object()
        staff_id = request.data.get('staff_id')
        channel = request.data.get('channel', 'whatsapp')
        
        # Build snapshot URL if available
        snapshot_url = ""
        if alert.snapshot:
            snapshot_url = request.build_absolute_uri(alert.snapshot.url)
        
        if staff_id:
            try:
                staff = Staff.objects.get(id=staff_id)
                logger.info(f"Forwarded alert {alert.id} to staff {staff.name} via {channel}")
                
                msg_body = f"ClassGuard Alert: {alert.description} at {alert.created_at.strftime('%H:%M:%S')}"
                if alert.student:
                    msg_body += f"\nStudent: {alert.student.name} (Grade {alert.student.grade}-{alert.student.section}, Roll: {alert.student.roll_number})"
                    
                if staff.phone_number:
                    self._send_twilio_alert(staff.phone_number, msg_body, channel, media_url=snapshot_url if snapshot_url else None)
                return Response({"message": f"Alert forwarded to {staff.name} via {channel}"}, status=status.HTTP_200_OK)
            except Staff.DoesNotExist:
                return Response({"error": "Staff not found"}, status=status.HTTP_404_NOT_FOUND)
                
        # Smart routing to current teacher
        if not alert.student:
            return Response({"error": "No student associated with this alert for smart routing."}, status=status.HTTP_400_BAD_REQUEST)
            
        student = alert.student
        
        # Find schedule for this grade/section right now
        now = timezone.localtime()
        current_time = now.time()
        day_of_week = now.weekday()
        
        schedule = Schedule.objects.filter(
            grade=student.grade,
            section=student.section,
            day_of_week=day_of_week,
            period_start__lte=current_time,
            period_end__gte=current_time
        ).first()
        
        if not schedule:
            return Response({"error": f"No active class schedule found for {student.grade}-{student.section} right now."}, status=status.HTTP_404_NOT_FOUND)
            
        teacher = schedule.teacher
        logger.info(f"Smart Routed alert {alert.id} for {student.name} to {teacher.username} ({schedule.subject})")
        
        msg_body = f"ClassGuard Smart Alert: {student.name} (Grade {student.grade}-{student.section}, Roll: {student.roll_number}) was detected out of class during your {schedule.subject} period."
            
        if teacher.phone:
            self._send_twilio_alert(teacher.phone, msg_body, channel, media_url=snapshot_url if snapshot_url else None)
            
        return Response({
            "message": f"Alert smart-routed to current teacher {teacher.username} ({schedule.subject})",
            "teacher": teacher.username,
            "subject": schedule.subject
        }, status=status.HTTP_200_OK)


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]


class CameraReader:
    _instances = {}
    
    @classmethod
    def get_instance(cls, rtsp_url):
        if rtsp_url not in cls._instances or not cls._instances[rtsp_url].running:
            cls._instances[rtsp_url] = cls(rtsp_url)
        return cls._instances[rtsp_url]

    @classmethod
    def remove_instance(cls, rtsp_url):
        """Stop and remove a camera reader instance."""
        if rtsp_url in cls._instances:
            cls._instances[rtsp_url].running = False
            del cls._instances[rtsp_url]
        
    def __init__(self, rtsp_url):
        self.rtsp_url = rtsp_url
        self.frame = None
        self.running = True
        self.status = 'connecting'  # connecting, connected, error
        self.error_message = ''
        self.retry_count = 0
        self.max_retries = 10
        self.thread = threading.Thread(target=self._update)
        self.thread.daemon = True
        self.thread.start()
        
    def _update(self):
        url = int(self.rtsp_url) if self.rtsp_url.isdigit() else self.rtsp_url
        
        def get_cap():
            if isinstance(url, int):
                # Try DirectShow first on Windows (more reliable for USB cams)
                c = cv2.VideoCapture(url, cv2.CAP_DSHOW)
                if c.isOpened():
                    for _ in range(5): c.read()
                    ret, f = c.read()
                    if ret and f is not None:
                        return c
                    c.release()
                
                # Fallback to default backend (MSMF)
                c = cv2.VideoCapture(url)
                if c.isOpened():
                    for _ in range(5): c.read()
                    ret, f = c.read()
                    if ret and f is not None:
                        return c
                    c.release()
                
                return None
            else:
                c = cv2.VideoCapture(url)
                if c.isOpened():
                    return c
                c.release()
                return None
            
        cap = get_cap()

        if cap is None:
            self.retry_count += 1
            logger.warning(f"CameraReader({self.rtsp_url}): initial open failed (attempt {self.retry_count})")
        else:
            self.status = 'connected'
            self.retry_count = 0
            logger.info(f"CameraReader({self.rtsp_url}): connected successfully")
            
        while self.running:
            if cap is None:
                if self.retry_count >= self.max_retries:
                    self.status = 'error'
                    self.error_message = f'Camera index {self.rtsp_url} unavailable after {self.max_retries} attempts'
                    logger.error(f"CameraReader({self.rtsp_url}): giving up after {self.max_retries} retries")
                    return  # Stop the thread
                
                time.sleep(2)
                self.retry_count += 1
                self.status = 'connecting'
                logger.debug(f"CameraReader({self.rtsp_url}): retry {self.retry_count}/{self.max_retries}")
                cap = get_cap()
                if cap is not None:
                    self.status = 'connected'
                    self.retry_count = 0
                    logger.info(f"CameraReader({self.rtsp_url}): reconnected on retry {self.retry_count}")
                continue
                
            success, frame = cap.read()
            if success:
                self.frame = frame.copy()
                self.status = 'connected'
            else:
                # Camera disconnected or not ready, try reopening
                cap.release()
                cap = None
                self.retry_count += 1
                logger.warning(f"CameraReader({self.rtsp_url}): read failed, will retry")



# --- Motion detection state per camera ---
import threading
bg_subtractors = {}
_bg_lock = threading.Lock()


def gen_frames(camera):
    global known_faces_loaded_at
    
    reader = CameraReader.get_instance(camera.rtsp_url)
    frame_count = 0
    wait_count = 0
    max_wait = 100  # max 10 seconds of waiting (100 * 0.1s)

    # Initialize background subtractor for this camera (thread-safe)
    with _bg_lock:
        if camera.id not in bg_subtractors:
            bg_subtractors[camera.id] = cv2.createBackgroundSubtractorMOG2(
                history=500, varThreshold=50, detectShadows=True
            )
        bg_sub = bg_subtractors[camera.id]

    # Load known faces on start (and reload every 60 seconds)
    load_known_faces()

    def make_error_frame(text, color=(0, 0, 255)):
        """Create a black frame with centered error text."""
        error_frame = np.zeros((360, 640, 3), dtype=np.uint8)
        # Draw the text centered
        font = cv2.FONT_HERSHEY_SIMPLEX
        scale = 0.7
        thickness = 2
        (tw, th), _ = cv2.getTextSize(text, font, scale, thickness)
        x = (640 - tw) // 2
        y = (360 + th) // 2
        cv2.putText(error_frame, text, (x, y), font, scale, color, thickness)
        # Also show camera name
        cv2.putText(error_frame, camera.name, (10, 30), font, 0.6, (150, 150, 150), 1)
        return error_frame

    while True:
        # Check if reader has permanently failed
        if reader.status == 'error':
            error_frame = make_error_frame(f"Camera Unavailable: {camera.rtsp_url}")
            ret, buffer = cv2.imencode('.jpg', error_frame)
            if ret:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            return  # Stop the generator

        frame = reader.frame
        if frame is None:
            wait_count += 1
            if wait_count > max_wait:
                # Timed out waiting for first frame
                error_frame = make_error_frame("No signal - check camera connection")
                ret, buffer = cv2.imencode('.jpg', error_frame)
                if ret:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
                return
            
            # Show connecting frame every ~2 seconds while waiting
            if wait_count % 20 == 1:
                connecting_frame = make_error_frame("Connecting...", color=(0, 200, 255))
                ret, buffer = cv2.imencode('.jpg', connecting_frame)
                if ret:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            time.sleep(0.1)
            continue
            
        frame = frame.copy()
        frame_count += 1
        
        # Reload known faces every 60 seconds
        if time.time() - known_faces_loaded_at > 60:
            load_known_faces()
        
        # Run detection every 10 frames
        if frame_count % 10 == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            current_time = time.time()

            # === MOTION DETECTION ===
            fg_mask = bg_sub.apply(frame)
            # Remove shadows (value 127) and noise
            _, fg_mask = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
            fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
            
            contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            motion_detected = False
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > 5000:  # Significant motion
                    motion_detected = True
                    x, y, w, h = cv2.boundingRect(contour)
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 255), 2)
                    cv2.putText(frame, "Motion", (x, y - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            
            # Create motion alert (max 1 per 30 seconds)
            motion_key = f"motion_{camera.id}"
            last_motion = last_alert_time.get(motion_key, 0)
            if motion_detected and (current_time - last_motion) > 30:
                last_alert_time[motion_key] = current_time
                snapshot_path = save_snapshot(frame, 'motion')
                try:
                    alert = Alert.objects.create(
                        alert_type='motion',
                        severity='low',
                        description=f'Motion detected by {camera.name}',
                        camera=camera,
                    )
                    if snapshot_path:
                        alert.snapshot.name = snapshot_path
                        alert.save(update_fields=['snapshot'])
                except Exception as e:
                    logger.error(f"Failed to create motion alert: {e}")

            # === FACE DETECTION & RECOGNITION ===
            if 'face_cascade' not in locals():
                face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            
            faces = face_cascade.detectMultiScale(gray, 1.3, 5, minSize=(30, 30))
            
            for (x, y, w, h) in faces:
                face_roi = gray[y:y+h, x:x+w]
                
                # Try to match against known faces
                student_id, student_name, confidence = match_face(face_roi)
                
                if student_name:
                    # Known student detected
                    color = (0, 255, 0)  # Green
                    label = f"{student_name} ({confidence:.0f}%)"
                    cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
                    cv2.putText(frame, label, (x, y - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                    
                    # Create recognition alert (throttled)
                    alert_key = f"rec_{student_id}_{camera.id}"
                    last_rec = last_alert_time.get(alert_key, 0)
                    if (current_time - last_rec) > 60:
                        last_alert_time[alert_key] = current_time
                        snapshot_path = save_snapshot(frame, f'rec_{student_id}')
                        try:
                            student_obj = Student.objects.get(id=student_id)
                            alert = Alert.objects.create(
                                alert_type='recognition',
                                severity='low',
                                description=f'{student_name} detected by {camera.name}',
                                camera=camera,
                                student=student_obj
                            )
                            if snapshot_path:
                                alert.snapshot.name = snapshot_path
                                alert.save(update_fields=['snapshot'])
                        except Exception as e:
                            logger.error(f"Failed to create recognition alert: {e}")
                else:
                    # Unknown face
                    color = (0, 0, 255)  # Red
                    cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
                    cv2.putText(frame, "Unknown", (x, y - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                    
                    # Create unauthorized alert (max 1 per 60 seconds)
                    alert_key = f"unauthorized_{camera.id}"
                    last_unauth = last_alert_time.get(alert_key, 0)
                    if (current_time - last_unauth) > 60:
                        last_alert_time[alert_key] = current_time
                        snapshot_path = save_snapshot(frame, 'unauthorized')
                        try:
                            alert = Alert.objects.create(
                                alert_type='unauthorized',
                                severity='high',
                                description=f'Unknown person detected by {camera.name}',
                                camera=camera,
                            )
                            if snapshot_path:
                                alert.snapshot.name = snapshot_path
                                alert.save(update_fields=['snapshot'])
                        except Exception as e:
                            logger.error(f"Failed to create unauthorized alert: {e}")

            # === YOLO PERSON DETECTION ===
            if yolo_model is not None:
                with yolo_lock:
                    results = yolo_model(frame, verbose=False)
                
                person_count = 0
                for result in results:
                    for box in result.boxes:
                        cls_id = int(box.cls[0])
                        if cls_id == 0:  # Person class
                            person_count += 1
                            x1, y1, x2, y2 = map(int, box.xyxy[0])
                            conf = float(box.conf[0])
                            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 165, 0), 2)
                            cv2.putText(frame, f"Person {conf:.1%}", (x1, y1 - 10),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 165, 0), 2)
                
                # Show person count on frame
                if person_count > 0:
                    cv2.putText(frame, f"People: {person_count}", (10, 30),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        
        # Encode and yield frame
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
            
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    # cap.release() not needed, reader runs indefinitely


def _probe_local_webcams(max_index=10):
    """Probe local webcam indices 0..max_index-1 and return list of available indices."""
    available = []
    for idx in range(max_index):
        try:
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret and frame is not None:
                    available.append(idx)
                cap.release()
            else:
                cap.release()
                # Also try default backend
                cap2 = cv2.VideoCapture(idx)
                if cap2.isOpened():
                    ret, frame = cap2.read()
                    if ret and frame is not None:
                        available.append(idx)
                    cap2.release()
                else:
                    cap2.release()
        except Exception:
            pass
    return available


# --- Security: Converted from @csrf_exempt plain views to DRF api_view with auth ---

@api_view(['POST'])
def scan_local_webcams(request):
    """Probe all local webcam indices and auto-register any new ones as Camera records.
    Returns the list of all local webcam cameras (existing + newly created).
    """
    available_indices = _probe_local_webcams()
    cameras = []

    for idx in available_indices:
        rtsp_url = str(idx)
        # Check if a camera with this rtsp_url already exists
        cam, created = Camera.objects.get_or_create(
            rtsp_url=rtsp_url,
            defaults={
                'name': f'Webcam {idx}' if idx > 0 else 'Laptop Camera',
                'location': 'Local',
                'status': 'online',
                'zone_type': 'classroom',
                'is_active': True,
            }
        )
        if not created:
            # Ensure existing camera is marked online
            if cam.status != 'online':
                cam.status = 'online'
                cam.save(update_fields=['status'])

        cameras.append({
            'id': cam.id,
            'name': cam.name,
            'rtsp_url': cam.rtsp_url,
            'status': cam.status,
            'created': created,
        })

    # Mark any local-webcam cameras whose index is no longer available as offline
    local_cam_urls = [str(i) for i in range(10)]
    available_urls = [str(i) for i in available_indices]
    Camera.objects.filter(
        rtsp_url__in=local_cam_urls
    ).exclude(
        rtsp_url__in=available_urls
    ).update(status='offline')

    return Response({
        'available_indices': available_indices,
        'cameras': cameras,
        'total': len(cameras),
    })


@api_view(['POST'])
def detect_face_api(request):
    """API endpoint to detect faces in an uploaded image.
    Returns face count and bounding boxes.
    Used as a fallback when the browser's FaceDetector API is unavailable.
    """
    image_file = request.FILES.get('image')
    if not image_file:
        return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Read image bytes and decode with OpenCV
        file_bytes = np.frombuffer(image_file.read(), np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        if img is None:
            return Response({'error': 'Invalid image'}, status=status.HTTP_400_BAD_REQUEST)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        faces = face_cascade.detectMultiScale(gray, 1.3, 5, minSize=(30, 30))

        face_list = []
        for (x, y, w, h) in faces:
            face_list.append({
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h),
            })

        return Response({
            'faceCount': len(face_list),
            'faces': face_list,
        })
    except Exception as e:
        logger.error(f"Face detection API error: {e}")
        return Response({'error': 'Face detection failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def video_feed(request, camera_id):
    """Authenticated video feed endpoint."""
    # --- Security: Require authentication for video feeds ---
    if not request.user.is_authenticated:
        # Check for JWT token in query params as fallback for <img> tags
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from rest_framework.request import Request
        from rest_framework.exceptions import AuthenticationFailed
        try:
            token = request.GET.get('token')
            if token:
                request.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'
            drf_request = Request(request)
            jwt_auth = JWTAuthentication()
            user_auth = jwt_auth.authenticate(drf_request)
            if user_auth is None:
                return JsonResponse({'error': 'Authentication required'}, status=401)
        except (AuthenticationFailed, Exception):
            return JsonResponse({'error': 'Authentication required'}, status=401)

    camera = get_object_or_404(Camera, id=camera_id)
    response = StreamingHttpResponse(gen_frames(camera),
                                content_type='multipart/x-mixed-replace; boundary=frame')
    # --- Security: Removed wildcard Access-Control-Allow-Origin ---
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['X-Accel-Buffering'] = 'no'
    return response
