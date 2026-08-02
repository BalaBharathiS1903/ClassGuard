from django.contrib import admin
from .models import Student, Schedule


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    """Admin configuration for Student with useful list columns and filters."""

    list_display = ('name', 'grade', 'section', 'roll_number', 'parent', 'rfid_tag', 'created_at')
    list_filter = ('grade', 'section')
    search_fields = ('name', 'roll_number', 'rfid_tag')
    raw_id_fields = ('parent',)
    ordering = ('grade', 'section', 'roll_number')


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    """Admin configuration for Schedule with useful list columns and filters."""

    list_display = ('grade', 'section', 'period_number', 'subject', 'teacher', 'day_of_week', 'period_start', 'period_end')
    list_filter = ('grade', 'section', 'day_of_week', 'subject')
    search_fields = ('subject', 'grade', 'section')
    raw_id_fields = ('teacher',)
    ordering = ('grade', 'section', 'day_of_week', 'period_number')
