"""
Security Enforcement Tests
===========================
Verify that all sensitive endpoints require authentication,
object-level permissions are enforced, and CORS is restricted.
"""
import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestAuthEnforcement:
    """Verify all sensitive endpoints require authentication."""

    def setup_method(self):
        self.client = APIClient()

    @pytest.mark.parametrize("url", [
        "/api/v1/students/",
        "/api/v1/staff/",
        "/api/v1/cameras/",
        "/api/v1/alerts/",
        "/api/v1/auth/users/",
        "/api/v1/notifications/",
    ])
    def test_endpoints_require_auth(self, url):
        """Unauthenticated GET requests must return 401."""
        response = self.client.get(url)
        assert response.status_code == 401, (
            f"{url} is accessible without authentication! "
            f"Got {response.status_code} instead of 401."
        )

    @pytest.mark.parametrize("url,data", [
        ("/api/v1/students/", {"name": "Test", "grade": "5", "section": "A", "roll_number": "001"}),
        ("/api/v1/staff/", {"name": "Test", "role": "Guard"}),
        ("/api/v1/cameras/", {"name": "Cam1", "location": "Hall", "rtsp_url": "0"}),
    ])
    def test_create_endpoints_require_auth(self, url, data):
        """Unauthenticated POST (create) requests must return 401."""
        response = self.client.post(url, data=data, format='json')
        assert response.status_code == 401, (
            f"POST {url} is accessible without authentication! "
            f"Got {response.status_code} instead of 401."
        )

    def test_scan_webcams_requires_auth(self):
        """The scan-webcams endpoint must require authentication."""
        response = self.client.post("/api/v1/scan-webcams/")
        assert response.status_code == 401, (
            f"scan-webcams is accessible without authentication! "
            f"Got {response.status_code} instead of 401."
        )

    def test_detect_face_requires_auth(self):
        """The detect-face endpoint must require authentication."""
        response = self.client.post("/api/v1/detect-face/")
        assert response.status_code == 401, (
            f"detect-face is accessible without authentication! "
            f"Got {response.status_code} instead of 401."
        )


@pytest.mark.django_db
class TestObjectLevelPermissions:
    """Verify object-level access controls on user data."""

    def setup_method(self):
        self.client = APIClient()

    def test_teacher_cannot_see_all_users(self):
        """A regular teacher should only see their own user record."""
        from accounts.models import User
        teacher = User.objects.create_user(
            username='teacher_test', password='testpass123!', role='teacher'
        )
        User.objects.create_user(
            username='parent_test', password='testpass123!', role='parent'
        )

        self.client.force_authenticate(user=teacher)
        response = self.client.get("/api/v1/auth/users/")
        data = response.json()

        # Teacher should only see themselves
        if isinstance(data, list):
            assert len(data) == 1, (
                f"Teacher can see {len(data)} users instead of just themselves."
            )
            assert data[0]['username'] == 'teacher_test'
        elif isinstance(data, dict) and 'results' in data:
            assert len(data['results']) == 1

    def test_teacher_cannot_update_other_user(self):
        """A teacher should not be able to modify another user's profile."""
        from accounts.models import User
        teacher = User.objects.create_user(
            username='teacher_a', password='testpass123!', role='teacher'
        )
        other = User.objects.create_user(
            username='teacher_b', password='testpass123!', role='teacher'
        )

        self.client.force_authenticate(user=teacher)
        response = self.client.patch(
            f"/api/v1/auth/users/{other.id}/",
            data={'first_name': 'Hacked'},
            format='json'
        )
        # Should be 403 or 404 (hidden by queryset filtering)
        assert response.status_code in (403, 404), (
            f"Teacher was able to update another user's profile! "
            f"Got {response.status_code}."
        )

    def test_principal_can_see_all_users(self):
        """A principal should be able to see all users."""
        from accounts.models import User
        principal = User.objects.create_user(
            username='principal_test', password='testpass123!', role='principal'
        )
        User.objects.create_user(
            username='parent_test2', password='testpass123!', role='parent'
        )

        self.client.force_authenticate(user=principal)
        response = self.client.get("/api/v1/auth/users/")
        data = response.json()

        if isinstance(data, list):
            assert len(data) >= 2, "Principal should see all users."
        elif isinstance(data, dict) and 'results' in data:
            assert len(data['results']) >= 2


@pytest.mark.django_db
class TestCSVUploadValidation:
    """Verify CSV upload security controls."""

    def setup_method(self):
        from accounts.models import User
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='csv_tester', password='testpass123!', role='principal'
        )
        self.client.force_authenticate(user=self.user)

    def test_oversized_csv_rejected(self):
        """CSV files larger than 1MB must be rejected."""
        from io import BytesIO
        # Create a file just over 1MB
        big_content = b"name,grade,section,roll_number\n" + b"x" * (1024 * 1024 + 100)
        big_file = BytesIO(big_content)
        big_file.name = 'big.csv'
        response = self.client.post(
            "/api/v1/students/bulk_upload/",
            data={'file': big_file},
            format='multipart'
        )
        assert response.status_code == 400, (
            f"Oversized CSV was accepted! Got {response.status_code} instead of 400."
        )

    def test_csv_injection_sanitized(self):
        """CSV fields starting with =, +, -, @ must be sanitized."""
        from io import BytesIO
        import json
        csv_content = b"name,grade,section,roll_number\n=cmd('calc'),5,A,INJ001\n"
        csv_file = BytesIO(csv_content)
        csv_file.name = 'injection.csv'
        response = self.client.post(
            "/api/v1/students/bulk_upload/",
            data={'file': csv_file},
            format='multipart'
        )
        # If upload succeeds, check the name was sanitized
        if response.status_code in (200, 201):
            from school.models import Student
            student = Student.objects.filter(roll_number='INJ001').first()
            if student:
                assert not student.name.startswith('='), (
                    "CSV injection formula was not sanitized!"
                )

    def test_empty_csv_handled(self):
        """Empty CSV files must be handled gracefully."""
        from io import BytesIO
        empty_file = BytesIO(b"")
        empty_file.name = 'empty.csv'
        response = self.client.post(
            "/api/v1/students/bulk_upload/",
            data={'file': empty_file},
            format='multipart'
        )
        # Should return 400 (bad request), not 500 (server error)
        assert response.status_code != 500, (
            f"Empty CSV caused a server error! Got {response.status_code}."
        )


@pytest.mark.django_db
class TestRateLimitingConfig:
    """Verify rate limiting is configured correctly in DRF settings."""

    def test_throttle_classes_configured(self):
        """DRF throttle classes must be set."""
        from django.conf import settings
        throttle_classes = settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_CLASSES', [])
        assert len(throttle_classes) > 0, "No throttle classes configured!"
        assert 'rest_framework.throttling.AnonRateThrottle' in throttle_classes
        assert 'rest_framework.throttling.UserRateThrottle' in throttle_classes

    def test_throttle_rates_configured(self):
        """DRF throttle rates must be set for anon and user."""
        from django.conf import settings
        rates = settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {})
        assert 'anon' in rates, "Anonymous throttle rate not configured!"
        assert 'user' in rates, "User throttle rate not configured!"

    def test_jwt_access_lifetime_short(self):
        """JWT access token lifetime must be 30 minutes or less."""
        from django.conf import settings
        from datetime import timedelta
        lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME', timedelta(hours=1))
        assert lifetime <= timedelta(minutes=30), (
            f"JWT access token lifetime is {lifetime}, should be ≤ 30 minutes."
        )
