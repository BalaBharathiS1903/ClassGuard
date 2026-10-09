from django.contrib import admin
from .models import Student, Schedule


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    """Admin configuration for Student with useful list columns and filters."""

    list_display = ('name', 'grade', 'section', 'roll_number', 'is_face_encoded', 'parent', 'rfid_tag', 'created_at')
    list_filter = ('grade', 'section')
    search_fields = ('name', 'roll_number', 'rfid_tag')
    raw_id_fields = ('parent',)
    ordering = ('grade', 'section', 'roll_number')
    actions = ['recompute_face_encodings']

    @admin.display(boolean=True, description='Face Encoded')
    def is_face_encoded(self, obj):
        return bool(obj.face_encoding)

    @admin.action(description='Recompute face encodings from photo')
    def recompute_face_encodings(self, request, queryset):
        import json
        from .face_utils import compute_face_encoding
        try:
            from detection.views import invalidate_known_faces
        except ImportError:
            invalidate_known_faces = None

        success_count = 0
        fail_count = 0
        for student in queryset:
            if student.photo and hasattr(student.photo, 'path'):
                encoding, _ = compute_face_encoding(student.photo.path)
                if encoding:
                    student.face_encoding = json.dumps(encoding)
                    student.save(update_fields=['face_encoding'])
                    success_count += 1
                else:
                    fail_count += 1
            else:
                fail_count += 1

        if invalidate_known_faces:
            invalidate_known_faces()

        self.message_user(
            request,
            f"Processed {queryset.count()} students: {success_count} encoded, {fail_count} skipped/failed."
        )


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    """Admin configuration for Schedule with useful list columns and filters."""

    list_display = ('grade', 'section', 'period_number', 'subject', 'teacher', 'day_of_week', 'period_start', 'period_end')
    list_filter = ('grade', 'section', 'day_of_week', 'subject')
    search_fields = ('subject', 'grade', 'section')
    raw_id_fields = ('teacher',)
    ordering = ('grade', 'section', 'day_of_week', 'period_number')
