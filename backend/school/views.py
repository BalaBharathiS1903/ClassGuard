from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import csv
import io
import json
import cv2
import numpy as np
import logging
from .models import Student, Schedule, Staff
from .serializers import StudentSerializer, ScheduleSerializer, StaffSerializer

logger = logging.getLogger(__name__)

# --- Maximum CSV upload limits ---
MAX_CSV_FILE_SIZE = 1_000_000  # 1 MB
MAX_CSV_ROWS = 500


from .face_utils import compute_face_encoding, assess_face_quality


def _sanitize_csv_field(value):
    """Sanitize a CSV field to prevent CSV injection (formula injection).
    Strips leading characters that spreadsheet apps interpret as formulas.
    """
    if not value:
        return value
    value = value.strip()
    # Prevent formula injection: strip leading =, +, -, @, \t, \r
    if value and value[0] in ('=', '+', '-', '@', '\t', '\r'):
        value = "'" + value
    return value


class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        instance = serializer.save()
        # If a photo was uploaded, compute face encoding
        if 'photo' in self.request.FILES and instance.photo:
            try:
                encoding, _ = compute_face_encoding(instance.photo.path)
                if encoding is not None:
                    instance.face_encoding = json.dumps(encoding)
                    instance.save(update_fields=['face_encoding'])
                    logger.info(f"Face encoding computed for student: {instance.name}")
                    try:
                        from detection.views import invalidate_known_faces
                        invalidate_known_faces()
                    except Exception:
                        pass
                else:
                    logger.warning(f"Could not compute face encoding for student: {instance.name}")
            except Exception as e:
                logger.error(f"Error encoding photo during update: {e}")

    def perform_create(self, serializer):
        instance = serializer.save()
        if instance.photo:
            try:
                encoding, _ = compute_face_encoding(instance.photo.path)
                if encoding is not None:
                    instance.face_encoding = json.dumps(encoding)
                    instance.save(update_fields=['face_encoding'])
                    logger.info(f"Face encoding computed for new student: {instance.name}")
                    try:
                        from detection.views import invalidate_known_faces
                        invalidate_known_faces()
                    except Exception:
                        pass
            except Exception as e:
                logger.error(f"Error encoding photo during create: {e}")

    @action(detail=True, methods=['post'])
    def register_face(self, request, pk=None):
        """Dedicated biometric face registration endpoint for a student."""
        student = self.get_object()
        photo_file = request.FILES.get('photo')
        if not photo_file:
            return Response({'error': 'No photo provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate that image contains a detectable face
        encoding, bbox = compute_face_encoding(photo_file)
        if encoding is None:
            return Response({
                'error': 'No clear face detected in the image. Please position your face clearly facing the camera.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Save photo to student
        student.photo = photo_file
        student.face_encoding = json.dumps(encoding)
        student.save(update_fields=['photo', 'face_encoding'])

        # Invalidate detection memory cache
        try:
            from detection.views import invalidate_known_faces
            invalidate_known_faces()
        except Exception:
            pass

        return Response({
            'message': f'Face successfully registered and encoded for {student.name}',
            'has_face_encoding': True,
            'bbox': bbox,
            'student': StudentSerializer(student).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def bulk_upload(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES['file']

        # --- Security: File size limit ---
        if file.size > MAX_CSV_FILE_SIZE:
            return Response(
                {"error": f"File too large. Maximum size is {MAX_CSV_FILE_SIZE // 1_000_000}MB."},
                status=status.HTTP_400_BAD_REQUEST
            )

        decoded_file = file.read().decode('utf-8')
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)

        students_to_create = []
        row_count = 0
        for row in reader:
            row_count += 1
            # --- Security: Row count limit ---
            if row_count > MAX_CSV_ROWS:
                return Response(
                    {"error": f"Too many rows. Maximum is {MAX_CSV_ROWS}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if row.get('name') and row.get('roll_number'):
                students_to_create.append(
                    Student(
                        name=_sanitize_csv_field(row.get('name', '')),
                        grade=_sanitize_csv_field(row.get('grade', '')),
                        section=_sanitize_csv_field(row.get('section', '')),
                        roll_number=_sanitize_csv_field(row.get('roll_number', ''))
                    )
                )

        if students_to_create:
            Student.objects.bulk_create(students_to_create)
            return Response({"message": f"Successfully created {len(students_to_create)} students."})
        return Response({"error": "No valid rows found"}, status=status.HTTP_400_BAD_REQUEST)


class ScheduleViewSet(viewsets.ModelViewSet):
    queryset = Schedule.objects.all()
    serializer_class = ScheduleSerializer
    permission_classes = [IsAuthenticated]


from twilio.rest import Client
from django.conf import settings

class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def send_alert(self, request, pk=None):
        staff_member = self.get_object()
        message = request.data.get('message', '')
        channel = request.data.get('channel', 'sms')

        if not message:
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"Sending {channel} to {staff_member.name} ({staff_member.phone_number})")

        # Twilio Integration
        if staff_member.phone_number:
            account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
            auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
            from_number = getattr(settings, 'TWILIO_WHATSAPP_NUMBER' if channel == 'whatsapp' else 'TWILIO_PHONE_NUMBER', '')

            if account_sid and auth_token:
                try:
                    to_number = staff_member.phone_number
                    if not to_number.startswith('+'):
                        if len(to_number) == 10:
                            to_number = '+91' + to_number
                        else:
                            to_number = '+' + to_number

                    client = Client(account_sid, auth_token)
                    msg = client.messages.create(
                        body=message,
                        from_=f'whatsapp:{from_number}' if channel == 'whatsapp' and not from_number.startswith('whatsapp:') else from_number,
                        to=f'whatsapp:{to_number}' if channel == 'whatsapp' else to_number
                    )
                    logger.info(f"Twilio message sent: {msg.sid}")
                except Exception as e:
                    # --- Security: Don't leak Twilio internals to client ---
                    logger.error(f"Failed to send Twilio message: {e}")
                    return Response(
                        {"error": "Failed to send message. Please try again later."},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

        return Response({
            "message": f"Successfully sent {channel} to {staff_member.name}",
            "staff": staff_member.name,
            "channel": channel
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def bulk_upload(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES['file']

        # --- Security: File size limit ---
        if file.size > MAX_CSV_FILE_SIZE:
            return Response(
                {"error": f"File too large. Maximum size is {MAX_CSV_FILE_SIZE // 1_000_000}MB."},
                status=status.HTTP_400_BAD_REQUEST
            )

        decoded_file = file.read().decode('utf-8')
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)

        staff_to_create = []
        row_count = 0
        for row in reader:
            row_count += 1
            # --- Security: Row count limit ---
            if row_count > MAX_CSV_ROWS:
                return Response(
                    {"error": f"Too many rows. Maximum is {MAX_CSV_ROWS}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if row.get('name') and row.get('role'):
                staff_to_create.append(
                    Staff(
                        name=_sanitize_csv_field(row.get('name', '')),
                        role=_sanitize_csv_field(row.get('role', '')),
                        phone_number=_sanitize_csv_field(row.get('phone_number', ''))
                    )
                )

        if staff_to_create:
            Staff.objects.bulk_create(staff_to_create)
            return Response({"message": f"Successfully created {len(staff_to_create)} staff members."})
        return Response({"error": "No valid rows found"}, status=status.HTTP_400_BAD_REQUEST)
