from rest_framework import serializers
from .models import Student, Schedule, Staff


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            'id', 'name', 'grade', 'section', 'roll_number',
            'photo', 'photo_url', 'parent', 'rfid_tag', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'face_encoding']
        extra_kwargs = {
            'face_encoding': {'read_only': True},
        }


class ScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = [
            'id', 'grade', 'section', 'period_number',
            'period_start', 'period_end', 'day_of_week',
            'subject', 'teacher',
        ]
        read_only_fields = ['id']


class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = ['id', 'name', 'role', 'phone_number', 'photo', 'created_at']
        read_only_fields = ['id', 'created_at']
