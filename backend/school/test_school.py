import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from school.models import Student, Schedule
from datetime import time

User = get_user_model()

@pytest.fixture
def authenticated_client():
    user = User.objects.create_user(username='teacher', password='password', role='teacher')
    client = APIClient()
    client.force_authenticate(user=user)
    return client

@pytest.mark.django_db
def test_create_student(authenticated_client):
    payload = {
        'name': 'John Doe',
        'grade': '10',
        'section': 'A',
        'roll_number': '101'
    }
    response = authenticated_client.post('/api/v1/students/', payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['name'] == 'John Doe'
    assert Student.objects.count() == 1

@pytest.mark.django_db
def test_create_schedule(authenticated_client):
    user = User.objects.get(username='teacher')
    payload = {
        'grade': '10',
        'section': 'A',
        'period_number': 1,
        'period_start': '08:00:00',
        'period_end': '08:45:00',
        'day_of_week': 0,
        'subject': 'Math',
        'teacher': user.id
    }
    response = authenticated_client.post('/api/v1/schedules/', payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert Schedule.objects.count() == 1
