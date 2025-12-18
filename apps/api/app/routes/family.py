"""
Family management routes.
Handles creating, joining, leaving families, and member management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from app.middleware.auth import get_current_user, TokenData
from app.models.base import get_db
from app.models.models import Family, FamilyMember, FamilyImage
from app.config import settings

router = APIRouter(prefix="/api/family", tags=["family"])


# ============ Request/Response Models ============

class FamilyCreate(BaseModel):
    """Request to create a new family."""
    name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=4, max_length=50)


class FamilyJoin(BaseModel):
    """Request to join a family."""
    join_code: str = Field(..., min_length=6, max_length=10)
    password: str = Field(..., min_length=1)


class FamilyResponse(BaseModel):
    """Family details response."""
    id: str
    name: str
    join_code: str
    owner_id: str
    member_count: int
    is_owner: bool
    created_at: str


class MemberResponse(BaseModel):
    """Family member response."""
    id: str
    user_id: str
    display_name: Optional[str]
    email: Optional[str]
    role: str
    joined_at: str
    images_processed: int


class UpdateDisplayName(BaseModel):
    """Update member display name."""
    display_name: str = Field(..., min_length=1, max_length=100)


# ============ Helper Functions ============

def get_user_membership(db: Session, user_id: str) -> Optional[FamilyMember]:
    """Get user's current family membership, if any."""
    return db.query(FamilyMember).filter(
        FamilyMember.user_id == user_id
    ).first()


def get_family_with_count(db: Session, family_id: str) -> tuple[Optional[Family], int]:
    """Get family and member count."""
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        return None, 0
    count = db.query(FamilyMember).filter(FamilyMember.family_id == family_id).count()
    return family, count


def get_member_images_processed(db: Session, user_id: str) -> int:
    """Get count of images processed by a user."""
    return db.query(FamilyImage).filter(
        FamilyImage.processed_by == user_id,
        FamilyImage.status == "processed"
    ).count()


# ============ Dependency: Require Family Membership ============

async def require_family_member(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FamilyMember:
    """Dependency that requires user to be in a family."""
    member = get_user_membership(db, current_user.user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of any family"
        )
    return member


async def require_family_owner(
    member: FamilyMember = Depends(require_family_member),
) -> FamilyMember:
    """Dependency that requires user to be the family owner."""
    if member.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the family owner can perform this action"
        )
    return member


# ============ Routes ============

@router.post("", response_model=FamilyResponse, status_code=status.HTTP_201_CREATED)
async def create_family(
    data: FamilyCreate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new family.
    The creating user becomes the owner.
    """
    # Check if user is already in a family
    existing = get_user_membership(db, current_user.user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of a family. Leave your current family first."
        )

    # Create the family
    family = Family(
        name=data.name,
        owner_id=current_user.user_id,
    )
    family.set_password(data.password)
    db.add(family)
    db.flush()  # Get the ID

    # Add owner as first member
    member = FamilyMember(
        family_id=family.id,
        user_id=current_user.user_id,
        display_name=current_user.email.split("@")[0] if current_user.email else None,
        role="owner",
    )
    db.add(member)
    db.commit()
    db.refresh(family)

    return FamilyResponse(
        id=family.id,
        name=family.name,
        join_code=family.join_code,
        owner_id=family.owner_id,
        member_count=1,
        is_owner=True,
        created_at=family.created_at.isoformat() if family.created_at else datetime.utcnow().isoformat(),
    )


@router.get("", response_model=Optional[FamilyResponse])
async def get_my_family(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the current user's family, or null if not in a family.
    """
    member = get_user_membership(db, current_user.user_id)
    if not member:
        return None

    family, count = get_family_with_count(db, member.family_id)
    if not family:
        return None

    return FamilyResponse(
        id=family.id,
        name=family.name,
        join_code=family.join_code,
        owner_id=family.owner_id,
        member_count=count,
        is_owner=member.role == "owner",
        created_at=family.created_at.isoformat() if family.created_at else datetime.utcnow().isoformat(),
    )


@router.post("/join", response_model=FamilyResponse)
async def join_family(
    data: FamilyJoin,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Join an existing family using join code and password.
    """
    # Check if user is already in a family
    existing = get_user_membership(db, current_user.user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of a family. Leave your current family first."
        )

    # Find the family by join code (case-insensitive)
    family = db.query(Family).filter(
        Family.join_code == data.join_code.upper()
    ).first()

    if not family:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Family not found. Check the join code."
        )

    # Verify password
    if not family.verify_password(data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )

    # Check member limit
    current_count = db.query(FamilyMember).filter(
        FamilyMember.family_id == family.id
    ).count()

    if current_count >= settings.FAMILY_MAX_MEMBERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Family has reached maximum capacity of {settings.FAMILY_MAX_MEMBERS} members"
        )

    # Add as member
    member = FamilyMember(
        family_id=family.id,
        user_id=current_user.user_id,
        display_name=current_user.email.split("@")[0] if current_user.email else None,
        role="member",
    )
    db.add(member)
    db.commit()

    return FamilyResponse(
        id=family.id,
        name=family.name,
        join_code=family.join_code,
        owner_id=family.owner_id,
        member_count=current_count + 1,
        is_owner=False,
        created_at=family.created_at.isoformat() if family.created_at else datetime.utcnow().isoformat(),
    )


@router.post("/leave")
async def leave_family(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Leave the current family.
    If owner leaves and there are other members, ownership transfers to the oldest member.
    If owner is the last member, the family is deleted.
    """
    member = get_user_membership(db, current_user.user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a member of any family"
        )

    family_id = member.family_id
    is_owner = member.role == "owner"

    # Get other members
    other_members = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id != current_user.user_id
    ).order_by(FamilyMember.joined_at).all()

    # Remove the leaving member
    db.delete(member)

    if is_owner:
        if other_members:
            # Transfer ownership to oldest member
            new_owner = other_members[0]
            new_owner.role = "owner"

            # Update family owner_id
            family = db.query(Family).filter(Family.id == family_id).first()
            if family:
                family.owner_id = new_owner.user_id
        else:
            # Last member leaving - delete the family
            family = db.query(Family).filter(Family.id == family_id).first()
            if family:
                # Delete all family images from DB (files handled separately)
                db.query(FamilyImage).filter(FamilyImage.family_id == family_id).delete()
                db.delete(family)

    db.commit()

    return {"message": "Successfully left the family"}


@router.get("/members", response_model=List[MemberResponse])
async def list_members(
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    List all members of the current user's family.
    """
    members = db.query(FamilyMember).filter(
        FamilyMember.family_id == member.family_id
    ).order_by(FamilyMember.joined_at).all()

    results = []
    for m in members:
        images_processed = get_member_images_processed(db, m.user_id)
        results.append(MemberResponse(
            id=m.id,
            user_id=m.user_id,
            display_name=m.display_name,
            email=None,  # Don't expose other users' emails
            role=m.role,
            joined_at=m.joined_at.isoformat() if m.joined_at else datetime.utcnow().isoformat(),
            images_processed=images_processed,
        ))

    return results


@router.delete("/members/{user_id}")
async def remove_member(
    user_id: str,
    owner: FamilyMember = Depends(require_family_owner),
    db: Session = Depends(get_db),
):
    """
    Remove a member from the family (owner only).
    Cannot remove yourself - use /leave instead.
    """
    if user_id == owner.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself. Use the leave endpoint instead."
        )

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == owner.family_id,
        FamilyMember.user_id == user_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in your family"
        )

    db.delete(member)
    db.commit()

    return {"message": "Member removed successfully"}


@router.patch("/display-name", response_model=MemberResponse)
async def update_display_name(
    data: UpdateDisplayName,
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Update your display name in the family.
    """
    member.display_name = data.display_name
    db.commit()
    db.refresh(member)

    images_processed = get_member_images_processed(db, member.user_id)

    return MemberResponse(
        id=member.id,
        user_id=member.user_id,
        display_name=member.display_name,
        email=None,
        role=member.role,
        joined_at=member.joined_at.isoformat() if member.joined_at else datetime.utcnow().isoformat(),
        images_processed=images_processed,
    )
