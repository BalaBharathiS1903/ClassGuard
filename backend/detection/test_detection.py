import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from detection.models import Camera, Alert
from school.models import Student

User = get_user_model()

@pytest.fixture
def authenticated_client():
    user = User.objects.create_user(username='admin', password='password', role='principal')
    client = APIClient()
    client.force_authenticate(user=user)
    return client

@pytest.fixture
def setup_camera():
    return Camera.objects.create(name='Gate Cam', location='North Gate', rtsp_url='rtsp://10.0.0.1/1', zone_type='exit')

@pytest.mark.django_db
def test_create_alert(authenticated_client, setup_camera):
    payload = {
        'alert_type': 'unauthorized',
        'severity': 'critical',
        'description': 'Unknown person at gate',
        'camera': setup_camera.id
    }
    response = authenticated_client.post('/api/v1/alerts/', payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert Alert.objects.count() == 1
    assert response.data['severity'] == 'critical'

@pytest.mark.django_db
def test_camera_list(authenticated_client, setup_camera):
    response = authenticated_client.get('/api/v1/cameras/')
    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]['name'] == 'Gate Cam'
