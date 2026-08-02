from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, ScheduleViewSet, StaffViewSet

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')
router.register(r'schedules', ScheduleViewSet, basename='schedule')
router.register(r'staff', StaffViewSet, basename='staff')

urlpatterns = [
    path('', include(router.urls)),
]
