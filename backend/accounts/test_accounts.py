import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def create_user():
    def make_user(**kwargs):
        return User.objects.create_user(**kwargs)
    return make_user

@pytest.mark.django_db
def test_user_creation(create_user):
    user = create_user(username='testteacher', password='password123', role='teacher')
    assert user.username == 'testteacher'
    assert user.role == 'teacher'
    assert user.check_password('password123') is True

@pytest.mark.django_db
def test_login_obtains_token(api_client, create_user):
    create_user(username='testteacher', password='password123', role='teacher')
    
    response = api_client.post('/api/v1/auth/login/', {
        'username': 'testteacher',
        'password': 'password123'
    })
    
    assert response.status_code == status.HTTP_200_OK
    assert 'access' in response.data
    assert 'refresh' in response.data

@pytest.mark.django_db
def test_unauthorized_access(api_client):
    response = api_client.get('/api/v1/auth/users/')
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
