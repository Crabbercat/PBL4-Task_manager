from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...core.security import get_user_by_token
from ...db.database import get_db
from ...db.db_structure import Team, User
from ..models.team import TeamCreate, TeamResponse, TeamSummary, TeamUpdate

router = APIRouter()


@router.get("/teams/public/", response_model=List[TeamSummary])
def list_public_teams(db: Session = Depends(get_db)):
    return db.query(Team).order_by(Team.name.asc()).all()


@router.get("/teams/", response_model=List[TeamResponse])
def list_teams(db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    if username != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view full team details")
    return db.query(Team).order_by(Team.name.asc()).all()


@router.post("/teams/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(team: TeamCreate, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    if username != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create teams")

    clean_name = team.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Team name cannot be empty")

    existing = (db.query(Team)
                .filter(func.lower(Team.name) == func.lower(clean_name))
                .first())
    if existing:
        raise HTTPException(status_code=400, detail="Team name already exists")

    db_team = Team(
        name=clean_name,
        description=team.description,
        created_by=username,
    )
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


@router.put("/teams/{team_id}/", response_model=TeamResponse)
def update_team(team_id: int, team: TeamUpdate, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    if username != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update teams")

    db_team = db.query(Team).filter(Team.id == team_id).first()
    if db_team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.name is not None:
        clean_name = team.name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Team name cannot be empty")
        existing = (db.query(Team)
                    .filter(func.lower(Team.name) == func.lower(clean_name), Team.id != team_id)
                    .first())
        if existing:
            raise HTTPException(status_code=400, detail="Team name already exists")
        db_team.name = clean_name

    if team.description is not None:
        db_team.description = team.description.strip() or None

    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


@router.delete("/teams/{team_id}/", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(team_id: int, db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    if username != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete teams")

    db_team = db.query(Team).filter(Team.id == team_id).first()
    if db_team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    db.delete(db_team)
    db.commit()


@router.post("/teams/{team_id}/members/", status_code=status.HTTP_200_OK)
def add_team_members(team_id: int, user_ids: List[int], db: Session = Depends(get_db), username: str = Depends(get_user_by_token)):
    if username != "admin":
        raise HTTPException(status_code=403, detail="Only admin can assign members")

    db_team = db.query(Team).filter(Team.id == team_id).first()
    if db_team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    # Verify all users exist
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    if len(users) != len(user_ids):
        raise HTTPException(status_code=400, detail="One or more users not found")

    for user in users:
        user.team_id = team_id
    
    db.commit()
    return {"message": f"Added {len(users)} members to team {db_team.name}"}
