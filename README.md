# Unolo Field Force Tracker

A web application for tracking field employee check-ins at client locations.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router
- **Backend:** Node.js, Express.js, SQLite
- **Authentication:** JWT

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm run setup    # Installs dependencies and initializes database
cp .env.example .env
npm run dev
```

Backend runs on: `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

### Test Credentials

| Role     | Email              | Password    |
|----------|-------------------|-------------|
| Manager  | manager@unolo.com | password123 |
| Employee | rahul@unolo.com   | password123 |
| Employee | priya@unolo.com   | password123 |

## Project Structure

```
├── backend/
│   ├── config/          # Database configuration
│   ├── middleware/      # Auth middleware
│   ├── routes/          # API routes
│   │   ├── auth.js      # Authentication routes
│   │   ├── checkin.js   # Check-in/out routes
│   │   ├── dashboard.js # Dashboard data routes
│   │   └── reports.js   # Report generation routes (NEW)
│   ├── scripts/         # Database init scripts
│   └── server.js        # Express app entry
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   └── utils/       # API helpers
│   └── index.html
├── database/            # SQL schemas (reference only)
├── BUG_FIXES.md         # Documentation of all bug fixes
└── README.md            # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Check-ins
- `GET /api/checkin/clients` - Get assigned clients
- `POST /api/checkin` - Create check-in (with distance calculation)
- `PUT /api/checkin/checkout` - Checkout
- `GET /api/checkin/history` - Get check-in history
- `GET /api/checkin/active` - Get active check-in

### Dashboard
- `GET /api/dashboard/stats` - Manager stats
- `GET /api/dashboard/employee` - Employee stats

### Reports (NEW)
- `GET /api/reports/daily-summary` - Daily summary report for managers

---

## New Features

### Feature A: Real-time Distance Calculation

When an employee checks in, the system calculates and displays the distance between their current location and the assigned client location using the Haversine formula.

**Backend Changes:**
- Added Haversine formula implementation in `backend/routes/checkin.js`
- `POST /api/checkin` now accepts `latitude` and `longitude` and calculates distance
- Distance is stored in the `distance_from_client` column in the database
- Response includes `distance_from_client` (in km) and `distance_warning` (if > 500m)

**Frontend Changes:**
- Check-in form displays real-time distance when a client is selected
- Yellow warning shown if employee is > 500 meters from client location
- History table includes a "Distance" column showing distance at check-in time
- Color-coded distance badges (green for close, yellow for far)

**API Request Example:**
```json
POST /api/checkin
{
  "client_id": 1,
  "latitude": 28.4946,
  "longitude": 77.0887,
  "notes": "Regular visit"
}
```

**API Response Example:**
```json
{
  "success": true,
  "data": {
    "id": 7,
    "message": "Checked in successfully",
    "distance_from_client": 0.15,
    "distance_warning": null
  }
}
```

---

### Feature B: Daily Summary Report API

A new API endpoint for managers to get a daily summary of their team's activity.

**Endpoint:** `GET /api/reports/daily-summary`

**Authentication:** Required (JWT token in Authorization header)

**Authorization:** Manager role only

**Query Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `date` | Yes | Date in YYYY-MM-DD format |
| `employee_id` | No | Filter by specific employee ID |

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "team_summary": {
      "total_employees": 3,
      "employees_with_checkins": 2,
      "total_checkins": 5,
      "total_hours_worked": 12.5,
      "unique_clients_visited": 4,
      "average_distance_from_client": 0.23
    },
    "employee_breakdown": [
      {
        "employee_id": 2,
        "employee_name": "Rahul Kumar",
        "employee_email": "rahul@unolo.com",
        "total_checkins": 3,
        "hours_worked": 7.5,
        "clients_visited": ["ABC Corp", "XYZ Ltd", "Tech Solutions"],
        "average_distance": 0.18,
        "checkins": [
          {
            "id": 1,
            "client_id": 1,
            "client_name": "ABC Corp",
            "client_address": "Cyber City, Gurugram",
            "checkin_time": "2024-01-15T09:15:00.000Z",
            "checkout_time": "2024-01-15T11:30:00.000Z",
            "hours_worked": 2.25,
            "distance_from_client": 0.15,
            "notes": "Regular visit",
            "status": "checked_out"
          }
        ]
      }
    ]
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing or invalid date parameter
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User is not a manager
- `500 Internal Server Error` - Server error

**Example Usage:**
```bash
# Get daily summary for January 15, 2024
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/reports/daily-summary?date=2024-01-15"

# Filter by specific employee
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/reports/daily-summary?date=2024-01-15&employee_id=2"
```

---

## Architecture Decisions

### Distance Calculation
- **Algorithm:** Haversine formula for accurate great-circle distance calculation
- **Unit:** Kilometers (rounded to 2 decimal places)
- **Warning Threshold:** 500 meters (0.5 km) - configurable based on business needs
- **Storage:** Distance stored with each check-in for historical analysis

### Daily Summary API Design
- **Single Query Approach:** Used a single SQL JOIN query to fetch all check-ins with employee and client data, avoiding N+1 query problems
- **Aggregation:** Data is aggregated in JavaScript for flexibility and to avoid complex SQL aggregation
- **Employee Breakdown:** Includes employees with zero check-ins to show complete team picture
- **Sorting:** Results sorted by total check-ins (most active first)

### Database Compatibility
- Used SQLite-compatible date/time functions (`datetime()` instead of MySQL's `NOW()` and `DATE_SUB()`)
- Parameterized queries throughout to prevent SQL injection

### Security Improvements
- Removed password from JWT payload
- Added proper await for async password comparison
- Used parameterized queries for all user input

---

## Bug Fixes

See [BUG_FIXES.md](./BUG_FIXES.md) for detailed documentation of all bugs found and fixed, including:
- Authentication issues (async/await, JWT security)
- Database column name mismatches
- SQL injection vulnerabilities
- SQLite compatibility issues
- React hooks violations
- Form submission handling
- Stale closure problems

---

## Notes

- The database uses SQLite - no external database setup required
- Run `npm run init-db` to reset the database to initial state
- All timestamps are stored in UTC
- Distance calculations assume Earth is a perfect sphere (accurate to ~0.3%)
