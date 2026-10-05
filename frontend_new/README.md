# ClassGuard Frontend (`frontend_new`)

The modern React dashboard interface for the ClassGuard AI-powered school security monitoring platform.

## Features

- **Teacher Dashboard**: Live camera feeds, system health telemetry, recent alerts, and student profile inspection modals.
- **Multi-Camera Management**: Live viewing with webcam autodetection (`/api/v1/scan-webcams/`).
- **Face Registration**: Instant face detection during student enrollment with browser FaceDetector API & OpenCV server fallback.
- **Alert Dispatch & Routing**: Audio-visual notifications, alert escalation, and smart routing to active teachers via Twilio.
- **Staff & Student Management**: Profile browsing, real-time search, and CSV bulk import.

## Tech Stack

- **Framework**: React 19 + Vite
- **Routing**: React Router 7 (`react-router-dom`)
- **Icons**: Lucide React
- **Styling**: Pure CSS Modules & CSS Variables

## Getting Started

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

By default, the Vite dev server runs at `http://localhost:5173` and proxies API requests (`/api` and `/ws`) to `http://localhost:8000`.

### Production Build

```bash
npm run build
```

The output files are generated in `dist/`.

### Testing

```bash
npm run test
```

## Docker Container

The frontend Dockerfile uses a multi-stage build:
1. `node:20-alpine` builds the Vite production bundle.
2. `nginxinc/nginx-unprivileged:alpine` serves the static bundle on port `8080` with SPA routing and cache headers.
