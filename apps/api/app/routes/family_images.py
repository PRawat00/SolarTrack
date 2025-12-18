"""
Family image pool routes.
Handles uploading, claiming, processing, and managing shared family images.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
import json

from app.middleware.auth import get_current_user, TokenData
from app.models.base import get_db
from app.models.models import Family, FamilyMember, FamilyImage, ProcessingJob, generate_uuid_hex
from app.services.file_storage import FileStorageService
from app.services.ai.factory import AIProviderFactory
from app.config import settings
from app.routes.family import require_family_member, get_user_membership
from app.routes.upload import check_and_increment_usage, ALLOWED_TYPES, MAX_FILE_SIZE

router = APIRouter(prefix="/api/family/images", tags=["family-images"])


# ============ Request/Response Models ============

class FamilyImageResponse(BaseModel):
    """Family image response."""
    id: str
    filename: str
    uploader_id: str
    uploader_name: Optional[str]
    status: str
    claimed_by: Optional[str]
    claimed_by_name: Optional[str]
    processed_by: Optional[str]
    processed_by_name: Optional[str]
    readings_count: int
    file_size: int
    created_at: str
    claimed_at: Optional[str]
    processed_at: Optional[str]


class ProcessResponse(BaseModel):
    """Response from processing an image."""
    readings: List[dict]
    provider: str
    message: str
    job_id: str
    image_id: str


class ImageListResponse(BaseModel):
    """List of images with counts."""
    images: List[FamilyImageResponse]
    total: int
    pending_count: int
    claimed_count: int
    processed_count: int


# ============ Helper Functions ============

def get_member_display_name(db: Session, user_id: str, family_id: str) -> Optional[str]:
    """Get a member's display name."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user_id
    ).first()
    return member.display_name if member else None


def image_to_response(db: Session, image: FamilyImage) -> FamilyImageResponse:
    """Convert FamilyImage to response model."""
    return FamilyImageResponse(
        id=image.id,
        filename=image.filename,
        uploader_id=image.uploader_id,
        uploader_name=get_member_display_name(db, image.uploader_id, image.family_id),
        status=image.status,
        claimed_by=image.claimed_by,
        claimed_by_name=get_member_display_name(db, image.claimed_by, image.family_id) if image.claimed_by else None,
        processed_by=image.processed_by,
        processed_by_name=get_member_display_name(db, image.processed_by, image.family_id) if image.processed_by else None,
        readings_count=image.readings_count or 0,
        file_size=image.file_size,
        created_at=image.created_at.isoformat() if image.created_at else datetime.utcnow().isoformat(),
        claimed_at=image.claimed_at.isoformat() if image.claimed_at else None,
        processed_at=image.processed_at.isoformat() if image.processed_at else None,
    )


# ============ Routes ============

@router.post("/upload", response_model=List[FamilyImageResponse])
async def upload_images(
    files: List[UploadFile] = File(...),
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Bulk upload images to the family pool.
    Images are stored on the filesystem and metadata is saved to the database.
    """
    # Check pending image limit
    pending_count = db.query(FamilyImage).filter(
        FamilyImage.family_id == member.family_id,
        FamilyImage.status.in_(["pending", "claimed", "processing"])
    ).count()

    if pending_count + len(files) > settings.FAMILY_MAX_PENDING_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many pending images. Maximum is {settings.FAMILY_MAX_PENDING_IMAGES}. "
                   f"Currently have {pending_count} pending."
        )

    uploaded = []

    for file in files:
        # Validate file type
        if file.content_type not in ALLOWED_TYPES:
            continue  # Skip invalid files

        # Read file data
        data = await file.read()

        # Validate file size
        if len(data) > MAX_FILE_SIZE:
            continue  # Skip oversized files

        # Create image record first to get ID
        image_id = generate_uuid_hex()
        image = FamilyImage(
            id=image_id,
            family_id=member.family_id,
            uploader_id=member.user_id,
            filename=file.filename or "unknown",
            storage_path="",  # Will be updated after saving
            mime_type=file.content_type,
            file_size=len(data),
            status="pending",
        )

        # Save to filesystem
        try:
            storage_path = await FileStorageService.save_image(
                family_id=member.family_id,
                image_id=image_id,
                filename=file.filename or "image",
                data=data,
            )
            image.storage_path = storage_path
        except Exception as e:
            # If file save fails, skip this image
            continue

        db.add(image)
        uploaded.append(image)

    db.commit()

    # Refresh all images to get updated values
    for img in uploaded:
        db.refresh(img)

    return [image_to_response(db, img) for img in uploaded]


@router.get("", response_model=ImageListResponse)
async def list_images(
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    List images in the family pool.
    Optionally filter by status: pending, claimed, processing, processed, error
    """
    query = db.query(FamilyImage).filter(
        FamilyImage.family_id == member.family_id
    )

    if status_filter:
        query = query.filter(FamilyImage.status == status_filter)

    total = query.count()

    images = query.order_by(FamilyImage.created_at.desc()).offset(offset).limit(limit).all()

    # Get counts
    pending_count = db.query(FamilyImage).filter(
        FamilyImage.family_id == member.family_id,
        FamilyImage.status == "pending"
    ).count()

    claimed_count = db.query(FamilyImage).filter(
        FamilyImage.family_id == member.family_id,
        FamilyImage.status.in_(["claimed", "processing"])
    ).count()

    processed_count = db.query(FamilyImage).filter(
        FamilyImage.family_id == member.family_id,
        FamilyImage.status == "processed"
    ).count()

    return ImageListResponse(
        images=[image_to_response(db, img) for img in images],
        total=total,
        pending_count=pending_count,
        claimed_count=claimed_count,
        processed_count=processed_count,
    )


@router.post("/{image_id}/claim", response_model=FamilyImageResponse)
async def claim_image(
    image_id: str,
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Claim an image for processing.
    Uses database-level locking to prevent race conditions.
    Claims expire after 30 minutes.
    """
    now = datetime.utcnow()
    timeout_threshold = now - timedelta(minutes=settings.FAMILY_CLAIM_TIMEOUT_MINUTES)

    # Query with FOR UPDATE to lock the row
    image = db.query(FamilyImage).filter(
        FamilyImage.id == image_id,
        FamilyImage.family_id == member.family_id,
        or_(
            FamilyImage.status == "pending",
            and_(
                FamilyImage.status == "claimed",
                FamilyImage.claimed_at < timeout_threshold
            )
        )
    ).with_for_update().first()

    if not image:
        # Check if image exists but is not claimable
        existing = db.query(FamilyImage).filter(
            FamilyImage.id == image_id,
            FamilyImage.family_id == member.family_id
        ).first()

        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )

        if existing.status == "processed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image has already been processed"
            )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Image is currently claimed by another user"
        )

    # Claim it
    image.status = "claimed"
    image.claimed_by = member.user_id
    image.claimed_at = now

    db.commit()
    db.refresh(image)

    return image_to_response(db, image)


@router.post("/{image_id}/release")
async def release_image(
    image_id: str,
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Release a claimed image back to the pool.
    Only the user who claimed it can release it.
    """
    image = db.query(FamilyImage).filter(
        FamilyImage.id == image_id,
        FamilyImage.family_id == member.family_id,
        FamilyImage.claimed_by == member.user_id,
        FamilyImage.status.in_(["claimed", "processing"])
    ).first()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found or not claimed by you"
        )

    image.status = "pending"
    image.claimed_by = None
    image.claimed_at = None

    db.commit()

    return {"message": "Image released"}


@router.get("/{image_id}/download")
async def download_image(
    image_id: str,
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Download the image file.
    Only available to family members.
    """
    image = db.query(FamilyImage).filter(
        FamilyImage.id == image_id,
        FamilyImage.family_id == member.family_id
    ).first()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    try:
        data = await FileStorageService.read_image(image.storage_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image file not found on disk"
        )

    return Response(
        content=data,
        media_type=image.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{image.filename}"'
        }
    )


@router.post("/{image_id}/process", response_model=ProcessResponse)
async def process_image(
    image_id: str,
    current_user: TokenData = Depends(get_current_user),
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Process a claimed image with AI to extract readings.
    The image must be claimed by the current user.
    """
    # Get and verify the image
    image = db.query(FamilyImage).filter(
        FamilyImage.id == image_id,
        FamilyImage.family_id == member.family_id,
        FamilyImage.claimed_by == member.user_id,
        FamilyImage.status == "claimed"
    ).first()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found, not claimed by you, or already processed"
        )

    # Update status to processing
    image.status = "processing"
    db.commit()

    # Check rate limit
    check_and_increment_usage(db, current_user.user_id, "gemini")

    job = None
    try:
        # Read image from filesystem
        image_data = await FileStorageService.read_image(image.storage_path)

        # Get AI provider
        provider = AIProviderFactory.create()
        provider_name = provider.get_provider_name()

        # Create processing job for audit
        job = ProcessingJob(
            user_id=current_user.user_id,
            provider=provider_name,
            status="running",
            started_at=datetime.utcnow(),
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # Process with AI
        result = await provider.extract_readings(
            image_data=image_data,
            mime_type=image.mime_type,
        )

        if not result.success:
            # Update image status to error
            image.status = "error"
            image.error_message = result.error
            image.processed_by = member.user_id
            image.processed_at = datetime.utcnow()

            job.status = "failed"
            job.completed_at = datetime.utcnow()
            job.error_text = result.error
            db.commit()

            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.error or "Failed to extract readings from image"
            )

        # Update image as processed
        image.status = "processed"
        image.processed_by = member.user_id
        image.processed_at = datetime.utcnow()
        image.readings_count = len(result.readings)

        # Update job
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.result = json.dumps([r.model_dump() for r in result.readings])
        db.commit()

        return ProcessResponse(
            readings=[r.model_dump() for r in result.readings],
            provider=provider_name,
            message=f"Extracted {len(result.readings)} readings",
            job_id=job.id,
            image_id=image.id,
        )

    except HTTPException:
        raise
    except FileNotFoundError:
        image.status = "error"
        image.error_message = "Image file not found on disk"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image file not found on disk"
        )
    except Exception as e:
        # Update statuses on failure
        image.status = "error"
        image.error_message = str(e)
        if job:
            job.status = "failed"
            job.completed_at = datetime.utcnow()
            job.error_text = str(e)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {str(e)}"
        )


@router.delete("/{image_id}")
async def delete_image(
    image_id: str,
    member: FamilyMember = Depends(require_family_member),
    db: Session = Depends(get_db),
):
    """
    Delete an image from the pool.
    Only the uploader or family owner can delete.
    """
    image = db.query(FamilyImage).filter(
        FamilyImage.id == image_id,
        FamilyImage.family_id == member.family_id
    ).first()

    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )

    # Check permission: must be uploader or owner
    is_uploader = image.uploader_id == member.user_id
    is_owner = member.role == "owner"

    if not is_uploader and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the uploader or family owner can delete images"
        )

    # Delete file from disk
    try:
        await FileStorageService.delete_image(image.storage_path)
    except Exception:
        pass  # File might already be gone

    # Delete from database
    db.delete(image)
    db.commit()

    return {"message": "Image deleted"}
