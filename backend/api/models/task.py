from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from .project import ProjectSlim
from .user import UserSummary


class TaskStatus(str, Enum):
    TO_DO = 'to_do'
    IN_PROGRESS = 'in_progress'
    DONE = 'done'


class TaskPriority(str, Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TO_DO
    priority: TaskPriority = TaskPriority.MEDIUM
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    tags: Optional[str] = None


class TaskCreate(TaskBase):
    project_id: int
    assignee_id: Optional[int] = None
    parent_task_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    tags: Optional[str] = None
    assignee_id: Optional[int] = None
    parent_task_id: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    completed: bool
    status: TaskStatus
    priority: TaskPriority
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    due_date: Optional[datetime]
    tags: Optional[str]
    project: ProjectSlim
    creator: UserSummary
    assignee: Optional[UserSummary]
    parent_task_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
