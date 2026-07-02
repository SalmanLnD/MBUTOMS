# TOMS - Training Operations Management System (MBUTOMS)

A MERN stack web application to manage trainers, schedules, attendance, venues, student performance, leaves, and reports for an educational institution.

**GitHub:** [MBUTOMS](https://github.com/SalmanLnD/MBUTOMS)

**Live app:** https://mbutoms.vercel.app  
**API:** https://mbutoms-api.vercel.app

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel (frontend) and Render (backend) setup.

## Tech Stack

- **Frontend:** React (Vite), React Router, Axios, Bootstrap 5, Chart.js
- **Backend:** Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt

## Project Structure

```
training-management-system/
├── backend/          # Express API server
└── frontend/         # React Vite app
```

## Prerequisites

- Node.js 18+
- MongoDB (local or MongoDB Atlas)

## Setup

### 1. Backend

```bash
cd training-management-system/backend
cp .env.example .env
npm install
npm run seed    # Seed database with demo data
npm run dev     # Start server on http://localhost:5000
```

### 2. Frontend

```bash
cd training-management-system/frontend
npm install
npm run dev     # Start app on http://localhost:5173
```

## Demo Login Credentials

| Role           | Email              | Password    |
|----------------|--------------------|-------------|
| Admin          | admin@toms.edu     | admin123    |
| Campus Manager | manager@toms.edu   | manager123  |
| Trainer        | trainer@toms.edu   | trainer123  |

## Phase 1 (Complete)

- JWT Authentication with role-based access (Admin, Campus Manager, Trainer)
- Dashboard with stat cards and Chart.js analytics
- Trainer Management (CRUD, search, sort, pagination, profile page)
- Venue Management (CRUD, duplicate prevention)
- Subject Management (CRUD, academic structure links)
- Academic hierarchy models (Academic Year → Semester → Department → Section → Batch)

## Phase 2 (Complete)

- Timetable module with FullCalendar (day / week / month / list views)
- Schedule CRUD with trainer and venue conflict prevention
- Trainer Schedule page (calendar + list, hours taken)
- Venue Schedule page (per-venue booking view)
- Dashboard shows today's classes and upcoming classes
- Sample schedules seeded for the current week

## API Endpoints

| Method | Endpoint              | Description        |
|--------|-----------------------|--------------------|
| POST   | /api/auth/login       | User login         |
| GET    | /api/auth/me          | Current user       |
| GET    | /api/dashboard/stats  | Dashboard data     |
| GET    | /api/trainers         | List trainers      |
| POST   | /api/trainers         | Create trainer     |
| PUT    | /api/trainers/:id     | Update trainer     |
| DELETE | /api/trainers/:id     | Delete trainer     |
| GET    | /api/venues           | List venues        |
| POST   | /api/venues           | Create venue       |
| GET    | /api/subjects         | List subjects      |
| POST   | /api/subjects         | Create subject     |

| GET    | /api/schedules        | List schedules     |
| POST   | /api/schedules        | Create schedule    |
| PUT    | /api/schedules/:id    | Update schedule    |
| DELETE | /api/schedules/:id    | Delete schedule    |
| GET    | /api/schedules/trainer/:id | Trainer schedule |
| GET    | /api/schedules/venue/:id   | Venue schedule   |

## Upcoming Phases

- **Phase 3:** Attendance, Leave Module, Replacement Engine
- **Phase 4:** Students, Tests, Marks, Reports
- **Phase 5:** Performance Dashboard, Analytics, Exports, Notifications
