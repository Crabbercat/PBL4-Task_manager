from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship

from backend.db.database import Base


class Team(Base):
    __tablename__ = "team"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("User", back_populates="team")


project_members = Table(
    "project_member",
    Base.metadata,
    Column("project_id", ForeignKey("project.id"), primary_key=True),
    Column("user_id", ForeignKey("user.id"), primary_key=True),
    Column("joined_at", DateTime, default=datetime.utcnow)
)


class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    display_name = Column(String(100), nullable=True)
    team_id = Column(Integer, ForeignKey("team.id"), nullable=True)
    role = Column(String(20), default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    owned_projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    projects = relationship("Project", secondary=project_members, back_populates="members")
    tasks_created = relationship("Task", back_populates="creator", foreign_keys="Task.creator_id")
    tasks_assigned = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")
    team = relationship("Team", back_populates="members")


class Project(Base):
    __tablename__ = "project"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    color = Column(String(20), nullable=True)
    owner_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="owned_projects")
    members = relationship("User", secondary=project_members, back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "task"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), index=True, nullable=False)
    description = Column(String(1000), nullable=True)
    completed = Column(Boolean, default=False)
    status = Column(String(20), default='to_do')
    priority = Column(String(20), default='medium')
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    tags = Column(String(200), nullable=True)
    creator_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=True)
    is_personal = Column(Boolean, default=False, nullable=False)
    parent_task_id = Column(Integer, ForeignKey("task.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", back_populates="tasks_created", foreign_keys=[creator_id])
    assignee = relationship("User", back_populates="tasks_assigned", foreign_keys=[assignee_id])
    project = relationship("Project", back_populates="tasks")
    parent_task = relationship("Task", remote_side=[id], back_populates="subtasks")
    subtasks = relationship("Task", back_populates="parent_task", cascade="all, delete-orphan")
