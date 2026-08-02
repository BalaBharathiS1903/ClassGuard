from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CameraViewSet, AlertViewSet, NotificationViewSet, video_feed, detect_face_api, scan_local_webcams

router = DefaultRouter()
router.register(r'cameras', CameraViewSet, basename='camera')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('video_feed/<int:camera_id>/', video_feed, name='video_feed'),
    path('detect-face/', detect_face_api, name='detect_face_api'),
    path('scan-webcams/', scan_local_webcams, name='scan_local_webcams'),
    path('', include(router.urls)),
]
