from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.middleware.auth import get_current_user, TokenData
from app.models.base import get_db
from app.models.models import SolarReading

router = APIRouter(prefix="/api", tags=["readings"])


class ReadingCreate(BaseModel):
    """Request body for creating a reading."""
    date: str  # YYYY-MM-DD format
    time: Optional[str] = None  # HH:MM format
    m1: float  # Meter 1 reading (kWh)
    m2: Optional[float] = None  # Meter 2 reading (kWh)
    notes: Optional[str] = None
    is_verified: bool = False


class ReadingUpdate(BaseModel):
    """Request body for updating a reading."""
    date: Optional[str] = None
    time: Optional[str] = None
    m1: Optional[float] = None
    m2: Optional[float] = None
    notes: Optional[str] = None
    is_verified: Optional[bool] = None


class ReadingResponse(BaseModel):
    """Response body for a reading."""
    id: str
    user_id: str
    date: str
    time: Optional[str]
    m1: float
    m2: Optional[float]
    notes: Optional[str]
    is_verified: bool
    # Weather data
    weather_code: Optional[int]
    temp_max: Optional[float]
    sunshine_hours: Optional[float]
    radiation_sum: Optional[float]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ReadingsListResponse(BaseModel):
    """Response body for list of readings."""
    data: List[ReadingResponse]
    total: int
    limit: int
    offset: int


def _reading_to_response(reading: SolarReading) -> ReadingResponse:
    """Convert SQLAlchemy model to response."""
    return ReadingResponse(
        id=reading.id,
        user_id=reading.user_id,
        date=reading.reading_date.strftime("%Y-%m-%d") if reading.reading_date else "",
        time=reading.reading_time,
        m1=float(reading.m1) if reading.m1 else 0.0,
        m2=float(reading.m2) if reading.m2 else None,
        notes=reading.notes,
        is_verified=bool(reading.is_verified),
        weather_code=reading.weather_code,
        temp_max=float(reading.temp_max) if reading.temp_max is not None else None,
        sunshine_hours=float(reading.sunshine_hours) if reading.sunshine_hours is not None else None,
        radiation_sum=float(reading.radiation_sum) if reading.radiation_sum is not None else None,
        created_at=reading.created_at.isoformat() if reading.created_at else "",
        updated_at=reading.updated_at.isoformat() if reading.updated_at else "",
    )


@router.get("/readings", response_model=ReadingsListResponse)
async def get_readings(
    start_date: Optional[str] = Query(None, description="Filter start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter end date (YYYY-MM-DD)"),
    limit: int = Query(100, le=500, description="Max results to return"),
    offset: int = Query(0, description="Number of results to skip"),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get user's solar readings with optional date filtering.

    Results are ordered by date descending (newest first).
    """
    query = db.query(SolarReading).filter(
        SolarReading.user_id == current_user.user_id
    )

    if start_date:
        query = query.filter(SolarReading.reading_date >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(SolarReading.reading_date <= datetime.fromisoformat(end_date))

    total = query.count()
    readings = query.order_by(SolarReading.reading_date.desc()).offset(offset).limit(limit).all()

    return ReadingsListResponse(
        data=[_reading_to_response(r) for r in readings],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/readings", response_model=ReadingResponse)
async def create_reading(
    reading: ReadingCreate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a single solar reading."""
    db_reading = SolarReading(
        user_id=current_user.user_id,
        reading_date=datetime.fromisoformat(reading.date),
        reading_time=reading.time,
        m1=reading.m1,
        m2=reading.m2,
        notes=reading.notes,
        is_verified=1 if reading.is_verified else 0,
    )
    db.add(db_reading)
    db.commit()
    db.refresh(db_reading)

    return _reading_to_response(db_reading)


@router.post("/readings/bulk", response_model=List[ReadingResponse])
async def create_readings_bulk(
    readings: List[ReadingCreate],
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create multiple readings at once.

    Used for confirming AI-extracted readings from uploaded images.
    """
    if not readings:
        raise HTTPException(status_code=400, detail="No readings provided")

    if len(readings) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 readings per request")

    db_readings = []
    for reading in readings:
        db_reading = SolarReading(
            user_id=current_user.user_id,
            reading_date=datetime.fromisoformat(reading.date),
            reading_time=reading.time,
            m1=reading.m1,
            m2=reading.m2,
            notes=reading.notes,
            is_verified=1 if reading.is_verified else 0,
        )
        db.add(db_reading)
        db_readings.append(db_reading)

    db.commit()

    # Refresh all to get generated IDs and timestamps
    for r in db_readings:
        db.refresh(r)

    return [_reading_to_response(r) for r in db_readings]


@router.delete("/readings/{reading_id}")
async def delete_reading(
    reading_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a solar reading."""
    reading = db.query(SolarReading).filter(
        SolarReading.id == reading_id,
        SolarReading.user_id == current_user.user_id,
    ).first()

    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found")

    db.delete(reading)
    db.commit()

    return {"message": "Reading deleted"}


@router.patch("/readings/{reading_id}", response_model=ReadingResponse)
async def update_reading(
    reading_id: str,
    updates: ReadingUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a solar reading."""
    reading = db.query(SolarReading).filter(
        SolarReading.id == reading_id,
        SolarReading.user_id == current_user.user_id,
    ).first()

    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found")

    # Apply updates for provided fields only
    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "date":
            reading.reading_date = datetime.fromisoformat(value)
        elif field == "time":
            reading.reading_time = value
        elif field == "is_verified":
            reading.is_verified = 1 if value else 0
        else:
            setattr(reading, field, value)

    db.commit()
    db.refresh(reading)

    return _reading_to_response(reading)


@router.delete("/readings/all")
async def delete_all_readings(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all readings for the current user. This action is irreversible."""
    count = db.query(SolarReading).filter(
        SolarReading.user_id == current_user.user_id
    ).delete()
    db.commit()
    return {"message": f"Deleted {count} readings", "deleted_count": count}
