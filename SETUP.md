# ClassGuard — Setup Guide (Windows)

Complete step-by-step instructions to run ClassGuard on any Windows computer after cloning from GitHub.

## Prerequisites

- **Python 3.10+** — [Download](https://www.python.org/downloads/) (check "Add to PATH" during install)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **Git** — [Download](https://git-scm.com/)
- **Redis** (optional for dev) — [Download for Windows](https://github.com/microsoftarchive/redis/releases) or use Docker

> [!NOTE]
> Redis is optional for local development. Without it, WebSocket real-time alerts won't work across processes, but polling-based alerts and all other features will work normally.

## Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ClassGuard.git
cd ClassGuard
```

## Step 2: Backend Setup

### 2.1 Create a Python Virtual Environment

```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

### 2.2 Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

> [!TIP]
> On low-spec computers, `ultralytics` (includes PyTorch) takes time to install. Be patient.
> If PyTorch installation fails, install CPU-only version first:
> ```bash
> pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
> pip install -r requirements.txt
> ```

### 2.3 Create Environment Variables

```bash
copy .env.example .env
```

Then edit `.env` and generate a `SECRET_KEY`:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Copy the output and paste it as the `SECRET_KEY` value in `.env`.

### 2.4 Initialize the Database

```bash
python manage.py migrate
```

### 2.5 Create an Admin User

```bash
python manage.py createsuperuser
```

Follow the prompts to create a username, email, and password.

### 2.6 Download YOLO Model (First Time Only)

The YOLO model file (`yolov8n.pt`) is not included in GitHub due to its size. Download it:

```bash
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt'); print('YOLO model downloaded successfully!')"
```

This downloads ~6.5 MB to your backend directory.

### 2.7 Start the Backend Server

```bash
python manage.py runserver
```

The backend runs at `http://localhost:8000`.

### 2.8 Verify Backend Health

After logging in (Step 4), visit:
```
http://localhost:8000/api/v1/health/
```

Or from the command line (replace TOKEN with a valid JWT access token):
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/v1/health/
```

This shows the status of all subsystems: database, face cascades, YOLO model, registered faces, cameras, etc.

## Step 3: Frontend Setup

Open a **new terminal** (keep the backend running):

```bash
cd frontend_new
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

## Step 4: First-Time Login & Configuration

1. Open `http://localhost:5173` in Chrome or Edge
2. Log in with the superuser credentials created in Step 2.5
3. Navigate to **Cameras** → Click **"Scan Webcams"** to auto-detect your laptop camera
4. Navigate to **Students** → Add students (name, grade, section, roll number)
5. Navigate to **Face Registration** → Select a student and register their face using:
   - **Laptop Webcam** — capture live from your camera
   - **Upload Photo** — upload a clear frontal photo
   - **Backend Camera** — use a registered backend camera feed

## Step 5: Transferring Student Data from Another Computer

If you have existing student data on your main computer:

### Option A: Export/Import Database (Recommended)

On the **main computer**:
```bash
cd backend
python manage.py dumpdata school.Student --indent 2 > students_backup.json
```

Copy `students_backup.json` and the `backend/media/student_photos/` folder to the new computer.

On the **new computer**:
```bash
# Copy student_photos folder to backend/media/student_photos/
cd backend
python manage.py loaddata students_backup.json
```

> [!IMPORTANT]
> After importing, face encodings will be automatically recomputed from the photo files when the detection system starts.

### Option B: Re-register faces

Simply add students and register their faces through the Face Registration page.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Server crashes on startup | Missing `SECRET_KEY` | Create `.env` from `.env.example` and set `SECRET_KEY` |
| No faces recognized | No student face data | Register students with photos via Face Registration page |
| YOLO person detection not working | `yolov8n.pt` missing | Run: `python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"` |
| Camera not showing | No camera registered | Click "Scan Webcams" on Cameras page |
| No alerts appearing | No students registered | Add students and register faces first |
| Beep not playing | Browser autoplay policy | Click anywhere on the page first, then alerts will beep |
| WebSocket alerts not working | Redis not running | Install Redis, or leave `REDIS_URL` empty in `.env` for dev fallback |
| `pip install` fails on `dlib` | Missing build tools | Install Visual C++ Build Tools or use `pip install cmake dlib` |
| Slow startup | PyTorch/YOLO loading | Normal on first run; subsequent starts are faster |
| `cv2 has no attribute 'CascadeClassifier'` | OpenCV 5.0 or conflicting opencv packages | Run: `pip uninstall -y opencv-python opencv-python-headless opencv-contrib-python` followed by `pip install "opencv-python>=4.8.0,<5.0.0"` |
| Camera permission denied | Browser security | Use `http://localhost:5173` (not `http://127.0.0.1` or `0.0.0.0`) |

## Hardware Notes

- **Minimum**: 4 GB RAM, dual-core CPU, any webcam
- **Recommended**: 8 GB RAM, quad-core CPU
- **GPU**: Not required. All detection runs on CPU.
- **Camera**: USB webcams and built-in laptop cameras are supported.

The face detection uses OpenCV Haar cascades (CPU-optimized), and face recognition uses LBP histograms (pure NumPy). Both are lightweight and work on any hardware.

YOLO person detection is heavier but optional — if it fails to load, face detection and recognition still work independently.
