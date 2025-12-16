from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from typing import List
from pydantic import BaseModel
from datetime import datetime, date
from sqlalchemy import func
import json

from app.middleware.auth import get_current_user, TokenData
from app.services.ai.factory import AIProviderFactory
from app.services.ai.base import ExtractedReading
from app.models.base import get_db
from app.models.models import ProcessingJob, ApiUsage
from app.config import settings
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api", tags=["upload"])

# Allowed image types
ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
}

# Max file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024


def check_and_increment_usage(db: Session, user_id: str, provider: str = "gemini"):
    """
    Check if user is within daily API limit and increment usage counter.
    Raises HTTPException 429 if limit exceeded.
    """
    today = date.today()

    # Get today's usage record using date truncation for Oracle compatibility
    usage = db.query(ApiUsage).filter(
        ApiUsage.user_id == user_id,
        ApiUsage.provider == provider,
        func.trunc(ApiUsage.usage_date) == today
    ).first()

    # Check if limit exceeded
    if usage and usage.request_count >= settings.GEMINI_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {settings.GEMINI_DAILY_LIMIT} requests reached. Resets at midnight."
        )

    # Increment or create usage record
    if usage:
        usage.request_count += 1
    else:
        usage = ApiUsage(
            user_id=user_id,
            provider=provider,
            usage_date=datetime.now(),
            request_count=1
        )
        db.add(usage)
    db.commit()


class UploadResponse(BaseModel):
    """Response from upload endpoint."""
    readings: List[ExtractedReading]
    provider: str
    message: str
    job_id: str


@router.post("/upload", response_model=UploadResponse)
async def upload_and_process(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload an image and process with AI to extract solar readings.

    Flow:
    1. Validate file type and size
    2. Read image into memory
    3. Process with AI provider
    4. Return extracted readings
    5. Image is automatically discarded (garbage collected)

    The image is NEVER stored - it exists only in memory during processing.
    A ProcessingJob record is created for audit purposes.
    """
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Allowed: {', '.join(ALLOWED_TYPES)}"
        )

    # Read image into memory
    image_data = await file.read()

    # Validate file size
    if len(image_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
        )

    # Check rate limit before processing
    check_and_increment_usage(db, current_user.user_id, "gemini")

    try:
        # Get AI provider first so we have the name for the job
        provider = AIProviderFactory.create()
        provider_name = provider.get_provider_name()

        # Create processing job for audit trail
        job = ProcessingJob(
            user_id=current_user.user_id,
            provider=provider_name,
            status="running",
            started_at=datetime.utcnow(),
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        readings = await provider.extract_readings(
            image_data=image_data,
            mime_type=file.content_type,
        )

        # Update job with success
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.result = json.dumps([r.model_dump() for r in readings])
        db.commit()

        # Image is automatically garbage collected after this function returns
        return UploadResponse(
            readings=readings,
            provider=provider.get_provider_name(),
            message=f"Extracted {len(readings)} readings",
            job_id=job.id,
        )

    except Exception as e:
        # Update job with failure
        job.status = "failed"
        job.completed_at = datetime.utcnow()
        job.error_text = str(e)
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {str(e)}"
        )
