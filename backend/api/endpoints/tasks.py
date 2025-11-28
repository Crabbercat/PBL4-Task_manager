from datetime import datetime
from typing import List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload

from ..models.task import TaskCreate, TaskResponse, TaskStatus, TaskUpdate
from ...core.security import get_user_by_token
from ...db.database import get_db
from ...db.db_structure import Project, Task, User

router = APIRouter()

active_connections: Set[WebSocket] = set()


def _prepare_task_dates(task_data: dict, start_date: Optional[datetime]):
    """Ensure start/end dates follow the creation rules."""
    task_data["start_date"] = start_date or datetime.utcnow()
    task_data["end_date"] = None


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

    if task.is_personal:
        if task.project_id is not None:
            raise HTTPException(status_code=400, detail="Personal tasks cannot belong to a project")
        if task.parent_task_id is not None:
            raise HTTPException(status_code=400, detail="Personal tasks do not support subtasks yet")
        if task.assignee_id and task.assignee_id != current_user.id:
            raise HTTPException(status_code=403, detail="Personal tasks can only be assigned to yourself")
        task_data = task.dict(exclude_unset=True, exclude={"project_id"})
        task_data["project_id"] = None
        task_data["assignee_id"] = current_user.id
        task_data["creator_id"] = current_user.id
        task_data["is_personal"] = True
    else:
        if task.project_id is None:
            raise HTTPException(status_code=400, detail="Project is required for team tasks")
        project = _get_project_or_404(db, task.project_id)
        _ensure_project_member(current_user, project)

        if task.assignee_id:
            assignee = db.query(User).filter(User.id == task.assignee_id).first()
            if assignee is None:
                raise HTTPException(status_code=404, detail="Assignee not found")
            _ensure_project_member(assignee, project)

        if task.parent_task_id:
            parent_task = db.query(Task).filter(Task.id == task.parent_task_id).first()
            if parent_task is None or parent_task.project_id != project.id:
                raise HTTPException(status_code=400, detail="Invalid parent task")

        task_data = task.dict(exclude_unset=True)
        task_data["creator_id"] = current_user.id

    _prepare_task_dates(task_data, task.start_date)

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
    
    # If a specific project is requested, strictly filter by it
    if project_id:
        if project_id not in project_ids:
            raise HTTPException(status_code=403, detail="Project access denied")
        
        tasks = (
            db.query(Task)
            .options(joinedload(Task.project), joinedload(Task.assignee), joinedload(Task.creator))
            .filter(Task.project_id == project_id)
            .offset(skip)
            .limit(limit)
            .all()
        )
        return tasks

    # Otherwise, return all tasks visible to the user:
    # 1. Tasks in projects they are a member of
    # 2. Personal tasks they created
    
    # We need to handle the case where project_ids is empty
    project_filter = Task.project_id.in_(project_ids) if project_ids else False
    
    from sqlalchemy import or_, and_
    
    tasks = (
        db.query(Task)
        .options(joinedload(Task.project), joinedload(Task.assignee), joinedload(Task.creator))
        .filter(
            or_(
                project_filter,
                and_(Task.is_personal == True, Task.creator_id == current_user.id)
            )
        )
        .order_by(Task.due_date.is_(None), Task.due_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return tasks


@router.get("/tasks/personal/", response_model=List[TaskResponse])
def read_personal_tasks(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token)
):
    current_user = _get_user_or_404(db, username)
    tasks = (
        db.query(Task)
        .options(joinedload(Task.project), joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.is_personal == True, Task.creator_id == current_user.id)
        .order_by(Task.due_date.is_(None), Task.due_date.asc())
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

    if task.is_personal:
        if task.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="You cannot view this personal task")
        return task

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

    if db_task.is_personal:
        if db_task.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="You cannot modify this personal task")
    else:
        _ensure_project_member(current_user, db_task.project)

    update_data = task_update.dict(exclude_unset=True)
    update_data.pop("end_date", None)
    completed_flag = update_data.pop("completed", None)
    effective_due_date = update_data.get("due_date", db_task.due_date)

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

    if completed_flag is not None:
        db_task.completed = completed_flag
        if completed_flag:
            update_data.setdefault("status", TaskStatus.DONE)
        elif db_task.status == TaskStatus.DONE and "status" not in update_data:
            update_data["status"] = TaskStatus.TO_DO

    new_status = update_data.get("status")
    if new_status:
        if isinstance(new_status, str):
            try:
                new_status = TaskStatus(new_status)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid status value")

        if new_status == TaskStatus.DONE:
            completed_at = datetime.utcnow()
            if effective_due_date and completed_at > effective_due_date:
                raise HTTPException(status_code=400, detail="Cannot mark task as done after its due date. Adjust the due date first.")
            db_task.end_date = completed_at
            db_task.completed = True
        else:
            db_task.end_date = None
            if completed_flag is None:
                db_task.completed = False
    elif "due_date" in update_data and db_task.status == TaskStatus.DONE and db_task.end_date:
        if effective_due_date and db_task.end_date > effective_due_date:
            raise HTTPException(status_code=400, detail="Due date must be later than the completion time.")

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

    if task.is_personal:
        if task.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the creator can delete this personal task")
    else:
        _ensure_project_member(current_user, task.project)
        if current_user.id not in {task.project.owner_id, task.creator_id}:
            raise HTTPException(status_code=403, detail="Only the project owner or task creator can delete this task")
    db.delete(task)
    db.commit()
    return task
