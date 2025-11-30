from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .user import UserSummary


class ProjectRole(str, Enum):
    OWNER = "owner"
    MANAGER = "manager"
    MEMBER = "member"


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
    archived: Optional[bool] = None


class ProjectMemberAdd(BaseModel):
    user_id: int
    role: ProjectRole = ProjectRole.MEMBER


class ProjectMemberRoleUpdate(BaseModel):
    role: ProjectRole


class ProjectSlim(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: Optional[str] = None
    archived: bool
    owner_id: int


class ProjectMemberSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserSummary
    role: ProjectRole
    joined_at: datetime


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner: UserSummary
    archived: bool
    memberships: List[ProjectMemberSummary]
    member_count: int
    task_count: int
    created_at: datetime
    updated_at: datetime
