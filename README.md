# ClassGuard

**AI-Powered School Security & Attendance Monitoring System**

ClassGuard is an enterprise-grade real-time security and student monitoring platform designed for schools and educational campuses. It combines real-time computer vision (Ultralytics YOLOv8 & OpenCV), multi-webcam hardware integration, face recognition, class timetable intelligence, and automated alert dispatch via Twilio (WhatsApp & SMS).

---

## Table of Contents

- [Key Features](#key-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Docker Deployment](#docker-deployment)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [Creating a Superuser in Docker](#creating-a-superuser-in-docker)
  - [Production SSL Setup](#production-ssl-setup)
- [Admin Management Dashboard](#admin-management-dashboard)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Key Features

- **Multi-Camera Browser & RTSP Feeds**: Connect and monitor multiple webcams simultaneously directly inside the browser, with backend hardware discovery via `/api/v1/scan-webcams/`.
- **YOLOv8 Person & Object Detection**: Real-time bounding boxes and confidence scores identify individuals across monitored zones.
- **Biometric Face Verification**:
  - Validates face presence during student enrollment with browser `FaceDetector` API and server-side OpenCV Haar Cascade fallback (`/api/v1/detect-face/`).
  - Matches detected individuals against registered student encodings with histogram equalization and template correlation.
- **Context-Aware Smart Alert Routing**:
  - Automatically identifies which teacher is currently assigned to a student's class section based on the real-time school timetable schedule.
  - Automatically routes unauthorized out-of-class roaming alerts directly to the responsible teacher.
- **Twilio Multi-Channel Dispatch**: Forward critical incidents and snapshots to teachers or security staff via WhatsApp and SMS with a single click.
- **Staff & Student Directory**: Full profile administration, individual photo registration, and bulk CSV importing for rapid student and staff onboarding.
- **Modern React Dashboard**: Responsive glassmorphism interface with instant audio-visual popup modals for face recognition alerts.
- **Production-Ready Containerization**: Docker Compose stack orchestrating Daphne (ASGI), React (Nginx), PostgreSQL, Redis, Celery, and an Nginx reverse proxy.

---

## Architecture & Tech Stack

| Layer | Technologies |
| --- | --- |
| **Backend Framework** | Python 3.11+, Django 5.x, Django REST Framework (DRF) |
| **ASGI & WebSockets** | Daphne, Django Channels 4.x, Channels-Redis |
| **Computer Vision** | OpenCV Headless, Ultralytics YOLOv8 |
| **Task Queue & Cache** | Celery, Redis |
| **Database** | SQLite (development), PostgreSQL 15 (production/Docker) |
| **Authentication** | JSON Web Tokens (`djangorestframework-simplejwt`), bcrypt |
| **Frontend Framework** | React 19, Vite, React Router 7, Lucide React icons |
| **Reverse Proxy & Gateway** | Nginx, WhiteNoise |
| **Alert Notifications** | Twilio REST API (WhatsApp & SMS) |
| **Containerization** | Docker, Docker Compose |

---

## Prerequisites

- **Python**: Version 3.11 or higher
- **Node.js**: Version 18.x or 20.x+ (LTS)
- **Git**
- **Docker & Docker Compose** (Optional, for containerized deployments)

---

## Local Development Setup

### Backend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/classguard.git
   cd classguard/backend
   ```

2. **Create and activate a virtual environment**:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Create a `.env` file in `backend/` (or copy from `.env.example`):
   ```ini
   SECRET_KEY=your-secure-random-secret-key
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   REDIS_URL=redis://localhost:6379/0
   
   # Optional: Twilio Configuration
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_WHATSAPP_NUMBER=+14155238886
   TWILIO_PHONE_NUMBER=+1234567890
   ```

5. **Apply database migrations**:
   ```bash
   python manage.py migrate
   ```

6. **Create an administrator user**:
   ```bash
   python manage.py createsuperuser
   ```

7. **Start the Django development server**:
   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```
   - Backend API: `http://127.0.0.1:8000/api/v1/`
   - Admin Panel: `http://127.0.0.1:8000/admin/`

---

### Frontend Setup

1. **Open a new terminal and navigate to the frontend directory**:
   ```bash
   cd classguard/frontend_new
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Start the Vite dev server**:
   ```bash
   npm run dev
   ```
   - Frontend Dashboard: `http://localhost:5173`

The frontend automatically proxies API calls to `http://localhost:8000` via Vite's built-in development proxy.

---

## Docker Deployment

The repository includes a ready-to-run multi-container Docker Compose configuration featuring Nginx, Daphne ASGI, React SPA, PostgreSQL, Redis, and Celery.

### Quick Start with Docker

You can launch the entire stack directly from the repository root:

```bash
# 1. Build and start all services in the background
docker compose up -d --build

# 2. Check running container status
docker compose ps

# 3. View live consolidated logs
docker compose logs -f
```

The application will be live at:
- **Web Dashboard**: `http://localhost`
- **Django Admin Panel**: `http://localhost/admin/`
- **REST API**: `http://localhost/api/v1/`

### Creating a Superuser in Docker

After spinning up the containers for the first time, create your initial administrative user:

```bash
docker compose exec backend python manage.py createsuperuser
```

### Stopping Services

```bash
# Stop containers without removing persistent data
docker compose down

# Stop containers and remove volumes
docker compose down -v
```

### Production SSL Setup

For production deployments with HTTPS:
1. Place your valid certificates in `infra/nginx/ssl/`:
   - `fullchain.pem`
   - `privkey.pem`
2. Replace `infra/nginx/default.conf` with `infra/nginx/nginx.ssl.conf.template`.
3. In `docker-compose.yml`, expose port `443:443` on the `nginx` service.
4. Restart Nginx: `docker compose restart nginx`.

---

## Admin Management Dashboard

ClassGuard includes a custom-branded Django administration portal accessible at `/admin/`.

| Section | Model | Capabilities |
| --- | --- | --- |
| **Accounts** | `User` | Role management (Teacher, Principal, Parent), phone number, and push token tracking. |
| **School** | `Student` | Student profiles, roll numbers, registered face encodings, and parent linkage. |
| **School** | `Schedule` | Class schedules mapping grades, sections, day of week, periods, and assigned teachers. |
| **School** | `Staff` | Staff directory, emergency contact phone numbers, and notification records. |
| **Detection** | `Camera` | Monitored locations, RTSP stream URLs, zone tags, and online/offline status. |
| **Detection** | `Alert` | Security incidents with severity levels, alert types, snapshots, and resolution audit log. |
| **Detection** | `Notification` | Dispatch status audit log for SMS, email, and WhatsApp notifications. |

---

## API Reference

All REST endpoints are prefixed with `/api/v1/`.

| Endpoint | Method | Description | Auth Required |
| --- | --- | --- | --- |
| `/api/v1/auth/login/` | `POST` | Authenticate user and obtain JWT access & refresh tokens | No |
| `/api/v1/auth/refresh/` | `POST` | Refresh expired access token | No |
| `/api/v1/auth/users/me/` | `GET` | Retrieve authenticated user profile | Yes |
| `/api/v1/students/` | `GET`, `POST` | List or create student records | Yes |
| `/api/v1/students/bulk_upload/` | `POST` | Bulk upload students from CSV file | Yes |
| `/api/v1/staff/` | `GET`, `POST` | List or register school staff members | Yes |
| `/api/v1/staff/<id>/send_alert/` | `POST` | Send direct Twilio SMS/WhatsApp alert to a staff member | Yes |
| `/api/v1/staff/bulk_upload/` | `POST` | Bulk upload staff members from CSV file | Yes |
| `/api/v1/schedules/` | `GET`, `POST` | Manage timetable periods and teacher assignments | Yes |
| `/api/v1/cameras/` | `GET`, `POST` | List or add camera endpoints | Yes |
| `/api/v1/scan-webcams/` | `POST` | Probe and register connected local hardware webcams | Yes |
| `/api/v1/detect-face/` | `POST` | Server-side face validation for image uploads | Yes |
| `/api/v1/video_feed/<camera_id>/` | `GET` | MJPEG video streaming feed with bounding overlays | Yes |
| `/api/v1/alerts/` | `GET`, `POST` | List or record detection alerts | Yes |
| `/api/v1/alerts/<id>/forward/` | `POST` | Forward alert to staff or smart-route to current teacher | Yes |
| `/api/v1/notifications/` | `GET` | View alert notification history | Yes |
| `/ws/alerts/` | `WebSocket` | Real-time live alert stream | Yes |

---

## Project Structure

```
classguard/
├── backend/
│   ├── accounts/             # User models, authentication views, serializers, admin
│   ├── core/                 # Django settings, ASGI/WSGI config, Celery setup, root URLs
│   ├── detection/            # Cameras, YOLOv8 detection, alerts, WebSockets, streaming
│   ├── school/               # Students, Schedules, Staff models, face encodings, CSV upload
│   ├── entrypoint.sh         # Docker startup script (auto-migrations & static collection)
│   ├── Dockerfile            # Production Python 3.11 container with OpenCV & YOLO dependencies
│   ├── manage.py             # Django CLI entrypoint
│   └── requirements.txt      # Python dependencies
├── frontend_new/
│   ├── src/
│   │   ├── assets/           # Logos, branding graphics, and UI imagery
│   │   ├── components/       # AlertCard, Sidebar, Toast, WebcamFeed components
│   │   ├── hooks/            # useWebcam, useDeviceList custom hooks
│   │   ├── pages/            # Dashboard, Cameras, Alerts, Students, Staff, FaceRegistration, Login
│   │   ├── styles/           # CSS modules and design system
│   │   ├── utils/            # authFetch JWT wrapper, faceDetection helpers
│   │   ├── App.jsx           # Main router & authentication guards
│   │   └── main.jsx          # React DOM entry point
│   ├── Dockerfile            # Multi-stage Node.js build & Nginx unprivileged runtime
│   ├── package.json          # Node dependencies & build scripts
│   └── vite.config.js        # Vite build & reverse proxy configuration
├── infra/
│   ├── nginx/
│   │   ├── default.conf      # Reverse proxy gateway configuration
│   │   ├── nginx.ssl.conf.template # Production TLS reverse proxy template
│   │   └── ssl/              # Directory for SSL certificates (fullchain.pem, privkey.pem)
│   ├── docker-compose.yml    # Infrastructure compose configuration
│   └── .env.example          # Environment variable template for Docker
├── docs/                     # Architecture and schema documentation
├── docker-compose.yml        # Root convenience Docker Compose configuration
└── README.md                 # Primary project documentation
```

---

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | *(Required)* | Django cryptographic signing key |
| `DEBUG` | `False` | Toggle Django debugging mode |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Permitted hostnames |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins for CORS |
| `DATABASE_URL` | SQLite / PostgreSQL | Database connection URL |
| `REDIS_URL` | `redis://localhost:6379/0` | Cache and Celery broker connection string |
| `TWILIO_ACCOUNT_SID` | `""` | Twilio Account SID for messaging |
| `TWILIO_AUTH_TOKEN` | `""` | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | `""` | Twilio Sandbox or approved WhatsApp number |
| `TWILIO_PHONE_NUMBER` | `""` | Twilio outbound SMS phone number |

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
