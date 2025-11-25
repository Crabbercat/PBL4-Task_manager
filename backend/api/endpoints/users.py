from datetime import datetime
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..models.user import UserCreate, UserProfile, UserResponse
from ...core.security import get_password_hash, create_access_token, get_user_by_token, verify_password
from ...db.database import get_db
from ...db.db_structure import User

router = APIRouter()


@router.post("/register/", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    role = user.role if user.role in {"user", "manager", "admin"} else "user"
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password),
        role=role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login/")
def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials", headers={"WWW-Authenticate": "Bearer"})
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


@router.get("/users/", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    current_user = db.query(User).filter(User.username == username).first()
    if current_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return db.query(User).all()
