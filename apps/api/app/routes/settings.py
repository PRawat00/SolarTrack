from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel

from app.middleware.auth import get_current_user, TokenData
from app.models.base import get_db
from app.models.models import UserSettings, SolarReading, ApiUsage
from app.config import settings as app_settings
from app.routes.family import get_readings_user_id

router = APIRouter(prefix="/api", tags=["settings"])


class SettingsUpdate(BaseModel):
    """Request body for updating settings."""
    currency_symbol: Optional[str] = None
    cost_per_kwh: Optional[float] = None
    co2_factor: Optional[float] = None
    yearly_goal: Optional[float] = None
    system_capacity: Optional[float] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    theme: Optional[str] = None
    family_feature_enabled: Optional[bool] = None


class SettingsResponse(BaseModel):
    """Response body for settings."""
    id: str
    user_id: str
    currency_symbol: str
    cost_per_kwh: float
    co2_factor: float
    yearly_goal: float
    system_capacity: float
    location_name: str
    latitude: float
    longitude: float
    theme: str
    family_feature_enabled: bool

    class Config:
        from_attributes = True


def _settings_to_response(settings: UserSettings) -> SettingsResponse:
    """Convert SQLAlchemy model to response."""
    return SettingsResponse(
        id=settings.id,
        user_id=settings.user_id,
        currency_symbol=settings.currency_symbol,
        cost_per_kwh=float(settings.cost_per_kwh),
        co2_factor=float(settings.co2_factor),
        yearly_goal=float(settings.yearly_goal),
        system_capacity=float(settings.system_capacity or 5.0),
        location_name=settings.location_name or "Bangkok, Thailand",
        latitude=float(settings.latitude or 13.7563),
        longitude=float(settings.longitude or 100.5018),
        theme=settings.theme,
        family_feature_enabled=bool(settings.family_feature_enabled) if settings.family_feature_enabled is not None else True,
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get user settings.

    Creates default settings if none exist for this user.
    If user is in a family, returns family head's settings.
    """
    # Use family head's user_id if in a family
    effective_user_id = get_readings_user_id(db, current_user.user_id)

    settings = db.query(UserSettings).filter(
        UserSettings.user_id == effective_user_id
    ).first()

    if not settings:
        # Create default settings for the effective user
        settings = UserSettings(user_id=effective_user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return _settings_to_response(settings)


@router.patch("/settings", response_model=SettingsResponse)
async def update_settings(
    updates: SettingsUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update user settings.

    Only provided fields will be updated. Creates settings if none exist.
    If location (latitude/longitude) changes, weather data is automatically cleared.
    Only family owner can modify settings (members have read-only access).
    """
    # Use family head's user_id if in a family
    effective_user_id = get_readings_user_id(db, current_user.user_id)

    # Only family owner can modify settings
    if effective_user_id != current_user.user_id:
        raise HTTPException(
            status_code=403,
            detail="Only family owner can modify settings"
        )

    settings = db.query(UserSettings).filter(
        UserSettings.user_id == effective_user_id
    ).first()

    if not settings:
        # Create settings if they don't exist
        settings = UserSettings(user_id=effective_user_id)
        db.add(settings)

    # Check if location is changing
    update_data = updates.model_dump(exclude_unset=True)
    location_changed = False

    if 'latitude' in update_data and float(settings.latitude or 0) != update_data['latitude']:
        location_changed = True
    if 'longitude' in update_data and float(settings.longitude or 0) != update_data['longitude']:
        location_changed = True

    # Apply updates for provided fields only
    for field, value in update_data.items():
        setattr(settings, field, value)

    # Clear weather data if location changed
    if location_changed:
        readings = db.query(SolarReading).filter(
            SolarReading.user_id == effective_user_id
        ).all()
        for reading in readings:
            reading.weather_code = None
            reading.temp_max = None
            reading.sunshine_hours = None
            reading.radiation_sum = None
            reading.snowfall = None

    db.commit()
    db.refresh(settings)

    return _settings_to_response(settings)


class UsageResponse(BaseModel):
    """Response body for API usage stats."""
    daily_count: int
    daily_limit: int
    last_used: Optional[datetime] = None


@router.get("/usage", response_model=UsageResponse)
async def get_usage(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get current API usage stats for the user.
    """
    today = date.today()

    # Get today's usage record
    usage = db.query(ApiUsage).filter(
        ApiUsage.user_id == current_user.user_id,
        ApiUsage.provider == "gemini",
        func.trunc(ApiUsage.usage_date) == today
    ).first()

    return UsageResponse(
        daily_count=usage.request_count if usage else 0,
        daily_limit=app_settings.GEMINI_DAILY_LIMIT,
        last_used=usage.usage_date if usage else None,
    )
