from fastapi.testclient import TestClient
import time

from main import app

client = TestClient(app)

timestamp = int(time.time())
OWNER = {
    "username": f"owner_{timestamp}",
    "password": "StrongPass123",
    "email": f"owner_{timestamp}@example.com",
    "id": None,
    "token": None,
}
MEMBER = {
    "username": f"member_{timestamp}",
    "password": "StrongPass123",
    "email": f"member_{timestamp}@example.com",
    "id": None,
    "token": None,
}

PROJECT_ID = None
TASK_ID = None


def auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the Real-Time Task Manager API"}


def test_register_owner():
    response = client.post("/api/v1/register/", json={
        "username": OWNER["username"],
        "email": OWNER["email"],
        "password": OWNER["password"],
    })
    assert response.status_code == 201
    OWNER["id"] = response.json()["id"]


def test_register_member():
    response = client.post("/api/v1/register/", json={
        "username": MEMBER["username"],
        "email": MEMBER["email"],
        "password": MEMBER["password"],
    })
    assert response.status_code == 201
    MEMBER["id"] = response.json()["id"]


def test_owner_login():
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    response = client.post("/api/v1/login/", data={
        "username": OWNER["username"],
        "password": OWNER["password"],
    }, headers=headers)
    assert response.status_code == 200
    OWNER["token"] = response.json()["access_token"]


def test_member_login():
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    response = client.post("/api/v1/login/", data={
        "username": MEMBER["username"],
        "password": MEMBER["password"],
    }, headers=headers)
    assert response.status_code == 200
    MEMBER["token"] = response.json()["access_token"]


def test_owner_reads_profile():
    response = client.get("/api/v1/me/", headers=auth_header(OWNER["token"]))
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == OWNER["username"]
    assert data["role"] == "user"


def test_owner_creates_project():
    global PROJECT_ID
    payload = {
        "name": "FastAPI Backend",
        "description": "Advanced workspace",
        "color": "#ffaa00",
        "member_ids": [MEMBER["id"]],
    }
    response = client.post("/api/v1/projects/", json=payload, headers=auth_header(OWNER["token"]))
    assert response.status_code == 201
    body = response.json()
    PROJECT_ID = body["id"]
    member_ids = {member["id"] for member in body["members"]}
    assert OWNER["id"] in member_ids
    assert MEMBER["id"] in member_ids


def test_member_can_view_project():
    response = client.get(f"/api/v1/projects/{PROJECT_ID}", headers=auth_header(MEMBER["token"]))
    assert response.status_code == 200
    assert response.json()["id"] == PROJECT_ID


def test_owner_creates_task():
    global TASK_ID
    payload = {
        "title": "Design schema",
        "description": "Define new tables",
        "status": "to_do",
        "priority": "high",
        "project_id": PROJECT_ID,
        "assignee_id": MEMBER["id"],
    }
    response = client.post("/api/v1/tasks/", json=payload, headers=auth_header(OWNER["token"]))
    assert response.status_code == 201
    body = response.json()
    TASK_ID = body["id"]
    assert body["project"]["id"] == PROJECT_ID
    assert body["assignee"]["id"] == MEMBER["id"]


def test_member_lists_tasks():
    response = client.get("/api/v1/tasks/", headers=auth_header(MEMBER["token"]))
    assert response.status_code == 200
    tasks = response.json()
    assert any(task["id"] == TASK_ID for task in tasks)


def test_owner_updates_task_status():
    response = client.put(f"/api/v1/tasks/{TASK_ID}", json={"status": "in_progress"}, headers=auth_header(OWNER["token"]))
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


def test_owner_marks_task_completed():
    response = client.put(
        f"/api/v1/tasks/{TASK_ID}",
        json={"completed": True},
        headers=auth_header(OWNER["token"])
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["completed"] is True
    assert payload["status"] == "done"


def test_owner_marks_task_incomplete():
    response = client.put(
        f"/api/v1/tasks/{TASK_ID}",
        json={"completed": False, "status": "to_do"},
        headers=auth_header(OWNER["token"])
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["completed"] is False
    assert payload["status"] == "to_do"


def test_member_cannot_delete_task():
    response = client.delete(f"/api/v1/tasks/{TASK_ID}", headers=auth_header(MEMBER["token"]))
    assert response.status_code == 403


def test_owner_deletes_task():
    response = client.delete(f"/api/v1/tasks/{TASK_ID}", headers=auth_header(OWNER["token"]))
    assert response.status_code == 200
    assert response.json()["id"] == TASK_ID
