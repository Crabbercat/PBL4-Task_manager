from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..models.project import ProjectCreate, ProjectResponse, ProjectUpdate
from ...core.security import get_user_by_token
from ...db.database import get_db
from ...db.db_structure import Project, User

router = APIRouter()


def _get_user_or_404(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found or inactive")
    return user


def _get_project_detail(db: Session, project_id: int) -> Project:
    project = (
        db.query(Project)
        .options(joinedload(Project.owner), joinedload(Project.members))
        .filter(Project.id == project_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _ensure_owner(user: User, project: Project):
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can perform this action")


def _ensure_member(user: User, project: Project):
    member_ids = {member.id for member in project.members}
    member_ids.add(project.owner_id)
    if user.id not in member_ids:
        raise HTTPException(status_code=403, detail="You are not a member of this project")


def _sync_members(db: Session, project: Project, member_ids: List[int]):
    if member_ids is None:
        return
    if project.owner_id in member_ids:
        member_ids = [mid for mid in member_ids if mid != project.owner_id]
    members = []
    if member_ids:
        members = db.query(User).filter(User.id.in_(member_ids)).all()
        if len(members) != len(set(member_ids)):
            raise HTTPException(status_code=400, detail="One or more members do not exist")
    project.members = [project.owner]
    for member in members:
        if member.id != project.owner_id:
            project.members.append(member)


@router.post("/projects/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    owner = _get_user_or_404(db, username)
    new_project = Project(
        name=project.name,
        description=project.description,
        color=project.color,
        owner_id=owner.id,
    )
    new_project.owner = owner
    new_project.members.append(owner)
    db.add(new_project)
    db.flush()
    if project.member_ids:
        _sync_members(db, new_project, project.member_ids)
    db.commit()
    db.refresh(new_project)
    return new_project


@router.get("/projects/", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    user = _get_user_or_404(db, username)
    projects = (
        db.query(Project)
        .options(joinedload(Project.owner), joinedload(Project.members))
        .filter(
            (Project.owner_id == user.id)
            | (Project.members.any(User.id == user.id))
        )
        .all()
    )
    return projects


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    user = _get_user_or_404(db, username)
    project = _get_project_detail(db, project_id)
    _ensure_member(user, project)
    return project


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token)
):
    owner = _get_user_or_404(db, username)
    project = _get_project_detail(db, project_id)
    _ensure_owner(owner, project)
    update_data = project_update.dict(exclude_unset=True)
    member_ids = update_data.pop("member_ids", None)
    for key, value in update_data.items():
        setattr(project, key, value)
    if member_ids is not None:
        _sync_members(db, project, member_ids)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    owner = _get_user_or_404(db, username)
    project = _get_project_detail(db, project_id)
    _ensure_owner(owner, project)
    db.delete(project)
    db.commit()
    return None
