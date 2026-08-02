from django.db import models
from django.conf import settings
from school.models import Student

class Camera(models.Model):
    STATUS_CHOICES = (
        ('online', 'Online'),
        ('offline', 'Offline'),
        ('maintenance', 'Maintenance'),
    )
    ZONE_CHOICES = (
        ('classroom', 'Classroom'),
        ('hallway', 'Hallway'),
        ('exit', 'Exit'),
        ('playground', 'Playground'),
    )
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    rtsp_url = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='online')
    zone_type = models.CharField(max_length=20, choices=ZONE_CHOICES, default='hallway')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.location})"

class Alert(models.Model):
    TYPE_CHOICES = (
        ('roaming', 'Roaming'),
        ('exit', 'Exit'),
        ('unauthorized', 'Unauthorized Entry'),
        ('motion', 'Motion Detected'),
        ('recognition', 'Face Recognition'),
    )
    SEVERITY_CHOICES = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    )
    alert_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    description = models.TextField()
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True)
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE)
    snapshot = models.ImageField(upload_to='snapshots/', blank=True, null=True)
    is_resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.alert_type} - {self.camera.name}"

class Notification(models.Model):
    CHANNEL_CHOICES = (
        ('sms', 'SMS'),
        ('email', 'Email'),
        ('push', 'Push'),
        ('in_app', 'In-App'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    )
    alert = models.ForeignKey(Alert, on_delete=models.CASCADE)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    recipient = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.channel} to {self.recipient} - {self.status}"
