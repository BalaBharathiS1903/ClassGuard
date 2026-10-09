import os
import json
import logging
import cv2
import numpy as np
from django.conf import settings

logger = logging.getLogger(__name__)

# Cache for Haar cascades
_cascades = {}
_cascades_loaded = False


def get_face_cascades():
    """Load and cache Haar cascades (alt2 for high accuracy, default as fallback, profile for side angles)."""
    global _cascades, _cascades_loaded
    if _cascades_loaded and _cascades:
        return _cascades

    cascade_dir = getattr(cv2, 'data', None)
    base_path = getattr(cascade_dir, 'haarcascades', '') if cascade_dir else ''
    if not base_path or not os.path.isdir(base_path):
        cv2_file = getattr(cv2, '__file__', None)
        if cv2_file:
            cand = os.path.join(os.path.dirname(cv2_file), 'data')
            if os.path.isdir(cand):
                base_path = cand

    candidates = {
        'alt2': 'haarcascade_frontalface_alt2.xml',
        'default': 'haarcascade_frontalface_default.xml',
        'profile': 'haarcascade_profileface.xml',
    }

    for name, xml_name in candidates.items():
        xml_path = os.path.join(base_path, xml_name) if base_path else xml_name
        if os.path.exists(xml_path):
            try:
                clf = cv2.CascadeClassifier(xml_path)
                if not clf.empty():
                    _cascades[name] = clf
                    logger.debug(f"Loaded cascade {name} from {xml_path}")
            except Exception as e:
                logger.warning(f"Failed to load cascade {name} from {xml_path}: {e}")

    _cascades_loaded = True
    return _cascades


def detect_faces_robust(img_bgr_or_gray, max_faces=10):
    """Robust face detection using multi-scale, multi-cascade passes with contrast enhancement.
    Returns a list of (x, y, w, h) bounding boxes sorted by face area (largest first).
    """
    if img_bgr_or_gray is None:
        return []

    if len(img_bgr_or_gray.shape) == 3:
        gray = cv2.cvtColor(img_bgr_or_gray, cv2.COLOR_BGR2GRAY)
    else:
        gray = img_bgr_or_gray

    cascades = get_face_cascades()
    if not cascades:
        logger.warning("No face cascades available for detection.")
        return []

    # Downscale very large images (> 1200px) for speed and more reliable Haar scale steps
    orig_h, orig_w = gray.shape[:2]
    scale_down = 1.0
    max_dim = max(orig_h, orig_w)
    work_gray = gray
    if max_dim > 1200:
        scale_down = 1200.0 / max_dim
        new_w = int(orig_w * scale_down)
        new_h = int(orig_h * scale_down)
        work_gray = cv2.resize(gray, (new_w, new_h))

    detected_boxes = []

    def _run_cascade(clf, target_img, scale_factor=1.1, min_neighbors=3, min_size=(30, 30)):
        try:
            return clf.detectMultiScale(
                target_img,
                scaleFactor=scale_factor,
                minNeighbors=min_neighbors,
                minSize=min_size,
            )
        except Exception:
            return ()

    # Pass 1: Primary accurate cascade (alt2)
    alt2_clf = cascades.get('alt2')
    if alt2_clf:
        faces = _run_cascade(alt2_clf, work_gray, scale_factor=1.1, min_neighbors=3)
        if len(faces) > 0:
            detected_boxes = list(faces)

    # Pass 2: If no face found, apply CLAHE (contrast enhancement) to handle dim / backlight
    if len(detected_boxes) == 0:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced_gray = clahe.apply(work_gray)
        if alt2_clf:
            faces = _run_cascade(alt2_clf, enhanced_gray, scale_factor=1.1, min_neighbors=3)
            if len(faces) > 0:
                detected_boxes = list(faces)

    # Pass 3: Fallback to default cascade
    default_clf = cascades.get('default')
    if len(detected_boxes) == 0 and default_clf:
        faces = _run_cascade(default_clf, work_gray, scale_factor=1.1, min_neighbors=3)
        if len(faces) == 0:
            # Try with enhanced contrast
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced_gray = clahe.apply(work_gray)
            faces = _run_cascade(default_clf, enhanced_gray, scale_factor=1.1, min_neighbors=3)
        if len(faces) > 0:
            detected_boxes = list(faces)

    # Pass 4: Profile cascade for slight side-angles
    profile_clf = cascades.get('profile')
    if len(detected_boxes) == 0 and profile_clf:
        faces = _run_cascade(profile_clf, work_gray, scale_factor=1.1, min_neighbors=3)
        if len(faces) > 0:
            detected_boxes = list(faces)

    if not detected_boxes:
        return []

    # Map coordinates back if downscaled
    final_faces = []
    inv_scale = 1.0 / scale_down
    for (x, y, w, h) in detected_boxes:
        rx = int(round(x * inv_scale))
        ry = int(round(y * inv_scale))
        rw = int(round(w * inv_scale))
        rh = int(round(h * inv_scale))
        # Clamp to image boundaries
        rx = max(0, min(rx, orig_w - 1))
        ry = max(0, min(ry, orig_h - 1))
        rw = max(1, min(rw, orig_w - rx))
        rh = max(1, min(rh, orig_h - ry))
        final_faces.append((rx, ry, rw, rh))

    # Sort by face area (descending)
    final_faces.sort(key=lambda b: b[2] * b[3], reverse=True)
    return final_faces[:max_faces]


def _compute_lbp(img_gray):
    """Vectorized calculation of 8-neighbor basic Local Binary Patterns (LBP)."""
    h, w = img_gray.shape
    if h < 3 or w < 3:
        return np.zeros((h, w), dtype=np.uint8)

    center = img_gray[1:h - 1, 1:w - 1]
    lbp = np.zeros((h - 2, w - 2), dtype=np.uint8)

    lbp |= ((img_gray[0:h - 2, 0:w - 2] >= center) << 7).astype(np.uint8)
    lbp |= ((img_gray[0:h - 2, 1:w - 1] >= center) << 6).astype(np.uint8)
    lbp |= ((img_gray[0:h - 2, 2:w] >= center) << 5).astype(np.uint8)
    lbp |= ((img_gray[1:h - 1, 2:w] >= center) << 4).astype(np.uint8)
    lbp |= ((img_gray[2:h, 2:w] >= center) << 3).astype(np.uint8)
    lbp |= ((img_gray[2:h, 1:w - 1] >= center) << 2).astype(np.uint8)
    lbp |= ((img_gray[2:h, 0:w - 2] >= center) << 1).astype(np.uint8)
    lbp |= ((img_gray[1:h - 1, 0:w - 2] >= center) << 0).astype(np.uint8)
    return lbp


def extract_face_features(face_gray, grid_x=8, grid_y=8):
    """Extract Spatial Local Binary Pattern Histograms (Spatial LBPH) and normalized template.
    Robust to monotonic illumination changes, small pose adjustments, and distance variations.
    """
    face_resized = cv2.resize(face_gray, (100, 100))
    face_eq = cv2.equalizeHist(face_resized)

    lbp = _compute_lbp(face_eq)
    cell_h = lbp.shape[0] // grid_y
    cell_w = lbp.shape[1] // grid_x

    hist_list = []
    for r in range(grid_y):
        for c in range(grid_x):
            cell = lbp[r * cell_h:(r + 1) * cell_h, c * cell_w:(c + 1) * cell_w]
            cell_hist, _ = np.histogram(cell, bins=32, range=(0, 256))
            norm = np.linalg.norm(cell_hist)
            if norm > 0:
                cell_hist = cell_hist / norm
            hist_list.append(cell_hist)

    feature_vec = np.concatenate(hist_list)
    vec_norm = np.linalg.norm(feature_vec)
    if vec_norm > 0:
        feature_vec = feature_vec / vec_norm

    return {
        'version': 2,
        'lbp': feature_vec.tolist(),
        'raw': face_eq.flatten().tolist(),
    }


def compute_face_encoding(image_source):
    """Compute face encoding from a file path, file-like object, or numpy array.
    Returns (encoding_dict, bbox) or (None, None).
    """
    try:
        img = None
        if isinstance(image_source, np.ndarray):
            img = image_source
        elif isinstance(image_source, (str, bytes, bytearray, memoryview)) or hasattr(image_source, 'read'):
            if hasattr(image_source, 'read'):
                data = image_source.read()
                if hasattr(image_source, 'seek'):
                    image_source.seek(0)
                file_bytes = np.frombuffer(data, dtype=np.uint8)
                img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            elif isinstance(image_source, (bytes, bytearray, memoryview)):
                file_bytes = np.frombuffer(image_source, dtype=np.uint8)
                img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            elif isinstance(image_source, str):
                # Use np.fromfile to safely handle Windows paths with Unicode / spaces
                if os.path.exists(image_source):
                    file_bytes = np.fromfile(image_source, dtype=np.uint8)
                    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        if img is None:
            logger.warning(f"Could not decode image from source: {type(image_source)}")
            return None, None

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        faces = detect_faces_robust(gray)

        if not faces:
            logger.warning("No face detected in image source.")
            return None, None

        # Take largest detected face
        x, y, w, h = faces[0]
        face_roi = gray[y:y + h, x:x + w]
        encoding = extract_face_features(face_roi)
        logger.info(f"Computed face encoding successfully (face size: {w}x{h})")
        return encoding, (x, y, w, h)

    except Exception as e:
        logger.error(f"Error computing face encoding: {e}")
        return None, None


def compare_face_features(probe_face_gray, known_data):
    """Compare a probe face grayscale ROI against stored face data.
    known_data can be:
    - dict with 'lbp' and 'raw' (version 2)
    - list of 10000 ints (version 1 legacy)
    - dict with numpy arrays already parsed
    Returns (match_bool, confidence_score, combined_score).
    """
    try:
        # Extract features for probe
        probe_resized = cv2.resize(probe_face_gray, (100, 100))
        probe_eq = cv2.equalizeHist(probe_resized)

        # Parse known data
        known_lbp = None
        known_eq = None

        if isinstance(known_data, dict):
            if 'lbp_arr' in known_data:
                known_lbp = known_data['lbp_arr']
            elif 'lbp' in known_data:
                known_lbp = np.array(known_data['lbp'], dtype=np.float32)

            if 'raw_arr' in known_data:
                known_eq = known_data['raw_arr']
            elif 'raw' in known_data:
                known_eq = np.array(known_data['raw'], dtype=np.uint8).reshape(100, 100)
            elif 'encoding' in known_data and isinstance(known_data['encoding'], np.ndarray):
                known_eq = known_data['encoding']
        elif isinstance(known_data, list):
            # Legacy v1: 10000 flat pixels
            if len(known_data) == 10000:
                known_eq = np.array(known_data, dtype=np.uint8).reshape(100, 100)
                # Compute lbp on the fly
                known_lbp = extract_face_features(known_eq)['lbp']
                known_lbp = np.array(known_lbp, dtype=np.float32)

        # Compute probe LBP vector
        probe_lbp = _compute_lbp(probe_eq)
        grid_x, grid_y = 8, 8
        cell_h = probe_lbp.shape[0] // grid_y
        cell_w = probe_lbp.shape[1] // grid_x
        hist_list = []
        for r in range(grid_y):
            for c in range(grid_x):
                cell = probe_lbp[r * cell_h:(r + 1) * cell_h, c * cell_w:(c + 1) * cell_w]
                cell_hist, _ = np.histogram(cell, bins=32, range=(0, 256))
                norm = np.linalg.norm(cell_hist)
                if norm > 0:
                    cell_hist = cell_hist / norm
                hist_list.append(cell_hist)

        probe_vec = np.concatenate(hist_list)
        p_norm = np.linalg.norm(probe_vec)
        if p_norm > 0:
            probe_vec = probe_vec / p_norm

        # Metric 1: Cosine similarity of Spatial LBP
        lbp_sim = 0.0
        if known_lbp is not None:
            lbp_sim = float(np.dot(probe_vec, known_lbp))
            lbp_sim = max(0.0, min(1.0, lbp_sim))

        # Metric 2: Structural template correlation
        tpl_sim = 0.0
        if known_eq is not None:
            res = cv2.matchTemplate(probe_eq, known_eq, cv2.TM_CCOEFF_NORMED)
            tpl_sim = float(res[0][0])
            tpl_sim = max(0.0, min(1.0, tpl_sim))

        # Combined weighted score
        combined_score = (lbp_sim * 0.7) + (tpl_sim * 0.3)

        # Threshold: 0.58 combined score indicates a solid match
        MATCH_THRESHOLD = 0.58
        is_match = combined_score >= MATCH_THRESHOLD

        # Map to 0-100% confidence scale
        # Below 0.45 -> near 0%
        # 0.58 -> ~65%
        # 0.80+ -> ~95-100%
        if combined_score <= 0.45:
            confidence = max(0.0, combined_score * 30.0)
        else:
            confidence = min(100.0, 50.0 + ((combined_score - 0.45) / 0.40) * 50.0)

        return is_match, round(confidence, 1), round(combined_score, 3)

    except Exception as e:
        logger.error(f"Error in compare_face_features: {e}")
        return False, 0.0, 0.0


def assess_face_quality(img_bgr_or_gray, face_bbox=None):
    """Assess basic face image quality (blurriness, illumination).
    Useful for feedback during registration.
    """
    if img_bgr_or_gray is None:
        return {'valid': False, 'reason': 'No image provided'}

    gray = cv2.cvtColor(img_bgr_or_gray, cv2.COLOR_BGR2GRAY) if len(img_bgr_or_gray.shape) == 3 else img_bgr_or_gray
    if face_bbox:
        x, y, w, h = face_bbox
        roi = gray[y:y + h, x:x + w]
    else:
        roi = gray

    # Laplacian variance as sharpness metric
    lap_var = float(cv2.Laplacian(roi, cv2.CV_64F).var())
    mean_brightness = float(np.mean(roi))

    is_blurry = lap_var < 35.0
    is_too_dark = mean_brightness < 40.0
    is_too_bright = mean_brightness > 225.0

    return {
        'valid': not (is_blurry or is_too_dark or is_too_bright),
        'sharpness': round(lap_var, 1),
        'brightness': round(mean_brightness, 1),
        'is_blurry': is_blurry,
        'is_too_dark': is_too_dark,
        'is_too_bright': is_too_bright,
    }
