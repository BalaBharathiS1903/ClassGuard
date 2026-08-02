from django.contrib import admin
from .models import Camera, Alert, Notification


@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    """Admin configuration for Camera with useful list columns and filters."""

    list_display = ('name', 'location', 'zone_type', 'status', 'is_active', 'created_at')
    list_filter = ('status', 'zone_type', 'is_active')
    search_fields = ('name', 'location', 'rtsp_url')
    ordering = ('name',)


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    """Admin configuration for Alert with useful list columns and filters."""

    list_display = ('id', 'alert_type', 'severity', 'camera', 'student', 'is_resolved', 'created_at')
    list_filter = ('alert_type', 'severity', 'is_resolved')
    search_fields = ('description', 'camera__name', 'student__name')
    raw_id_fields = ('camera', 'student', 'resolved_by')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin configuration for Notification with useful list columns and filters."""

    list_display = ('id', 'alert', 'channel', 'recipient', 'status', 'sent_at', 'created_at')
    list_filter = ('channel', 'status')
    search_fields = ('recipient',)
    raw_id_fields = ('alert',)
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
