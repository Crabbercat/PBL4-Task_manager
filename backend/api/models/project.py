from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from .user import UserSummary


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class ProjectCreate(ProjectBase):
    member_ids: List[int] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    member_ids: Optional[List[int]] = None


class ProjectSlim(BaseModel):
    id: int
    name: str
    color: Optional[str] = None

    class Config:
        orm_mode = True


class ProjectResponse(ProjectBase):
    id: int
    owner: UserSummary
    members: List[UserSummary]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
