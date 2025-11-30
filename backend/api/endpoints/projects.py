from typing import List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from ..models.project import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberRoleUpdate,
    ProjectResponse,
    ProjectRole,
    ProjectUpdate,
)
from ..models.project import ProjectMemberSummary
from ...core.security import get_user_by_token
from ...db.database import get_db
from ...db.db_structure import Project, ProjectMember, Task, User

router = APIRouter()

SYSTEM_CREATE_ROLES = {"admin", "manager"}


def _project_query(db: Session):
    return (
        db.query(Project)
        .options(
            joinedload(Project.owner),
            selectinload(Project.project_members).joinedload(ProjectMember.user),
            selectinload(Project.tasks),
        )
    )


def _get_user_or_404(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found or inactive")
    return user


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = _project_query(db).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_membership(project: Project, user_id: int) -> Optional[ProjectMember]:
    return next((member for member in project.project_members if member.user_id == user_id), None)


def _is_admin(user: User) -> bool:
    return user.role == "admin"


def _require_system_role(user: User, allowed_roles: Set[str]):
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _require_project_member(user: User, project: Project):
    if _is_admin(user):
        return
    membership = _get_membership(project, user.id)
    if membership is None:
        raise HTTPException(status_code=403, detail="You are not a member of this project")


def _require_project_roles(user: User, project: Project, roles: List[ProjectRole]):
    if _is_admin(user):
        return
    membership = _get_membership(project, user.id)
    if membership is None or ProjectRole(membership.role) not in roles:
        raise HTTPException(status_code=403, detail="Action not allowed for your project role")


def _require_owner_or_admin(user: User, project: Project):
    if _is_admin(user):
        return
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can perform this action")


def _ensure_member_exists(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found or inactive")
    return user


def _add_member_to_project(
    db: Session,
    project: Project,
    user: User,
    role: ProjectRole = ProjectRole.MEMBER,
):
    if role == ProjectRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot assign owner role via membership API")
    if _get_membership(project, user.id):
        raise HTTPException(status_code=400, detail="User is already a member of this project")
    membership = ProjectMember(user_id=user.id, role=role.value)
    project.project_members.append(membership)
    db.flush()


def _remove_member_from_project(db: Session, project: Project, user_id: int):
    if user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove the project owner")
    membership = _get_membership(project, user_id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Member not found in this project")
    project.project_members.remove(membership)
    db.flush()
    db.query(Task).filter(
        Task.project_id == project.id,
        Task.assignee_id == user_id,
    ).update({Task.assignee_id: None})


def _serialize_memberships(project: Project) -> List[ProjectMemberSummary]:
    return [ProjectMemberSummary.model_validate(member) for member in project.project_members]


def _apply_project_updates(project: Project, data: ProjectUpdate):
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)


@router.post("/projects/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    owner = _get_user_or_404(db, username)
    _require_system_role(owner, SYSTEM_CREATE_ROLES)

    new_project = Project(
        name=project.name,
        description=project.description,
        color=project.color,
        owner_id=owner.id,
    )
    db.add(new_project)
    db.flush()

    owner_membership = ProjectMember(user_id=owner.id, role=ProjectRole.OWNER.value)
    new_project.project_members.append(owner_membership)

    for member_id in project.member_ids:
        member = _ensure_member_exists(db, member_id)
        if member.id == owner.id:
            continue
        _add_member_to_project(db, new_project, member)

    db.commit()
    return _get_project_or_404(db, new_project.id)


@router.get("/projects/", response_model=List[ProjectResponse])
def list_projects(
    archived: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, min_length=1),
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    user = _get_user_or_404(db, username)
    query = _project_query(db)

    if not _is_admin(user):
        query = query.filter(Project.project_members.any(ProjectMember.user_id == user.id))

    if archived is not None:
        query = query.filter(Project.archived == archived)

    if search:
        like = f"%{search.lower()}%"
        query = query.filter(func.lower(Project.name).like(like))

    projects = query.order_by(Project.updated_at.desc()).all()
    return projects


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    user = _get_user_or_404(db, username)
    project = _get_project_or_404(db, project_id)
    _require_project_member(user, project)
    return project


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    user = _get_user_or_404(db, username)
    project = _get_project_or_404(db, project_id)
    _require_owner_or_admin(user, project)

    _apply_project_updates(project, project_update)
    db.commit()
    return _get_project_or_404(db, project_id)


@router.post("/projects/{project_id}/members", response_model=List[ProjectMemberSummary])
def add_project_member(
    project_id: int,
    payload: ProjectMemberAdd,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    requester = _get_user_or_404(db, username)
    project = _get_project_or_404(db, project_id)
    _require_project_roles(requester, project, [ProjectRole.OWNER, ProjectRole.MANAGER])

    member = _ensure_member_exists(db, payload.user_id)
    _add_member_to_project(db, project, member, payload.role)
    db.commit()
    project = _get_project_or_404(db, project_id)
    return _serialize_memberships(project)


@router.patch("/projects/{project_id}/members/{user_id}", response_model=List[ProjectMemberSummary])
def update_project_member_role(
    project_id: int,
    user_id: int,
    payload: ProjectMemberRoleUpdate,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    requester = _get_user_or_404(db, username)
    project = _get_project_or_404(db, project_id)
    _require_owner_or_admin(requester, project)

    membership = _get_membership(project, user_id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Member not found")
    if membership.user_id == project.owner_id and payload.role != ProjectRole.OWNER:
        raise HTTPException(status_code=400, detail="Owner must retain owner role")
    if payload.role == ProjectRole.OWNER and membership.user_id != project.owner_id:
        raise HTTPException(status_code=400, detail="Use ownership transfer flow to change owners")

    membership.role = payload.role.value
    db.commit()
    project = _get_project_or_404(db, project_id)
    return _serialize_memberships(project)


@router.delete("/projects/{project_id}/members/{user_id}", response_model=List[ProjectMemberSummary])
def remove_project_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    requester = _get_user_or_404(db, username)
    project = _get_project_or_404(db, project_id)
    _require_project_roles(requester, project, [ProjectRole.OWNER, ProjectRole.MANAGER])

    _remove_member_from_project(db, project, user_id)
    db.commit()
    project = _get_project_or_404(db, project_id)
    return _serialize_memberships(project)


@router.post("/projects/{project_id}/archive", response_model=ProjectResponse)
def archive_project(
    project_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    requester = _get_user_or_404(db, username)
    project = _get_project_or_404(db, project_id)
    _require_project_roles(requester, project, [ProjectRole.OWNER])
    project.archived = True
    db.commit()
    return _get_project_or_404(db, project_id)


@router.post("/projects/{project_id}/restore", response_model=ProjectResponse)
def restore_project(
    project_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    requester = _get_user_or_404(db, username)
    project = _get_project_or_404(db, project_id)
    _require_project_roles(requester, project, [ProjectRole.OWNER])
    project.archived = False
    db.commit()
    return _get_project_or_404(db, project_id)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    requester = _get_user_or_404(db, username)
    project = _get_project_or_404(db, project_id)
    if not (_is_admin(requester) or project.owner_id == requester.id):
        raise HTTPException(status_code=403, detail="Only owner or admin can delete project")
    db.delete(project)
    db.commit()
    return None
