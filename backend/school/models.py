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

    @property
    def has_face_encoding(self):
        return bool(self.face_encoding)

    def save(self, *args, **kwargs):
        compute_needed = False
        if self.pk:
            try:
                old = Student.objects.filter(pk=self.pk).first()
                if old:
                    if self.photo and (not old.photo or old.photo != self.photo):
                        compute_needed = True
                    elif self.photo and not self.face_encoding:
                        compute_needed = True
            except Exception:
                pass
        else:
            if self.photo and not self.face_encoding:
                compute_needed = True

        super().save(*args, **kwargs)

        if compute_needed and self.photo:
            try:
                from .face_utils import compute_face_encoding
                import json
                encoding, _ = compute_face_encoding(self.photo.path)
                if encoding:
                    self.face_encoding = json.dumps(encoding)
                    Student.objects.filter(pk=self.pk).update(face_encoding=self.face_encoding)
                    try:
                        from detection.views import invalidate_known_faces
                        invalidate_known_faces()
                    except Exception:
                        pass
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Could not compute face encoding for student {self.name}: {e}")

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
