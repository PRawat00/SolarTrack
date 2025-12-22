"""
Family management routes.
Handles creating, joining, leaving families, and member management.
Uses invite links (Discord-style) instead of passwords.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.middleware.auth import get_current_user, TokenData
from app.models.base import get_db
from app.models.models import Family, FamilyMember, FamilyImage, FamilyInvite
from app.config import settings

router = APIRouter(prefix="/api/family", tags=["family"])


# ============ Request/Response Models ============

class FamilyCreate(BaseModel):
    """Request to create a new family."""
    name: str = Field(..., min_length=1, max_length=100)


class FamilyJoinByInvite(BaseModel):
    """Request to join a family via invite token."""
    token: str = Field(..., min_length=36, max_length=36)


class FamilyResponse(BaseModel):
    """Family details response."""
    id: str
    name: str
    owner_id: str
    member_count: int
    is_owner: bool
    created_at: str


class InviteCreate(BaseModel):
    """Request to create an invite link."""
    expires_in_hours: Optional[int] = Field(None, ge=1, le=8760)  # Max 1 year
    max_uses: Optional[int] = Field(None, ge=1, le=1000)


class InviteResponse(BaseModel):
    """Invite link response."""
    id: str
    token: str
    invite_url: str
    expires_at: Optional[str]
    max_uses: Optional[int]
    use_count: int
    is_active: bool
    created_at: str


class InviteValidation(BaseModel):
    """Result of validating an invite token."""
    valid: bool
    family_name: Optional[str]
    expires_at: Optional[str]


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


def get_readings_user_id(db: Session, user_id: str) -> str:
    """Get the user_id to use for reading/stats operations.

    If the user is in a family, returns the family owner's user_id.
    This allows all family members to share the same readings data pool.

    Args:
        db: Database session
        user_id: Current user's ID

    Returns:
        Family owner's user_id if in family, else the user's own ID
    """
    member = db.query(FamilyMember).filter(
        FamilyMember.user_id == user_id
    ).first()

    if not member:
        return user_id  # Solo user - use own ID

    # Get family owner
    family = db.query(Family).filter(Family.id == member.family_id).first()
    return family.owner_id if family else user_id


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
    Use /api/family/invites to create invite links for others to join.
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
        owner_id=family.owner_id,
        member_count=count,
        is_owner=member.role == "owner",
        created_at=family.created_at.isoformat() if family.created_at else datetime.utcnow().isoformat(),
    )


@router.post("/join", response_model=FamilyResponse)
async def join_family(
    data: FamilyJoinByInvite,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Join an existing family using an invite token.
    """
    # Check if user is already in a family
    existing = get_user_membership(db, current_user.user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of a family. Leave your current family first."
        )

    # Find and validate the invite
    now = datetime.utcnow()
    invite = db.query(FamilyInvite).filter(
        FamilyInvite.token == data.token,
        FamilyInvite.is_active == 1,  # Oracle uses 1 for true
    ).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite link"
        )

    # Check expiration
    if invite.expires_at and invite.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite link has expired"
        )

    # Check max uses
    if invite.max_uses and invite.use_count >= invite.max_uses:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite link has reached its maximum uses"
        )

    # Get the family
    family = db.query(Family).filter(Family.id == invite.family_id).first()
    if not family:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Family not found"
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

    # Increment invite use count
    invite.use_count += 1

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
                # Delete all family invites
                db.query(FamilyInvite).filter(FamilyInvite.family_id == family_id).delete()
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


# ============ Invite Endpoints ============

@router.post("/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    data: InviteCreate,
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Create a new invite link for the family.
    Any family member can create invites.
    """
    expires_at = None
    if data.expires_in_hours:
        expires_at = datetime.utcnow() + timedelta(hours=data.expires_in_hours)

    invite = FamilyInvite(
        family_id=member.family_id,
        created_by=member.user_id,
        expires_at=expires_at,
        max_uses=data.max_uses,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    # Build invite URL
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    invite_url = f"{frontend_url}/family/join?token={invite.token}"

    return InviteResponse(
        id=invite.id,
        token=invite.token,
        invite_url=invite_url,
        expires_at=invite.expires_at.isoformat() if invite.expires_at else None,
        max_uses=invite.max_uses,
        use_count=invite.use_count,
        is_active=invite.is_active,
        created_at=invite.created_at.isoformat() if invite.created_at else datetime.utcnow().isoformat(),
    )


@router.get("/invites", response_model=List[InviteResponse])
async def list_invites(
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    List all active invites for the current family.
    """
    invites = db.query(FamilyInvite).filter(
        FamilyInvite.family_id == member.family_id,
        FamilyInvite.is_active == 1,  # Oracle uses 1 for true
    ).order_by(FamilyInvite.created_at.desc()).all()

    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

    results = []
    for invite in invites:
        results.append(InviteResponse(
            id=invite.id,
            token=invite.token,
            invite_url=f"{frontend_url}/family/join?token={invite.token}",
            expires_at=invite.expires_at.isoformat() if invite.expires_at else None,
            max_uses=invite.max_uses,
            use_count=invite.use_count,
            is_active=invite.is_active,
            created_at=invite.created_at.isoformat() if invite.created_at else datetime.utcnow().isoformat(),
        ))

    return results


@router.get("/invites/{token}/validate", response_model=InviteValidation)
async def validate_invite(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Validate an invite token (public endpoint - no auth required).
    Returns family name if valid, so users can see which family they're joining.
    """
    now = datetime.utcnow()
    invite = db.query(FamilyInvite).filter(
        FamilyInvite.token == token,
        FamilyInvite.is_active == 1,  # Oracle uses 1 for true
    ).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found"
        )

    # Check expiration
    if invite.expires_at and invite.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has expired"
        )

    # Check max uses
    if invite.max_uses and invite.use_count >= invite.max_uses:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has reached its maximum uses"
        )

    # Get family name
    family = db.query(Family).filter(Family.id == invite.family_id).first()

    return InviteValidation(
        valid=True,
        family_name=family.name if family else None,
        expires_at=invite.expires_at.isoformat() if invite.expires_at else None,
    )


@router.delete("/invites/{invite_id}")
async def deactivate_invite(
    invite_id: str,
    owner: FamilyMember = Depends(require_family_owner),
    db: Session = Depends(get_db),
):
    """
    Deactivate an invite link (owner only).
    """
    invite = db.query(FamilyInvite).filter(
        FamilyInvite.id == invite_id,
        FamilyInvite.family_id == owner.family_id,
    ).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found"
        )

    invite.is_active = 0  # Oracle uses 0 for false
    db.commit()

    return {"message": "Invite deactivated successfully"}
