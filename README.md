# PBL4 Task Manager

A comprehensive Task Management system featuring a robust FastAPI backend and a dynamic PHP/Vanilla JavaScript frontend. This application allows users to manage tasks, collaborate in teams, and track progress with a modern, responsive user interface.

## Features

-   **User Authentication**: Secure registration and login system using JWT (JSON Web Tokens).
-   **Task Management**: Full CRUD capabilities for tasks (Create, Read, Update, Delete).
-   **Team Collaboration**: Create teams, invite members, and manage roles (Admin, Manager, Member).
-   **Project Collaboration 2.0**: Create multi-member projects with owner/manager/member roles, membership management, project archiving, and Kanban-style task boards.
-   **Dashboard**: Interactive dashboard with task statistics and quick actions.
-   **Responsive Design**: Modern UI with dark/light mode support.

## Tech Stack

-   **Backend**: Python 3.10+, FastAPI, SQLAlchemy, MySQL.
-   **Frontend**: PHP, JavaScript (Vanilla), HTML, CSS.
-   **Database**: MySQL.

## Project Structure

```
PBL4-Task_manager/
├── backend/            # FastAPI application logic
│   ├── api/            # API endpoints (users, tasks, teams, projects)
│   ├── core/           # Configuration and security settings
│   ├── db/             # Database models and connection logic
│   └── alembic/        # Database migrations (if applicable)
├── frontend/           # PHP & JS Frontend
│   ├── assets/         # CSS, JS, Images
│   ├── includes/       # Reusable PHP components (header, sidebar)
│   └── *.php           # Main application pages
├── task_management.sql # Database schema import file
├── main.py             # Backend entry point
├── requirements.txt    # Python dependencies
└── README.md           # Project documentation
```

## Prerequisites

Before running the application, ensure you have the following installed:

-   **Python 3.10+**
-   **MySQL Server** (Recommended: XAMPP or a standalone MySQL installation)
-   **Web Server for PHP** (Recommended: Apache via XAMPP)
-   **Git**

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd PBL4-Task_manager
```

### 2. Database Setup

1.  Start your MySQL server (e.g., via XAMPP Control Panel).
2.  Import the database schema:
    -   **Option A (CLI)**:
        ```bash
        mysql -u root -p < task_management.sql
        ```
    -   **Option B (phpMyAdmin)**:
        -   Open phpMyAdmin (usually `http://localhost/phpmyadmin`).
        -   Import `task_management.sql`.
    -   *Note: The SQL file creates a database named `task_manager` and now includes project-level roles (`project_member.role`) plus the `project.archived` flag.*

> **Existing databases:** run the latest Alembic migration to add the new columns:
> ```bash
> cd backend
> alembic upgrade head
> ```
> This migration populates existing owner memberships with the `owner` role automatically.

### 3. Backend Setup

1.  Navigate to the project root.
2.  Create a virtual environment:
    ```bash
    python -m venv .venv
    # Windows
    .venv\Scripts\activate
    # Linux/macOS
    source .venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure Environment Variables:
    -   Create a `.env` file in the root directory.
    -   Add your database credentials and security keys:
        ```env
        DATABASE_URL=mysql+pymysql://root:@localhost:3306/task_manager
        SECRET_KEY=your_super_secret_key_here
        SALT=your_salt_here
        ALGORITHM=HS256
        ACCESS_TOKEN_EXPIRE_MINUTES=30
        ```
    -   *Note: If you have a password for your root user, add it after the colon in `DATABASE_URL` (e.g., `root:password@...`).*

### 4. Frontend Setup

1.  **Using XAMPP**:
    -   Copy the `frontend` folder (or the entire project) to your `htdocs` directory (e.g., `C:\xampp\htdocs\task_management`).
    -   Ensure the path matches your web server configuration.

## Usage

### Running the Backend

From the project root directory (with your virtual environment activated):

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.

### Running the Frontend

1.  Ensure your web server (Apache) is running.
2.  Open your browser and navigate to the frontend URL.
    -   Example: `http://localhost/task_management/frontend/index.php` (adjust based on your folder structure in `htdocs`).

### API Documentation

Interactive API documentation (Swagger UI) is available at:
`http://localhost:8000/docs`

## Project-based collaboration

- **Create project**: `POST /api/v1/projects/` (admin + manager). Automatically adds the creator as the project owner.
- **List projects**: `GET /api/v1/projects/?archived=true|false&search=` (admins see everything, others only what they belong to).
- **Project members**: `POST /api/v1/projects/{id}/members`, `PATCH /api/v1/projects/{id}/members/{user_id}`, `DELETE /api/v1/projects/{id}/members/{user_id}` with owner/manager validation.
- **Archive/restore**: `POST /api/v1/projects/{id}/archive` and `/restore` plus `PUT /projects/{id}` to edit metadata.
- **Project tasks**: `POST /api/v1/projects/{id}/tasks` and `GET /api/v1/projects/{id}/tasks?status=&assignee_id=` enforce creator/assignee membership.
- **User search**: `GET /api/v1/users/search/?q=` powers the Add Member modal with lightweight user summaries.

On the frontend you now have:

- `projects.php` – searchable/filterable grid of all projects the user can see, including a modal for admin/manager project creation.
- `project_detail.php?id=123` – owner-aware header, overview metrics, role-aware member management, Trello-style task board with status/assignee filters, Add Task modal, Add Member modal, and Project Settings modal (rename/color/archive toggles).

## Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/NewFeature`).
3.  Commit your changes (`git commit -m 'Add some feature'`).
4.  Push to the branch (`git push origin feature/NewFeature`).
5.  Open a Pull Request.

## License

This project is licensed under the MIT License.
