# TaskOS · Real-Time Task Manager

> A collaborative workspace that pairs a FastAPI backend with a PHP/vanilla JS dashboard so teams can plan, execute, and audit projects in real time.

## Table of contents

1. [Overview](#overview)
2. [Architecture at a glance](#architecture-at-a-glance)
3. [Feature highlights](#feature-highlights)
4. [Project structure](#project-structure)
5. [Data & timezone rules](#data--timezone-rules)
6. [Prerequisites](#prerequisites)
7. [Setup](#setup)
8. [Configuration](#configuration)
9. [Running locally](#running-locally)
10. [Sample data & migrations](#sample-data--migrations)
11. [API quick reference](#api-quick-reference)
12. [Logging & monitoring](#logging--monitoring)
13. [Testing](#testing)
14. [Contributing](#contributing)
15. [License](#license)

## Overview

TaskOS is a PBL4 capstone that combines a FastAPI microservice, a MySQL schema, and a PHP-based UI to orchestrate projects, teams, and personal work. JWT-secured APIs expose project/role aware task workflows, while the frontend renders dashboards, project boards, and personal queues with real-time feedback.

## Architecture at a glance

- **Backend**: Python 3.10+, FastAPI, SQLAlchemy ORM, Alembic migrations, PyMySQL connector.
- **Frontend**: PHP templates plus modular ES6 scripts (`frontend/assets/js/*.js`) and a single CSS system with dark/light theming.
- **Database**: MySQL schema (`task_management.sql`) with teams, users, projects, tasks, and membership tables.
- **Real-time**: WebSocket endpoint (`/api/v1/ws/tasks/{client_id}`) broadcasts board updates to connected clients.
- **Auth & security**: OAuth2 password flow with JWT, salted password hashing (Passlib + bcrypt), per-project roles (owner/manager/member), and admin-only actions.
- **Observability**: Request log (`info.log`) plus an activity log that captures every authenticated API call.
- **Quality**: Pytest suites cover core endpoints and ORM models (`tests/`).

## Feature highlights

### Platform capabilities
- Account lifecycle: registration, login, profile editing, password rotation, JWT refresh on username changes.
- Role-aware routing: global roles (admin, manager, user) plus per-project roles enforced server-side.
- Team directory: admin-managed teams with CRUD + bulk member assignment APIs.
- GMT+7 scheduling: all task timestamps are normalized to Vietnam time to keep reporting consistent.

### Project & task operations
- Personal vs collaborative tasks with status, priority, tags, parent/subtasks, and due-date validations.
- Kanban-ready grouping endpoints (`/projects/{id}/tasks`) powering board columns and filters.
- Permission gating that limits members to status toggles while managers/owners can edit full payloads.
- Automatic audit fields (creator/assignee, created/updated timestamps, completion tracking) and archived project protection.

### Frontend experience
- `dashboard.php`: personal Kanban with metrics (total/in-progress/due-soon) and quick-create modal.
- `personal_tasks.php`: dedicated board for private work with full CRUD modals.
- `settings.php`: profile, password, and admin tool surface powered by `settings.js`.
- `login.php` / `register.php`: onboarding forms, toasts, and token bootstrapping handled by `auth.js`.
- Shared utilities in `frontend/assets/js` (`app.js`, `auth.js`, `personal.js`, `settings.js`, `theme.js`) plus responsive CSS with keyboard-friendly modals.

### Ops & tooling
- Alembic migrations maintain schema parity for existing databases.
- Dedicated logging middleware captures request metadata and user identities.
- Ready-to-import SQL seed file with sample teams, admin/manager/member accounts, and multiple demo projects/tasks.

## Project structure

```
PBL4-Task_manager/
├── backend/
│   ├── api/                  # FastAPI routers, Pydantic models, middleware
│   │   ├── endpoints/        # projects.py, tasks.py, users.py, teams.py
│   │   ├── middleware/       # logging middleware & loggers
│   │   └── models/           # Request/response schemas
│   ├── core/                 # Settings + security helpers
│   ├── db/                   # SQLAlchemy session + models + alembic env
│   └── alembic/              # Migration scripts
├── frontend/
│   ├── *.php                 # Login, register, dashboard, projects, settings
│   ├── assets/css/style.css  # Single source of truth for styling
│   ├── assets/js/            # Dashboard/project/personal/settings logic
│   └── includes/             # header.php, sidebar.php, footer.php
├── tests/                    # Pytest suites for endpoints and models
├── task_management.sql       # Bootstrap schema + sample data
├── main.py                   # FastAPI entrypoint
├── requirements.txt          # Python dependencies
└── README.md
```

## Data & timezone rules

- All date/time fields are normalized to **GMT+7 (Vietnam)** inside `backend/api/endpoints/tasks.py` to keep UI and DB aligned.
- Personal tasks ignore `project_id` and automatically bind to the creator; collaborative tasks validate membership and parent-child relationships.
- Soft constraints: archived projects are read-only for task creation, due dates cannot sit behind completion timestamps, and status changes drive completion flags/end dates.

## Prerequisites

- Python **3.10+**
- MySQL Server (XAMPP, WAMP, Docker, or standalone installation)
- PHP runtime / Apache or Nginx with PHP-FPM (XAMPP is the quickest option)
- Git

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd PBL4-Task_manager
```

### 2. Database (MySQL)

1. Start MySQL (`mysqld`, XAMPP, Docker, etc.).
2. Import `task_management.sql` via phpMyAdmin or CLI:
   ```bash
   mysql -u root -p < task_management.sql
   ```
   The script creates the `task_manager` schema, default teams, admin/manager/member accounts, seeded personal tasks, and four collaborative sample projects.
3. Existing databases: run Alembic to apply the latest migrations.
   ```bash
   cd backend
   alembic upgrade head
   cd ..
   ```

### 3. Backend (FastAPI)

1. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS / Linux
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file at the project root (see [Configuration](#configuration)).
4. Optional: run `alembic revision --autogenerate` to keep schema changes under version control.

### 4. Frontend (PHP)

1. Copy or symlink the `frontend` directory into your web root (e.g., `C:\xampp\htdocs\taskos`).
2. Update Apache/Nginx hostnames if you prefer custom domains; ensure they match the CORS whitelist inside `main.py`.
3. Alternatively, run PHP’s built-in server for quick tests:
   ```bash
   php -S 127.0.0.1:9000 -t frontend
   ```
4. Set `API_BASE_URL` inside your JS modules if hosting the backend on a non-default port.

## Configuration

Create `.env` with the following keys:

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy connection string | `mysql+pymysql://root:password@localhost:3306/task_manager` |
| `SECRET_KEY` | JWT signing key | `super_secret_key_123` |
| `SALT` | Extra salt appended before hashing passwords | `s0m3_pepper` |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token TTL | `30` |
| `FRONTEND_ORIGINS` | (Optional) comma-separated list of allowed origins | `http://localhost,http://127.0.0.1:9000` |
| `BACKEND_HOST` / `BACKEND_PORT` | (Optional) uvicorn defaults | `0.0.0.0` / `8000` |

> Password hashing concatenates `password + SALT` before bcrypt hashing. Keep both `SECRET_KEY` and `SALT` private.

## Running locally

### Backend API

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend

- Apache/XAMPP example: `http://localhost/taskos/login.php`
- PHP built-in server example: `http://127.0.0.1:9000/login.php`
- Tokens are stored in `localStorage` (`tm_access_token`) and attached to subsequent API calls.

## Sample data & migrations

- `task_management.sql` seeds 10 teams, admin/manager/member accounts, personal tasks, and collaborative projects (e.g., **Customer Portal Rollout** with kanban-ready tasks and membership).
- Alembic migrations live in `backend/alembic/versions/` and track changes such as role columns and timestamp additions.
- Running migrations keeps existing installations aligned with the latest schema without re-importing data.

## API quick reference

| Endpoint | Method | Description | Auth |
| --- | --- | --- | --- |
| `/api/v1/register/` | POST | Create a new user account (optional team assignment) | No |
| `/api/v1/login/` | POST | OAuth2 password flow, returns JWT + role | No |
| `/api/v1/me/` | GET/PUT | Read or update the current user profile | Bearer |
| `/api/v1/projects/` | GET/POST | List visible projects or create a new one (admin/manager) | Bearer |
| `/api/v1/projects/{id}` | GET/PUT/DELETE | Fetch, update, or delete a project (owner/admin restrictions) | Bearer |
| `/api/v1/projects/{id}/members` | POST/PATCH/DELETE | Manage project membership and roles | Bearer |
| `/api/v1/projects/{id}/tasks` | GET/POST | Filter tasks by status/assignee or create project tasks | Bearer |
| `/api/v1/tasks/` | GET/POST | List visible tasks or create personal/project tasks | Bearer |
| `/api/v1/tasks/{id}` | GET/PUT/DELETE | Inspect or mutate a task with role-aware validation | Bearer |
| `/api/v1/tasks/personal/` | GET | List personal tasks created by the requester | Bearer |
| `/api/v1/users/search/` | GET | Lightweight search used by the Add Member modal | Bearer |
| `/api/v1/teams/` | CRUD | Admin-only team management endpoints | Bearer |
| `/api/v1/ws/tasks/{client_id}` | WebSocket | Broadcast channel for live task updates | Bearer |

## Logging & monitoring

- **Request log (`info.log`)** captures incoming/outgoing HTTP metadata with execution time.
- **Activity log (`activity.log`)** records every authenticated call with username (or `anonymous`), method, path, query parameters, status code, client IP, and duration.
- Logs live in the project root by default; update the `FileHandler` paths in `backend/api/middleware/middleware.py` if you prefer a `logs/` directory.
- Global exception handler (`main.py`) writes stack traces through the same logger, simplifying alerting.

## Testing

- Activate the virtual environment and run:
  ```bash
  pytest
  ```
- `tests/test_endpoints.py` spins up `TestClient` to cover auth → project → task happy paths.
- `tests/test_models.py` validates Pydantic schemas and SQLAlchemy models against a live session.
- Add environment-specific fixtures in `tests/conftest.py` when expanding coverage (e.g., mocking email or background jobs).

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Commit with clear messages and include tests when possible.
4. Push and open a Pull Request describing the change and any migration/logging considerations.

## License

MIT License. See `LICENSE` for the full text.
