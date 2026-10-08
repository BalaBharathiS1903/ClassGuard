from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# ClassGuard admin branding
admin.site.site_header = 'St. James Academy - ClassGuard Administration'
admin.site.site_title = 'St. James Academy Admin'
admin.site.index_title = 'St. James Academy Security Dashboard'

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/', include('school.urls')),
    path('api/v1/', include('detection.urls')),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
