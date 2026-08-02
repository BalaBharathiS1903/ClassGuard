from django.db import models
from django.conf import settings

class Student(models.Model):
    name = models.CharField(max_length=255)
    grade = models.CharField(max_length=20)
    section = models.CharField(max_length=20)
    roll_number = models.CharField(max_length=50)
    photo_url = models.URLField(blank=True, null=True)
    photo = models.ImageField(upload_to='student_photos/', blank=True, null=True)
    face_encoding = models.TextField(blank=True, null=True, help_text="JSON-serialized face encoding for recognition")
    parent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='children', limit_choices_to={'role': 'parent'})
    rfid_tag = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.grade}-{self.section})"

class Schedule(models.Model):
    grade = models.CharField(max_length=20)
    section = models.CharField(max_length=20)
    period_number = models.IntegerField()
    period_start = models.TimeField()
    period_end = models.TimeField()
    day_of_week = models.IntegerField(help_text="0=Monday, 6=Sunday")
    subject = models.CharField(max_length=100)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, limit_choices_to={'role': 'teacher'})

    def __str__(self):
        return f"{self.grade}-{self.section} - Period {self.period_number}"

class Staff(models.Model):
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=50, blank=True, null=True)
    photo = models.ImageField(upload_to='staff_photos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.role})"
