from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TeamResponse(TeamBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by: str
    created_at: datetime
    updated_at: datetime


class TeamSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
