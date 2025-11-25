from datetime import datetime
from typing import List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload

from ..models.task import TaskCreate, TaskResponse, TaskUpdate
from ...core.security import get_user_by_token
from ...db.database import get_db
from ...db.db_structure import Project, Task, User

router = APIRouter()

active_connections: Set[WebSocket] = set()


def _get_user_or_404(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found or inactive")
    return user


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).options(joinedload(Project.members)).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _ensure_project_member(user: User, project: Project):
    member_ids = {member.id for member in project.members}
    member_ids.add(project.owner_id)
    if user.id not in member_ids:
        raise HTTPException(status_code=403, detail="You are not a member of this project")


def _project_ids_for_user(user: User) -> List[int]:
    ids = {project.id for project in user.projects}
    ids.update(project.id for project in user.owned_projects)
    return list(ids)


@router.websocket("/ws/tasks/{client_id}")
async def websocket_endpoint(client_id: int, websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            for connection in active_connections:
                await connection.send_text(f"Client {client_id} says: {message}")
    except WebSocketDisconnect:
        active_connections.remove(websocket)


@router.post("/tasks/", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    current_user = _get_user_or_404(db, username)
    project = _get_project_or_404(db, task.project_id)
    _ensure_project_member(current_user, project)

    assignee = None
    if task.assignee_id:
        assignee = db.query(User).filter(User.id == task.assignee_id).first()
        if assignee is None:
            raise HTTPException(status_code=404, detail="Assignee not found")
        _ensure_project_member(assignee, project)

    parent_task = None
    if task.parent_task_id:
        parent_task = db.query(Task).filter(Task.id == task.parent_task_id).first()
        if parent_task is None or parent_task.project_id != project.id:
            raise HTTPException(status_code=400, detail="Invalid parent task")

    task_data = task.dict(exclude_unset=True)
    task_data["creator_id"] = current_user.id
    db_task = Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/tasks/", response_model=List[TaskResponse])
def read_tasks(
    skip: int = 0,
    limit: int = 20,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token)
):
    current_user = _get_user_or_404(db, username)
    project_ids = _project_ids_for_user(current_user)
    if project_id:
        if project_id not in project_ids:
            raise HTTPException(status_code=403, detail="Project access denied")
        project_ids = [project_id]

    if not project_ids:
        return []

    tasks = (
        db.query(Task)
        .options(joinedload(Task.project), joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.project_id.in_(project_ids))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return tasks


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def read_task(task_id: int, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    current_user = _get_user_or_404(db, username)
    task = (
        db.query(Task)
        .options(joinedload(Task.project), joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.id == task_id)
        .first()
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    _ensure_project_member(current_user, task.project)
    return task


@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token)
):
    current_user = _get_user_or_404(db, username)
    db_task = (
        db.query(Task)
        .options(joinedload(Task.project), joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.id == task_id)
        .first()
    )
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    _ensure_project_member(current_user, db_task.project)

    update_data = task_update.dict(exclude_unset=True)

    if "assignee_id" in update_data:
        if update_data["assignee_id"] is None:
            db_task.assignee_id = None
        else:
            assignee = db.query(User).filter(User.id == update_data["assignee_id"]).first()
            if assignee is None:
                raise HTTPException(status_code=404, detail="Assignee not found")
            _ensure_project_member(assignee, db_task.project)
            db_task.assignee_id = assignee.id
        update_data.pop("assignee_id")

    if "parent_task_id" in update_data:
        parent_id = update_data.pop("parent_task_id")
        if parent_id is None:
            db_task.parent_task_id = None
        else:
            parent = db.query(Task).filter(Task.id == parent_id).first()
            if parent is None or parent.project_id != db_task.project_id:
                raise HTTPException(status_code=400, detail="Invalid parent task")
            db_task.parent_task_id = parent_id

    for key, value in update_data.items():
        setattr(db_task, key, value)

    db_task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_task)
    return db_task


@router.delete("/tasks/{task_id}", response_model=TaskResponse)
def delete_task(task_id: int, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    current_user = _get_user_or_404(db, username)
    task = (
        db.query(Task)
        .options(joinedload(Task.project))
        .filter(Task.id == task_id)
        .first()
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    _ensure_project_member(current_user, task.project)
    if current_user.id not in {task.project.owner_id, task.creator_id}:
        raise HTTPException(status_code=403, detail="Only the project owner or task creator can delete this task")
    db.delete(task)
    db.commit()
    return task
