import pytest
import numpy as np
import cv2
from school.face_utils import (
    get_face_cascades,
    detect_faces_robust,
    extract_face_features,
    compare_face_features,
    assess_face_quality,
)

def test_cascades_available():
    cascades = get_face_cascades()
    assert 'alt2' in cascades or 'default' in cascades


def test_face_features_and_comparison():
    # Create synthetic face-like pattern
    img = np.zeros((100, 100), dtype=np.uint8)
    cv2.circle(img, (50, 50), 40, 200, -1)
    cv2.circle(img, (35, 35), 8, 50, -1)  # Left eye
    cv2.circle(img, (65, 35), 8, 50, -1)  # Right eye
    cv2.ellipse(img, (50, 65), (20, 8), 0, 0, 180, 50, 3)  # Mouth

    features = extract_face_features(img)
    assert features['version'] == 2
    assert len(features['lbp']) == 64 * 32
    assert len(features['raw']) == 10000

    # Self-comparison should produce near-perfect match
    is_match, conf, score = compare_face_features(img, features)
    assert is_match is True
    assert score >= 0.85
    assert conf >= 90.0

    # Comparison against random noise should NOT match
    noise = np.random.randint(0, 256, (100, 100), dtype=np.uint8)
    is_match_noise, conf_noise, score_noise = compare_face_features(noise, features)
    assert is_match_noise is False
    assert score_noise < 0.58


def test_assess_face_quality():
    good_img = np.random.randint(50, 200, (100, 100), dtype=np.uint8)
    quality = assess_face_quality(good_img)
    assert 'valid' in quality
    assert 'sharpness' in quality
    assert 'brightness' in quality
