"""
Family statistics and leaderboard routes.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime

from app.models.base import get_db
from app.models.models import FamilyMember, FamilyImage, SolarReading
from app.routes.family import require_family_member

router = APIRouter(prefix="/api/family", tags=["family-stats"])


# ============ Response Models ============

class LeaderboardEntry(BaseModel):
    """Leaderboard entry for a family member."""
    rank: int
    user_id: str
    display_name: Optional[str]
    images_processed: int
    readings_extracted: int
    contribution_percent: float
    last_activity: Optional[str]


class FamilyStatsResponse(BaseModel):
    """Aggregate family statistics."""
    total_images: int
    pending_images: int
    processed_images: int
    total_readings_extracted: int
    member_count: int


class DashboardResponse(BaseModel):
    """Combined dashboard data."""
    stats: FamilyStatsResponse
    leaderboard: List[LeaderboardEntry]
    recent_activity: List[dict]


# ============ Routes ============

@router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Get the family leaderboard ranked by images processed.
    """
    family_id = member.family_id

    # Query members with their processed image counts
    results = db.query(
        FamilyMember.user_id,
        FamilyMember.display_name,
        func.count(FamilyImage.id).label('images_processed'),
        func.coalesce(func.sum(FamilyImage.readings_count), 0).label('readings_extracted'),
        func.max(FamilyImage.processed_at).label('last_activity')
    ).outerjoin(
        FamilyImage,
        (FamilyImage.processed_by == FamilyMember.user_id) &
        (FamilyImage.status == 'processed')
    ).filter(
        FamilyMember.family_id == family_id
    ).group_by(
        FamilyMember.user_id,
        FamilyMember.display_name
    ).order_by(
        desc('images_processed'),
        desc('readings_extracted')
    ).all()

    # Calculate total for percentage
    total_processed = sum(r.images_processed for r in results)

    leaderboard = []
    for i, r in enumerate(results):
        contribution = (r.images_processed / total_processed * 100) if total_processed > 0 else 0
        leaderboard.append(LeaderboardEntry(
            rank=i + 1,
            user_id=r.user_id,
            display_name=r.display_name,
            images_processed=r.images_processed or 0,
            readings_extracted=int(r.readings_extracted or 0),
            contribution_percent=round(contribution, 1),
            last_activity=r.last_activity.isoformat() if r.last_activity else None,
        ))

    return leaderboard


@router.get("/stats", response_model=FamilyStatsResponse)
async def get_family_stats(
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Get aggregate statistics for the family.
    """
    family_id = member.family_id

    # Image counts
    total_images = db.query(FamilyImage).filter(
        FamilyImage.family_id == family_id
    ).count()

    pending_images = db.query(FamilyImage).filter(
        FamilyImage.family_id == family_id,
        FamilyImage.status.in_(["pending", "claimed", "processing"])
    ).count()

    processed_images = db.query(FamilyImage).filter(
        FamilyImage.family_id == family_id,
        FamilyImage.status == "processed"
    ).count()

    # Total readings extracted
    total_readings = db.query(func.coalesce(func.sum(FamilyImage.readings_count), 0)).filter(
        FamilyImage.family_id == family_id,
        FamilyImage.status == "processed"
    ).scalar() or 0

    # Member count
    member_count = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id
    ).count()

    return FamilyStatsResponse(
        total_images=total_images,
        pending_images=pending_images,
        processed_images=processed_images,
        total_readings_extracted=int(total_readings),
        member_count=member_count,
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Get combined dashboard data including stats, leaderboard, and recent activity.
    """
    family_id = member.family_id

    # Get stats
    stats = await get_family_stats(member, db)

    # Get leaderboard
    leaderboard = await get_leaderboard(member, db)

    # Get recent activity (last 10 processed images)
    recent_images = db.query(FamilyImage).filter(
        FamilyImage.family_id == family_id,
        FamilyImage.status == "processed"
    ).order_by(FamilyImage.processed_at.desc()).limit(10).all()

    # Get display names for processors
    processor_names = {}
    processor_ids = set(img.processed_by for img in recent_images if img.processed_by)
    if processor_ids:
        members = db.query(FamilyMember).filter(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id.in_(processor_ids)
        ).all()
        processor_names = {m.user_id: m.display_name for m in members}

    recent_activity = [
        {
            "image_id": img.id,
            "filename": img.filename,
            "processed_by": img.processed_by,
            "processed_by_name": processor_names.get(img.processed_by),
            "readings_count": img.readings_count,
            "processed_at": img.processed_at.isoformat() if img.processed_at else None,
        }
        for img in recent_images
    ]

    return DashboardResponse(
        stats=stats,
        leaderboard=leaderboard,
        recent_activity=recent_activity,
    )
