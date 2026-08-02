from rest_framework import serializers
from .models import Camera, Alert, Notification


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = [
            'id', 'name', 'location', 'rtsp_url',
            'status', 'zone_type', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class AlertSerializer(serializers.ModelSerializer):
    student_id = serializers.IntegerField(source='student.id', read_only=True, default=None)
    student_name = serializers.CharField(source='student.name', read_only=True, default=None)
    student_photo = serializers.ImageField(source='student.photo', read_only=True, default=None)
    student_grade = serializers.CharField(source='student.grade', read_only=True, default=None)
    student_section = serializers.CharField(source='student.section', read_only=True, default=None)
    student_roll_number = serializers.CharField(source='student.roll_number', read_only=True, default=None)

    class Meta:
        model = Alert
        fields = [
            'id', 'alert_type', 'severity', 'description',
            'student', 'camera', 'snapshot',
            'is_resolved', 'resolved_by', 'resolved_at', 'created_at',
            # Nested student fields (read-only)
            'student_id', 'student_name', 'student_photo',
            'student_grade', 'student_section', 'student_roll_number',
        ]
        read_only_fields = ['id', 'created_at', 'resolved_by', 'resolved_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'alert', 'channel', 'recipient',
            'status', 'sent_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'sent_at']
