from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict

from .team import TeamSummary


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: Optional[str] = None
    team_id: Optional[int] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None
    team_id: Optional[int] = None


class UserRoleUpdate(BaseModel):
    role: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    display_name: Optional[str]
    team_id: Optional[int]
    team: Optional[TeamSummary] = None
    role: str
    is_active: bool
    last_login: Optional[datetime] = None


class UserProfile(UserResponse):
    model_config = ConfigDict(from_attributes=True)

    created_at: datetime
    updated_at: datetime
    access_token: Optional[str] = None


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    display_name: Optional[str]
    team_id: Optional[int]
    role: str
