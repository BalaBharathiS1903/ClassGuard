# API Reference

Complete REST API reference for the ClassGuard backend. All endpoints are prefixed with `/api/v1` unless otherwise noted.

Base URL: `http://localhost:8000/api/v1`

---

## Table of Contents

- [Authentication](#authentication)
- [Error Response Format](#error-response-format)
- [Endpoints](#endpoints)
  - [Auth](#auth)
  - [Students](#students)
  - [Teachers](#teachers)
  - [Parents](#parents)
  - [Cameras](#cameras)
  - [Schedules](#schedules)
  - [Alerts](#alerts)
  - [Notifications](#notifications)
- [WebSocket](#websocket)

---

## Authentication

All endpoints except `POST /auth/login` and `GET /health` require a valid JWT bearer token.

Include the token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens are obtained via the login endpoint and expire after the configured `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30 minutes).

---

## Error Response Format

All error responses follow a consistent JSON structure:

```json
{
  "detail": "Human-readable error message",
  "status_code": 400,
  "error_type": "validation_error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

| Field       | Type   | Description                                       |
| ----------- | ------ | ------------------------------------------------- |
| detail      | string | Summary of the error                              |
| status_code | int    | HTTP status code                                  |
| error_type  | string | Machine-readable error category                   |
| errors      | array  | Field-level validation errors (when applicable)   |

### Common HTTP Status Codes

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| 200  | Success                                      |
| 201  | Created                                      |
| 204  | No Content (successful delete)               |
| 400  | Bad Request (validation error)               |
| 401  | Unauthorized (missing or invalid token)      |
| 403  | Forbidden (insufficient permissions)         |
| 404  | Not Found                                    |
| 409  | Conflict (duplicate resource)                |
| 422  | Unprocessable Entity (schema validation)     |
| 500  | Internal Server Error                        |

---

## Endpoints

### Auth

#### POST /auth/login

Authenticate a user and receive an access token.

- **Auth Required**: No

**Request Body**:

```json
{
  "email": "teacher@classguard.com",
  "password": "teacher123"
}
```

**Response** (200):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "teacher@classguard.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "role": "teacher"
  }
}
```

---

#### POST /auth/refresh

Refresh an expiring access token.

- **Auth Required**: Yes

**Response** (200):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

---

#### GET /auth/me

Get the current authenticated user's profile.

- **Auth Required**: Yes

**Response** (200):

```json
{
  "id": 1,
  "email": "teacher@classguard.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "role": "teacher",
  "phone": "+1234567890",
  "is_active": true,
  "created_at": "2025-01-15T10:30:00Z"
}
```

---

### Students

#### GET /students

List all students. Supports filtering and pagination.

- **Auth Required**: Yes
- **Roles**: Teacher, Principal

**Query Parameters**:

| Parameter | Type   | Default | Description                    |
| --------- | ------ | ------- | ------------------------------ |
| page      | int    | 1       | Page number                    |
| per_page  | int    | 20      | Items per page (max: 100)      |
| grade     | string | --      | Filter by grade (e.g., "10-A") |
| search    | string | --      | Search by name                 |
| is_active | bool   | true    | Filter by active status        |

**Response** (200):

```json
{
  "items": [
    {
      "id": 1,
      "first_name": "Alex",
      "last_name": "Johnson",
      "grade": "10-A",
      "parent_id": 3,
      "photo_url": "https://s3.example.com/photos/alex.jpg",
      "is_active": true,
      "created_at": "2025-01-10T08:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 20,
  "pages": 8
}
```

---

#### GET /students/{id}

Get a single student by ID.

- **Auth Required**: Yes
- **Roles**: Teacher, Principal, Parent (own children only)

**Response** (200):

```json
{
  "id": 1,
  "first_name": "Alex",
  "last_name": "Johnson",
  "grade": "10-A",
  "parent_id": 3,
  "photo_url": "https://s3.example.com/photos/alex.jpg",
  "is_active": true,
  "created_at": "2025-01-10T08:00:00Z",
  "updated_at": "2025-01-10T08:00:00Z"
}
```

---

#### POST /students

Create a new student record.

- **Auth Required**: Yes
- **Roles**: Principal

**Request Body**:

```json
{
  "first_name": "Alex",
  "last_name": "Johnson",
  "grade": "10-A",
  "parent_id": 3,
  "photo_url": "https://s3.example.com/photos/alex.jpg"
}
```

**Response** (201): Returns the created student object.

---

#### PUT /students/{id}

Update an existing student record.

- **Auth Required**: Yes
- **Roles**: Principal

**Request Body**: Same schema as POST (all fields optional).

**Response** (200): Returns the updated student object.

---

#### DELETE /students/{id}

Soft-delete a student (sets is_active to false).

- **Auth Required**: Yes
- **Roles**: Principal

**Response** (204): No content.

---

### Teachers

#### GET /teachers

List all teachers.

- **Auth Required**: Yes
- **Roles**: Principal

**Query Parameters**:

| Parameter | Type   | Default | Description             |
| --------- | ------ | ------- | ----------------------- |
| page      | int    | 1       | Page number             |
| per_page  | int    | 20      | Items per page          |
| role      | string | --      | Filter by role          |
| search    | string | --      | Search by name or email |
| is_active | bool   | true    | Filter by active status |

**Response** (200): Paginated list of teacher objects (same structure as students).

---

#### GET /teachers/{id}

Get a single teacher by ID.

- **Auth Required**: Yes
- **Roles**: Principal, Teacher (own profile only)

**Response** (200):

```json
{
  "id": 1,
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "teacher@classguard.com",
  "role": "teacher",
  "phone": "+1234567890",
  "is_active": true,
  "created_at": "2025-01-05T09:00:00Z",
  "updated_at": "2025-01-05T09:00:00Z"
}
```

---

#### POST /teachers

Create a new teacher account.

- **Auth Required**: Yes
- **Roles**: Principal

**Request Body**:

```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@school.edu",
  "password": "securepassword123",
  "role": "teacher",
  "phone": "+1234567890"
}
```

**Response** (201): Returns the created teacher object (password excluded).

---

#### PUT /teachers/{id}

Update a teacher profile.

- **Auth Required**: Yes
- **Roles**: Principal, Teacher (own profile only)

**Request Body**: Same schema as POST (all fields optional, password change requires current_password).

**Response** (200): Returns the updated teacher object.

---

#### DELETE /teachers/{id}

Soft-delete a teacher account.

- **Auth Required**: Yes
- **Roles**: Principal

**Response** (204): No content.

---

### Parents

#### GET /parents

List all parents.

- **Auth Required**: Yes
- **Roles**: Principal

**Query Parameters**:

| Parameter | Type   | Default | Description             |
| --------- | ------ | ------- | ----------------------- |
| page      | int    | 1       | Page number             |
| per_page  | int    | 20      | Items per page          |
| search    | string | --      | Search by name or email |

**Response** (200): Paginated list of parent objects.

---

#### GET /parents/{id}

Get a single parent by ID.

- **Auth Required**: Yes
- **Roles**: Principal, Parent (own profile only)

**Response** (200):

```json
{
  "id": 3,
  "first_name": "Robert",
  "last_name": "Johnson",
  "email": "robert.johnson@email.com",
  "phone": "+1987654321",
  "notify_email": true,
  "notify_sms": false,
  "notify_push": true,
  "is_active": true,
  "created_at": "2025-01-08T11:00:00Z",
  "children": [
    {
      "id": 1,
      "first_name": "Alex",
      "last_name": "Johnson",
      "grade": "10-A"
    }
  ]
}
```

---

#### POST /parents

Create a new parent account.

- **Auth Required**: Yes
- **Roles**: Principal

**Request Body**:

```json
{
  "first_name": "Robert",
  "last_name": "Johnson",
  "email": "robert.johnson@email.com",
  "password": "securepassword123",
  "phone": "+1987654321",
  "notify_email": true,
  "notify_sms": false,
  "notify_push": false
}
```

**Response** (201): Returns the created parent object (password excluded).

---

#### PUT /parents/{id}

Update a parent profile or notification preferences.

- **Auth Required**: Yes
- **Roles**: Principal, Parent (own profile only)

**Response** (200): Returns the updated parent object.

---

#### DELETE /parents/{id}

Soft-delete a parent account.

- **Auth Required**: Yes
- **Roles**: Principal

**Response** (204): No content.

---

### Cameras

#### GET /cameras

List all cameras.

- **Auth Required**: Yes
- **Roles**: Teacher (assigned cameras only), Principal (all cameras)

**Query Parameters**:

| Parameter  | Type   | Default | Description                  |
| ---------- | ------ | ------- | ---------------------------- |
| page       | int    | 1       | Page number                  |
| per_page   | int    | 20      | Items per page               |
| is_active  | bool   | --      | Filter by active status      |
| zone_type  | string | --      | Filter by zone type          |
| teacher_id | int    | --      | Filter by assigned teacher   |

**Response** (200):

```json
{
  "items": [
    {
      "id": 1,
      "name": "Main Entrance",
      "location": "Building A, Ground Floor",
      "stream_url": "rtsp://192.168.1.100:554/stream",
      "teacher_id": 1,
      "is_active": true,
      "confidence_threshold": 0.6,
      "zone_type": "entrance",
      "created_at": "2025-01-05T08:00:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "per_page": 20,
  "pages": 1
}
```

---

#### GET /cameras/{id}

Get a single camera by ID.

- **Auth Required**: Yes
- **Roles**: Teacher (if assigned), Principal

**Response** (200): Returns the camera object.

---

#### POST /cameras

Register a new camera.

- **Auth Required**: Yes
- **Roles**: Principal

**Request Body**:

```json
{
  "name": "Main Entrance",
  "location": "Building A, Ground Floor",
  "stream_url": "rtsp://192.168.1.100:554/stream",
  "teacher_id": 1,
  "confidence_threshold": 0.6,
  "zone_type": "entrance"
}
```

**Response** (201): Returns the created camera object.

---

#### PUT /cameras/{id}

Update camera configuration.

- **Auth Required**: Yes
- **Roles**: Principal

**Response** (200): Returns the updated camera object.

---

#### DELETE /cameras/{id}

Soft-delete a camera.

- **Auth Required**: Yes
- **Roles**: Principal

**Response** (204): No content.

---

#### GET /cameras/{id}/stream

Get the live stream URL for a camera. Returns a temporary signed URL.

- **Auth Required**: Yes
- **Roles**: Teacher (if assigned), Principal

**Response** (200):

```json
{
  "camera_id": 1,
  "stream_url": "ws://localhost:8000/ws/camera/1?token=...",
  "expires_at": "2025-01-15T11:30:00Z"
}
```

---

### Schedules

#### GET /schedules

List class schedules.

- **Auth Required**: Yes
- **Roles**: Teacher (own schedules), Principal (all schedules)

**Query Parameters**:

| Parameter   | Type   | Default | Description                |
| ----------- | ------ | ------- | -------------------------- |
| page        | int    | 1       | Page number                |
| per_page    | int    | 20      | Items per page             |
| teacher_id  | int    | --      | Filter by teacher          |
| day_of_week | int    | --      | Filter by day (0=Monday)   |
| grade       | string | --      | Filter by grade            |

**Response** (200):

```json
{
  "items": [
    {
      "id": 1,
      "teacher_id": 1,
      "camera_id": 5,
      "subject": "Mathematics",
      "grade": "10-A",
      "day_of_week": 0,
      "start_time": "08:00:00",
      "end_time": "08:45:00",
      "room": "Room 201",
      "is_active": true,
      "teacher": {
        "id": 1,
        "first_name": "Jane",
        "last_name": "Smith"
      }
    }
  ],
  "total": 35,
  "page": 1,
  "per_page": 20,
  "pages": 2
}
```

---

#### GET /schedules/{id}

Get a single schedule entry.

- **Auth Required**: Yes

**Response** (200): Returns the schedule object.

---

#### POST /schedules

Create a new schedule entry.

- **Auth Required**: Yes
- **Roles**: Principal

**Request Body**:

```json
{
  "teacher_id": 1,
  "camera_id": 5,
  "subject": "Mathematics",
  "grade": "10-A",
  "day_of_week": 0,
  "start_time": "08:00:00",
  "end_time": "08:45:00",
  "room": "Room 201"
}
```

**Response** (201): Returns the created schedule object.

---

#### PUT /schedules/{id}

Update a schedule entry.

- **Auth Required**: Yes
- **Roles**: Principal

**Response** (200): Returns the updated schedule object.

---

#### DELETE /schedules/{id}

Delete a schedule entry.

- **Auth Required**: Yes
- **Roles**: Principal

**Response** (204): No content.

---

### Alerts

#### GET /alerts

List alerts with filtering and pagination.

- **Auth Required**: Yes
- **Roles**: Teacher (assigned cameras only), Principal (all), Parent (own children only)

**Query Parameters**:

| Parameter  | Type   | Default | Description                               |
| ---------- | ------ | ------- | ----------------------------------------- |
| page       | int    | 1       | Page number                               |
| per_page   | int    | 20      | Items per page                            |
| camera_id  | int    | --      | Filter by camera                          |
| severity   | string | --      | Filter: low, medium, high, critical       |
| status     | string | --      | Filter: pending, acknowledged, resolved, dismissed |
| alert_type | string | --      | Filter: intrusion, loitering, crowd, fight, unknown |
| start_date | string | --      | Filter from date (ISO 8601)               |
| end_date   | string | --      | Filter to date (ISO 8601)                 |
| sort_by    | string | created_at | Sort field                             |
| sort_order | string | desc    | Sort direction: asc, desc                 |

**Response** (200):

```json
{
  "items": [
    {
      "id": 42,
      "camera_id": 1,
      "student_id": null,
      "alert_type": "intrusion",
      "severity": "high",
      "description": "Unauthorized person detected in restricted zone during class hours",
      "snapshot_url": "https://s3.example.com/snapshots/alert-42.jpg",
      "confidence": 0.87,
      "status": "pending",
      "acknowledged_by": null,
      "acknowledged_at": null,
      "resolved_at": null,
      "created_at": "2025-01-15T10:45:30Z",
      "camera": {
        "id": 1,
        "name": "Main Entrance",
        "location": "Building A, Ground Floor"
      }
    }
  ],
  "total": 256,
  "page": 1,
  "per_page": 20,
  "pages": 13
}
```

---

#### GET /alerts/{id}

Get a single alert with full details.

- **Auth Required**: Yes

**Response** (200): Returns the alert object with nested camera, student, and notification data.

---

#### PUT /alerts/{id}/acknowledge

Acknowledge an alert.

- **Auth Required**: Yes
- **Roles**: Teacher, Principal

**Response** (200):

```json
{
  "id": 42,
  "status": "acknowledged",
  "acknowledged_by": 1,
  "acknowledged_at": "2025-01-15T10:50:00Z"
}
```

---

#### PUT /alerts/{id}/resolve

Resolve an alert.

- **Auth Required**: Yes
- **Roles**: Teacher, Principal

**Request Body** (optional):

```json
{
  "resolution_note": "False alarm. Maintenance worker with valid access."
}
```

**Response** (200):

```json
{
  "id": 42,
  "status": "resolved",
  "resolved_at": "2025-01-15T11:00:00Z"
}
```

---

#### PUT /alerts/{id}/dismiss

Dismiss an alert (mark as non-actionable).

- **Auth Required**: Yes
- **Roles**: Teacher, Principal

**Response** (200): Returns the updated alert with status "dismissed".

---

#### GET /alerts/stats

Get alert statistics and counts.

- **Auth Required**: Yes
- **Roles**: Principal

**Query Parameters**:

| Parameter  | Type   | Default     | Description                   |
| ---------- | ------ | ----------- | ----------------------------- |
| start_date | string | 7 days ago  | Start of the reporting period |
| end_date   | string | now         | End of the reporting period   |
| group_by   | string | day         | Grouping: hour, day, week     |

**Response** (200):

```json
{
  "total": 256,
  "by_severity": {
    "low": 120,
    "medium": 80,
    "high": 45,
    "critical": 11
  },
  "by_status": {
    "pending": 15,
    "acknowledged": 30,
    "resolved": 180,
    "dismissed": 31
  },
  "by_type": {
    "intrusion": 50,
    "loitering": 90,
    "crowd": 60,
    "fight": 20,
    "unknown": 36
  },
  "timeline": [
    { "date": "2025-01-08", "count": 32 },
    { "date": "2025-01-09", "count": 28 },
    { "date": "2025-01-10", "count": 41 }
  ]
}
```

---

### Notifications

#### GET /notifications

List notifications for the authenticated user.

- **Auth Required**: Yes

**Query Parameters**:

| Parameter | Type   | Default | Description                              |
| --------- | ------ | ------- | ---------------------------------------- |
| page      | int    | 1       | Page number                              |
| per_page  | int    | 20      | Items per page                           |
| status    | string | --      | Filter: pending, sent, failed, read      |
| channel   | string | --      | Filter: in_app, email, sms, push         |

**Response** (200):

```json
{
  "items": [
    {
      "id": 100,
      "alert_id": 42,
      "channel": "in_app",
      "title": "High Severity Alert -- Main Entrance",
      "body": "Unauthorized person detected in restricted zone during class hours.",
      "status": "sent",
      "sent_at": "2025-01-15T10:45:35Z",
      "read_at": null,
      "created_at": "2025-01-15T10:45:32Z"
    }
  ],
  "total": 85,
  "page": 1,
  "per_page": 20,
  "pages": 5,
  "unread_count": 12
}
```

---

#### PUT /notifications/{id}/read

Mark a notification as read.

- **Auth Required**: Yes

**Response** (200):

```json
{
  "id": 100,
  "status": "read",
  "read_at": "2025-01-15T11:05:00Z"
}
```

---

#### PUT /notifications/read-all

Mark all notifications as read for the authenticated user.

- **Auth Required**: Yes

**Response** (200):

```json
{
  "marked_count": 12
}
```

---

## WebSocket

### Connection

```
ws://localhost:8000/ws/alerts?token=<jwt_access_token>
```

**Authentication**: The JWT access token must be provided as a query parameter. The server validates the token before upgrading the HTTP connection to WebSocket. Invalid or expired tokens result in a close frame with code `4001` and reason `"Authentication failed"`.

### Connection Flow

1. Client sends: `ws://localhost:8000/ws/alerts?token=eyJhbG...`
2. Server validates the JWT.
3. On success, the WebSocket connection is established.
4. On failure, the server sends a close frame (code 4001) and terminates.

### Server-Sent Messages

The server pushes JSON messages to connected clients when relevant events occur.

#### New Alert

```json
{
  "type": "new_alert",
  "data": {
    "id": 43,
    "camera_id": 2,
    "alert_type": "loitering",
    "severity": "medium",
    "description": "Person loitering near emergency exit for over 5 minutes",
    "snapshot_url": "https://s3.example.com/snapshots/alert-43.jpg",
    "confidence": 0.72,
    "status": "pending",
    "created_at": "2025-01-15T11:20:00Z",
    "camera": {
      "id": 2,
      "name": "Emergency Exit B",
      "location": "Building A, East Wing"
    }
  }
}
```

#### Alert Status Update

```json
{
  "type": "alert_update",
  "data": {
    "id": 42,
    "status": "acknowledged",
    "acknowledged_by": 1,
    "acknowledged_at": "2025-01-15T10:50:00Z"
  }
}
```

#### Camera Status Change

```json
{
  "type": "camera_status",
  "data": {
    "camera_id": 3,
    "is_active": false,
    "reason": "Connection lost"
  }
}
```

### Client-Sent Messages

Clients can send messages to the server for real-time interactions.

#### Acknowledge Alert

```json
{
  "action": "acknowledge_alert",
  "alert_id": 42
}
```

#### Subscribe to Camera

```json
{
  "action": "subscribe_camera",
  "camera_id": 1
}
```

#### Unsubscribe from Camera

```json
{
  "action": "unsubscribe_camera",
  "camera_id": 1
}
```

### Heartbeat

The server sends a ping frame every 30 seconds. Clients must respond with a pong frame. Connections that miss 3 consecutive pongs are terminated.

```json
{
  "type": "ping",
  "timestamp": "2025-01-15T11:25:00Z"
}
```

Client response:

```json
{
  "type": "pong",
  "timestamp": "2025-01-15T11:25:00Z"
}
```
