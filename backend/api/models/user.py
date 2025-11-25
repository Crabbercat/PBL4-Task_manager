from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    is_active: bool
    last_login: Optional[datetime] = None

    class Config:
        orm_mode = True


class UserProfile(UserResponse):
    created_at: datetime
    updated_at: datetime


class UserSummary(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str

    class Config:
        orm_mode = True
