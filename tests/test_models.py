import time

from backend.api.models.task import TaskCreate
from backend.api.models.user import UserCreate
from backend.db.db_structure import Project, Task, User
from backend.db.database import SessionLocal
from main import app  # ensures metadata is created

db = SessionLocal()


def _create_user(prefix: str = "testuser") -> User:
    unique = int(time.time() * 1000)
    user = User(
        username=f"{prefix}_{unique}",
        email=f"{prefix}_{unique}@example.com",
        hashed_password="hashed",
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_project(owner: User) -> Project:
    project = Project(name="Test Project", description="unit test", color="#ffffff", owner_id=owner.id)
    project.owner = owner
    project.members.append(owner)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def test_create_task():
    task_data = {"title": "Test Task", "description": "Test Task creation", "status": "to_do", "project_id": 1}
    task = TaskCreate(**task_data)
    assert task.title == "Test Task"
    assert task.description == "Test Task creation"
    assert task.status == "to_do"
    assert task.project_id == 1


def test_create_user():
    user_data = {"username": "testuser", "email": "test@example.com", "password": "testpassword"}
    user = UserCreate(**user_data)
    assert user.username == "testuser"
    assert user.email == "test@example.com"
    assert user.password == "testpassword"


def test_create_task_in_db():
    owner = _create_user("owner_db")
    project = _create_project(owner)
    task = Task(
        title="Test Task",
        description="Test for testing",
        completed=False,
        status="to_do",
        priority="medium",
        creator_id=owner.id,
        project_id=project.id,
        assignee_id=owner.id,
    )
    db.add(task)
    db.commit()
    db_task = db.query(Task).filter(Task.title == "Test Task").first()
    assert db_task is not None
    assert db_task.title == "Test Task"
    assert db_task.completed is False
    assert db_task.project_id == project.id


def test_create_user_in_db():
    unique = int(time.time())
    user = User(
        username=f"testuser{unique}",
        email=f"test{unique}@example.com",
        hashed_password="testhashed",
        role="user",
    )
    db.add(user)
    db.commit()
    db_user = db.query(User).filter(User.username == user.username).first()
    assert db_user is not None
    assert db_user.username == user.username
    assert db_user.email == user.email
    assert db_user.hashed_password == "testhashed"


def teardown_module(_module):
    db.close()
