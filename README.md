# ClassGuard

**AI-Powered School Security Monitoring System**

ClassGuard is a real-time security monitoring platform designed for educational institutions. It leverages computer vision (YOLOv8) and intelligent movement analysis to detect threats, manage alerts, and deliver instant notifications to teachers, principals, and parents.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Admin Panel](#admin-panel)
- [Demo Accounts](#demo-accounts)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Color Palette](#color-palette)
- [License](#license)

---

## Features

- **Multi-Camera Browser Webcams**: Support for displaying multiple connected cameras simultaneously via browser APIs
- **Face Validation**: Enforced face detection during student registration with OpenCV fallback
- **Audio-Visual Alerts**: Centered popups with full student detail cards and repeating beep notifications
- Real-time camera feed monitoring with live WebSocket streams
- YOLOv8-based object and person detection
- Intelligent movement analysis and anomaly scoring
- Multi-channel alert pipeline (in-app, email, SMS, push)
- Role-based dashboards for teachers, principals, and parents
- Configurable alert thresholds and zones
- Class schedule integration for context-aware detection
- Snapshot capture and cloud storage (S3 / MinIO)
- Celery-powered async task processing
- Full audit logging and alert history
- Responsive, mobile-friendly interface
- Docker-ready deployment with Nginx reverse proxy

---

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Backend        | Python 3.11, Django, Django REST    |
| Frontend       | React 19, Vite, React Router        |
| Database       | SQLite (dev), PostgreSQL (prod)     |
| ORM            | Django ORM                          |
| Task Queue     | Celery + Redis                      |
| Object Storage | MinIO / AWS S3                      |
| Detection      | OpenCV, Ultralytics YOLOv8          |
| Auth           | JWT (Simple JWT), bcrypt            |
| Notifications  | Twilio (SMS), SMTP (email), FCM     |
| Reverse Proxy  | Nginx                               |
| Containers     | Docker, Docker Compose              |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Redis (optional for development — only required for Celery tasks)

---

## Quick Start

### Backend

```bash
# Clone the repository
git clone https://github.com/your-org/classguard.git
cd classguard

# Create and activate a virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
.\venv\Scripts\Activate.ps1
# macOS / Linux
source venv/bin/activate

# Install dependencies
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run database migrations
python manage.py makemigrations
python manage.py migrate

# Collect static files (required for admin CSS/JS)
python manage.py collectstatic --noinput

# Create a superuser for the Admin panel
python manage.py createsuperuser

# Start the development server
python manage.py runserver 0.0.0.0:8000
```

The API will be available at `http://localhost:8000`. 
The Admin panel is available at `http://localhost:8000/admin/`.

### Frontend

```bash
# In a separate terminal
cd frontend_new

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## Docker Deployment

```bash
# Navigate to the infrastructure directory
cd infra

# Build and start all services
docker compose up -d --build

# Verify services are running
docker compose ps

# View logs
docker compose logs -f
```

Services started by Docker Compose:

| Service        | Port | Description                     |
| -------------- | ---- | ------------------------------- |
| nginx          | 8080 | Reverse proxy (entry point)     |
| backend        | 8000 | Django application (Daphne)     |
| frontend       | 80   | React production build          |
| redis          | 6379 | Message broker and cache        |
| celery-worker  | --   | Async task processor            |

---

## Admin Panel

The Django Admin panel provides a rich management interface for all ClassGuard models. Access it at `http://localhost:8000/admin/` after creating a superuser.

### Available Models

| Section        | Models                                    | Features                                      |
| -------------- | ----------------------------------------- | --------------------------------------------- |
| **Accounts**   | Users                                     | Role, phone, FCM token; filter by role/status |
| **School**     | Students, Schedules                       | Filter by grade/section, search by name/roll  |
| **Detection**  | Cameras, Alerts, Notifications            | Filter by severity/status/type, search        |

### Admin Features

- **ClassGuard branding** — Custom header and title instead of default "Django administration"
- **List views** — All models show relevant columns (name, status, severity, timestamps, etc.)
- **Filters** — Sidebar filters for role, grade, severity, status, alert type, etc.
- **Search** — Search bars on all models for quick lookup
- **Ordering** — Alerts sorted newest-first; students by grade/section

---

## Demo Accounts

The following accounts can be accessed via the Django Admin Panel (`/admin/`) by logging in with the superuser account you created.

---

## Project Structure

```
classguard/
  backend/
    core/                   -- Django project settings, urls, wsgi, asgi, celery
    accounts/               -- User models, auth APIs, custom admin
    school/                 -- Student, Schedule models, APIs, admin
    detection/              -- Cameras, Alerts, YOLO tasks, WebSockets, admin
    manage.py               -- Django entry point
    requirements.txt
    Dockerfile
  frontend_new/
    src/
      components/           -- Reusable UI components (Sidebar, AlertCard)
      pages/                -- Route-level page components (Login, Dashboard)
      __tests__/            -- Component and page tests
      styles/               -- CSS variables and global styles
      assets/               -- Static assets (icons, images)
      App.jsx
      main.jsx
    public/
    vite.config.js
    Dockerfile
  infra/
    docker-compose.yml
    nginx/
      default.conf
  docs/
    ARCHITECTURE.md
    DB_SCHEMA.md
    API_REFERENCE.md
  README.md
```

---

## API Documentation

Detailed API documentation is available in [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md).

### Quick Reference

| Endpoint                  | Method | Description              |
| ------------------------- | ------ | ------------------------ |
| `/api/v1/auth/login/`     | POST   | Obtain JWT tokens        |
| `/api/v1/auth/refresh/`   | POST   | Refresh access token     |
| `/api/v1/auth/users/me/`  | GET    | Current user profile     |
| `/api/v1/students/`       | CRUD   | Student management       |
| `/api/v1/schedules/`      | CRUD   | Schedule management      |
| `/api/v1/cameras/`        | CRUD   | Camera management        |
| `/api/v1/alerts/`         | CRUD   | Alert management         |
| `/api/v1/notifications/`  | CRUD   | Notification management  |
| `ws://host/ws/alerts/`    | WS     | Real-time alert stream   |

---

## Color Palette

| Name        | Hex       | Usage                                |
| ----------- | --------- | ------------------------------------ |
| Light Gray  | `#DDDCDB` | Backgrounds, cards, neutral surfaces |
| Orange      | `#FD7B41` | Primary actions, alerts, accents     |
| Peach       | `#EDBF9B` | Secondary highlights, hover states   |
| Charcoal    | `#3C4044` | Text, headers, dark UI elements      |

---

## License

This project is licensed under the MIT License.
# ClassGuard
