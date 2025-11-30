from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload, selectinload

from ..models.project import ProjectRole
from ..models.task import TaskCreate, TaskResponse, TaskStatus, TaskUpdate
from ...core.security import get_user_by_token
from ...db.database import get_db
from ...db.db_structure import Project, ProjectMember, Task, User

router = APIRouter()

active_connections: Set[WebSocket] = set()


VIETNAM_TZ = timezone(timedelta(hours=7))


def _now_vietnam() -> datetime:
    """Return current Vietnam time as a timezone-naive datetime."""
    return datetime.now(VIETNAM_TZ).replace(tzinfo=None)


def _to_vietnam_naive(dt: Optional[datetime]) -> Optional[datetime]:
    """Convert aware datetimes to Vietnam time and drop tzinfo for storage."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(VIETNAM_TZ).replace(tzinfo=None)


def _normalize_task_datetime_fields(task_data: dict):
    for date_field in ("start_date", "end_date", "due_date"):
        value = task_data.get(date_field)
        if isinstance(value, datetime):
            task_data[date_field] = _to_vietnam_naive(value)


def _prepare_task_dates(task_data: dict, start_date: Optional[datetime]):
    """Ensure start/end dates follow the creation rules."""
    normalized_start = _to_vietnam_naive(start_date)
    task_data["start_date"] = normalized_start or _now_vietnam()
    task_data["end_date"] = None


def _get_user_or_404(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found or inactive")
    return user


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = (
        db.query(Project)
        .options(selectinload(Project.project_members).joinedload(ProjectMember.user))
        .filter(Project.id == project_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_project_membership(project: Project, user_id: int) -> Optional[ProjectMember]:
    return next((member for member in project.project_members if member.user_id == user_id), None)


def _project_role_for_user(project: Project, user_id: int) -> Optional[ProjectRole]:
    if project.owner_id == user_id:
        return ProjectRole.OWNER
    membership = _get_project_membership(project, user_id)
    if membership is None:
        return None
    try:
        return ProjectRole(membership.role)
    except ValueError:
        return None


def _ensure_project_member(user: User, project: Project):
    if user.role == "admin":
        return
    member_ids = {member.id for member in project.members}
    member_ids.add(project.owner_id)
    if user.id not in member_ids:
        raise HTTPException(status_code=403, detail="You are not a member of this project")


def _project_ids_for_user(db: Session, user: User) -> List[int]:
    if user.role == "admin":
        return [pid for (pid,) in db.query(Project.id).all()]
    ids = {project.id for project in user.projects}
    ids.update(project.id for project in user.owned_projects)
    return list(ids)


def _create_task_record(current_user: User, task: TaskCreate, db: Session) -> Task:
    if task.is_personal:
        if task.project_id is not None:
            raise HTTPException(status_code=400, detail="Personal tasks cannot belong to a project")
        if task.parent_task_id is not None:
            raise HTTPException(status_code=400, detail="Personal tasks do not support subtasks yet")
        if task.assignee_id and task.assignee_id != current_user.id:
            raise HTTPException(status_code=403, detail="Personal tasks can only be assigned to yourself")
        task_data = task.dict(exclude_unset=True, exclude={"project_id"})
        _normalize_task_datetime_fields(task_data)
        task_data["project_id"] = None
        task_data["assignee_id"] = current_user.id
        task_data["creator_id"] = current_user.id
        task_data["is_personal"] = True
    else:
        if task.project_id is None:
            raise HTTPException(status_code=400, detail="Project is required for team tasks")
        project = _get_project_or_404(db, task.project_id)
        _ensure_project_member(current_user, project)
        if project.archived:
            raise HTTPException(status_code=400, detail="Archived projects cannot accept new tasks")

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
        _normalize_task_datetime_fields(task_data)
        task_data["creator_id"] = current_user.id

    _prepare_task_dates(task_data, task.start_date)

    db_task = Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


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
    return _create_task_record(current_user, task, db)


@router.post("/projects/{project_id}/tasks", response_model=TaskResponse, status_code=201)
def create_project_task(
    project_id: int,
    task: TaskCreate,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    current_user = _get_user_or_404(db, username)
    payload = task.model_copy(update={"project_id": project_id, "is_personal": False})
    return _create_task_record(current_user, payload, db)


@router.get("/tasks/", response_model=List[TaskResponse])
def read_tasks(
    skip: int = 0,
    limit: int = 20,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token)
):
    current_user = _get_user_or_404(db, username)
    project_ids = _project_ids_for_user(db, current_user)
    
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

    from sqlalchemy import or_, and_

    visibility_filters = [and_(Task.is_personal == True, Task.creator_id == current_user.id)]
    if project_ids:
        visibility_filters.append(Task.project_id.in_(project_ids))

    tasks = (
        db.query(Task)
        .options(joinedload(Task.project), joinedload(Task.assignee), joinedload(Task.creator))
        .filter(or_(*visibility_filters))
        .order_by(Task.due_date.is_(None), Task.due_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return tasks


@router.get("/projects/{project_id}/tasks", response_model=Dict[str, List[TaskResponse]])
def read_project_tasks(
    project_id: int,
    status_filter: Optional[TaskStatus] = Query(None, alias="status"),
    assignee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    current_user = _get_user_or_404(db, username)
    project = _get_project_or_404(db, project_id)
    _ensure_project_member(current_user, project)

    query = (
        db.query(Task)
        .options(joinedload(Task.project), joinedload(Task.assignee), joinedload(Task.creator))
        .filter(Task.project_id == project_id)
    )

    if status_filter:
        query = query.filter(Task.status == status_filter)

    if assignee_id is not None:
        membership = next((member for member in project.members if member.id == assignee_id), None)
        if membership is None and assignee_id != project.owner_id:
            raise HTTPException(status_code=400, detail="Assignee is not part of this project")
        query = query.filter(Task.assignee_id == assignee_id)

    tasks = query.order_by(Task.due_date.is_(None), Task.due_date.asc()).all()

    grouped: Dict[str, List[Task]] = defaultdict(list)
    for task in tasks:
        grouped[task.status].append(task)

    return {
        TaskStatus.TO_DO.value: grouped.get(TaskStatus.TO_DO.value, []),
        TaskStatus.IN_PROGRESS.value: grouped.get(TaskStatus.IN_PROGRESS.value, []),
        TaskStatus.DONE.value: grouped.get(TaskStatus.DONE.value, []),
    }


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

    raw_update = task_update.dict(exclude_unset=True)
    requested_fields = set(raw_update.keys())
    update_data = raw_update.copy()
    _normalize_task_datetime_fields(update_data)

    if db_task.is_personal:
        if db_task.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="You cannot modify this personal task")
    else:
        _ensure_project_member(current_user, db_task.project)
        if current_user.role != "admin":
            role = _project_role_for_user(db_task.project, current_user.id)
            is_creator = db_task.creator_id == current_user.id
            is_manager = role in {ProjectRole.MANAGER, ProjectRole.OWNER}
            if not (is_creator or is_manager):
                if db_task.assignee_id != current_user.id:
                    raise HTTPException(
                        status_code=403,
                        detail="Only project managers or the assigned member can update this task."
                    )
                allowed = {"status", "completed"}
                disallowed = requested_fields - allowed
                if disallowed:
                    raise HTTPException(
                        status_code=403,
                        detail="Only the task creator or project managers can edit this task. Members may only update its status."
                    )
    update_data.pop("end_date", None)
    completed_flag = update_data.pop("completed", None)
    effective_due_date = update_data.get("due_date")
    if effective_due_date is None:
        effective_due_date = _to_vietnam_naive(db_task.due_date)

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
            completed_at = _now_vietnam()
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

    db_task.updated_at = _now_vietnam()
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
        if current_user.role != "admin":
            role = _project_role_for_user(task.project, current_user.id)
            if role not in {ProjectRole.MANAGER, ProjectRole.OWNER}:
                raise HTTPException(status_code=403, detail="Only project managers or admins can delete this task")
    db.delete(task)
    db.commit()
    return task
