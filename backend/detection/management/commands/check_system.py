"""
Management command: python manage.py check_system

Runs a comprehensive diagnostic check on the ClassGuard system.
Use this after cloning the repository to verify everything is set up correctly.
"""
import os
import sys
import platform
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Run a comprehensive system diagnostic check for ClassGuard'

    def handle(self, *args, **options):
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write('  ClassGuard System Diagnostics')
        self.stdout.write('=' * 60)

        all_ok = True

        # 1. Python version
        py_ver = platform.python_version()
        self.stdout.write(f'\n[1/8] Python Version: {py_ver}')
        if sys.version_info < (3, 10):
            self.stdout.write(self.style.WARNING('  ⚠  Python 3.10+ recommended'))
        else:
            self.stdout.write(self.style.SUCCESS('  ✓  OK'))

        # 2. OpenCV + Haar cascades
        self.stdout.write(f'\n[2/8] OpenCV & Face Cascades:')
        try:
            import cv2
            self.stdout.write(f'  OpenCV version: {cv2.__version__}')
            from school.face_utils import get_face_cascades
            cascades = get_face_cascades()
            if cascades:
                self.stdout.write(self.style.SUCCESS(f'  ✓  Loaded cascades: {list(cascades.keys())}'))
            else:
                self.stdout.write(self.style.ERROR('  ✗  MODEL_ERROR: No face cascades found!'))
                self.stdout.write('     Fix: pip uninstall -y opencv-python opencv-python-headless')
                self.stdout.write('          pip install "opencv-python>=4.8.0,<5.0.0"')
                all_ok = False
        except ImportError as e:
            self.stdout.write(self.style.ERROR(f'  ✗  OpenCV not installed: {e}'))
            all_ok = False

        # 3. NumPy
        self.stdout.write(f'\n[3/8] NumPy:')
        try:
            import numpy as np
            self.stdout.write(self.style.SUCCESS(f'  ✓  NumPy {np.__version__}'))
        except ImportError:
            self.stdout.write(self.style.ERROR('  ✗  NumPy not installed'))
            all_ok = False

        # 4. YOLO model
        self.stdout.write(f'\n[4/8] YOLO Model (yolov8n.pt):')
        model_path = os.path.join(settings.BASE_DIR, 'yolov8n.pt')
        if os.path.exists(model_path):
            size_mb = os.path.getsize(model_path) / (1024 * 1024)
            self.stdout.write(self.style.SUCCESS(f'  ✓  Found ({size_mb:.1f} MB)'))
        else:
            self.stdout.write(self.style.WARNING('  ⚠  MODEL_ERROR: yolov8n.pt not found'))
            self.stdout.write('     Person detection will be disabled.')
            self.stdout.write('     Fix: python -c "from ultralytics import YOLO; YOLO(\'yolov8n.pt\')"')

        # 5. Database
        self.stdout.write(f'\n[5/8] Database:')
        try:
            from django.db import connection
            connection.ensure_connection()
            engine = settings.DATABASES['default']['ENGINE']
            self.stdout.write(self.style.SUCCESS(f'  ✓  Connected ({engine.split(".")[-1]})'))

            from school.models import Student
            total_students = Student.objects.count()
            with_photos = Student.objects.filter(photo__isnull=False).exclude(photo='').count()
            with_encoding = Student.objects.exclude(face_encoding__isnull=True).exclude(face_encoding='').count()
            self.stdout.write(f'  Students: {total_students} total, {with_photos} with photos, {with_encoding} with face encodings')

            if total_students == 0:
                self.stdout.write(self.style.WARNING('  ⚠  No students registered. Add students and register faces.'))
            elif with_encoding == 0:
                self.stdout.write(self.style.WARNING('  ⚠  FACE_DATA_ERROR: No face encodings. Register faces via the Face Registration page.'))
            else:
                self.stdout.write(self.style.SUCCESS(f'  ✓  {with_encoding} face encoding(s) available for recognition'))

            from detection.models import Camera
            cameras = Camera.objects.count()
            online = Camera.objects.filter(status='online').count()
            self.stdout.write(f'  Cameras: {cameras} total, {online} online')
            if cameras == 0:
                self.stdout.write(self.style.WARNING('  ⚠  CAMERA_ERROR: No cameras registered. Use "Scan Webcams" in the app.'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ✗  Database error: {e}'))
            self.stdout.write('     Run: python manage.py migrate')
            all_ok = False

        # 6. Redis
        self.stdout.write(f'\n[6/8] Redis / Channel Layer:')
        redis_url = os.environ.get('REDIS_URL', '').strip()
        if redis_url:
            try:
                import redis
                r = redis.from_url(redis_url)
                r.ping()
                self.stdout.write(self.style.SUCCESS(f'  ✓  Redis connected at {redis_url}'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  ⚠  Redis not reachable: {e}'))
                self.stdout.write('     WebSocket alerts may not work. Set REDIS_URL= (empty) for dev fallback.')
        else:
            self.stdout.write(self.style.WARNING('  ⚠  REDIS_URL not set — using InMemoryChannelLayer (dev only)'))

        # 7. Media directory
        self.stdout.write(f'\n[7/8] Media Directory:')
        media_root = settings.MEDIA_ROOT
        if os.path.isdir(media_root):
            photos_dir = os.path.join(media_root, 'student_photos')
            photo_count = len(os.listdir(photos_dir)) if os.path.isdir(photos_dir) else 0
            self.stdout.write(self.style.SUCCESS(f'  ✓  {media_root} exists'))
            self.stdout.write(f'  Student photos on disk: {photo_count}')
        else:
            self.stdout.write(self.style.WARNING(f'  ⚠  {media_root} does not exist (will be created on first upload)'))

        # 8. Environment
        self.stdout.write(f'\n[8/8] Environment:')
        env_file = os.path.join(settings.BASE_DIR, '.env')
        if os.path.exists(env_file):
            self.stdout.write(self.style.SUCCESS('  ✓  .env file found'))
        else:
            self.stdout.write(self.style.ERROR('  ✗  .env file missing!'))
            self.stdout.write('     Copy .env.example to .env and set SECRET_KEY')
            all_ok = False

        debug = settings.DEBUG
        self.stdout.write(f'  DEBUG = {debug}')

        # Summary
        self.stdout.write('\n' + '=' * 60)
        if all_ok:
            self.stdout.write(self.style.SUCCESS('  ✓  All critical checks passed!'))
        else:
            self.stdout.write(self.style.ERROR('  ✗  Some checks failed. See above for details.'))
        self.stdout.write('=' * 60 + '\n')
