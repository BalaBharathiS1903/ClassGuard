from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin configuration for the custom User model with role, phone, fcm_token."""

    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'phone', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email', 'first_name', 'last_name', 'phone')
    ordering = ('username',)

    # Add custom fields to the "Personal info" section of the edit form
    fieldsets = BaseUserAdmin.fieldsets + (
        ('ClassGuard Info', {
            'fields': ('role', 'phone', 'fcm_token'),
        }),
    )

    # Add custom fields to the "Add user" form
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('ClassGuard Info', {
            'fields': ('role', 'phone'),
        }),
    )
