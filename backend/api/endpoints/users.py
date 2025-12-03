from datetime import datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from ..models.user import (
    PasswordChangeRequest,
    UserCreate,
    UserProfile,
    UserResponse,
    UserUpdate,
    UserRoleUpdate,
    UserSummary,
)
from ...core.security import get_password_hash, create_access_token, get_user_by_token, verify_password
from ...db.database import get_db
from ...db.db_structure import User, Team

router = APIRouter()


@router.post("/register/", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    display_name = user.display_name or user.username
    team_id = None
    if user.team_id:
        team = db.query(Team).filter(Team.id == user.team_id).first()
        if team is None:
            raise HTTPException(status_code=404, detail="Selected team not found")
        team_id = team.id
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password),
        role="user",
        display_name=display_name,
        team_id=team_id,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login/")
def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Username not found", headers={"WWW-Authenticate": "Bearer"})
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password", headers={"WWW-Authenticate": "Bearer"})
    user.last_login = datetime.utcnow()
    db.commit()
    jwt_token = create_access_token({"sub": user.username, "user_id": user.id, "role": user.role})
    return {"access_token": jwt_token, "token_type": "bearer", "role": user.role}


@router.get("/me/", response_model=UserProfile)
def read_current_user(db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me/", response_model=UserProfile)
def update_current_user(updates: UserUpdate, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    username_changed = False

    if updates.username is not None and updates.username.strip() != user.username:
        new_username = updates.username.strip()
        if not new_username:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        if db.query(User).filter(User.username == new_username).first():
            raise HTTPException(status_code=400, detail="Username already in use")
        user.username = new_username
        username_changed = True

    if updates.email and updates.email != user.email:
        if db.query(User).filter(User.email == updates.email).first():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = updates.email

    if updates.display_name is not None:
        user.display_name = updates.display_name or user.username

    if updates.team_id is not None:
        if updates.team_id == 0:
            user.team_id = None
        else:
            team = db.query(Team).filter(Team.id == updates.team_id).first()
            if team is None:
                raise HTTPException(status_code=404, detail="Team not found")
            user.team_id = team.id

    db.add(user)
    db.commit()
    db.refresh(user)

    if username_changed:
        new_token = create_access_token({"sub": user.username, "user_id": user.id, "role": user.role})
        setattr(user, "access_token", new_token)

    return user


@router.post("/me/password/")
def change_password(
    passwords: PasswordChangeRequest,
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token)
):
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(passwords.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # if len(passwords.new_password) < 8:
    #     raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    if passwords.current_password == passwords.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password")

    user.hashed_password = get_password_hash(passwords.new_password)
    user.updated_at = datetime.utcnow()
    db.add(user)
    db.commit()

    return {"detail": "Password updated"}


@router.get("/users/", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    current_user = db.query(User).filter(User.username == username).first()
    if current_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return db.query(User).all()


@router.get("/users/search/", response_model=List[UserSummary])
def search_users(
    query: Optional[str] = Query(None, alias="q"),
    limit: int = Query(10, ge=1, le=25),
    db: Session = Depends(get_db),
    username: str = Depends(get_user_by_token),
):
    requester = db.query(User).filter(User.username == username).first()
    if requester is None:
        raise HTTPException(status_code=404, detail="User not found")

    stmt = db.query(User).filter(User.is_active.is_(True))
    if query:
        like_value = f"%{query.lower()}%"
        stmt = stmt.filter(
            or_(
                func.lower(User.username).like(like_value),
                func.lower(User.display_name).like(like_value),
            )
        )

    return stmt.order_by(User.display_name.asc()).limit(limit).all()


@router.patch("/users/{user_id}/role/", response_model=UserResponse)
def update_user_role(user_id: int, update: UserRoleUpdate, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    current_user = db.query(User).filter(User.username == username).first()
    if current_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update roles")

    if update.role not in {"user", "manager"}:
        raise HTTPException(status_code=400, detail="Role must be user or manager")

    target_user = db.query(User).filter(User.id == user_id).first()
    if target_user is None:
        raise HTTPException(status_code=404, detail="Target user not found")

    if target_user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot change admin role")

    target_user.role = update.role
    db.add(target_user)
    db.commit()
    db.refresh(target_user)
    return target_user
