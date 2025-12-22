from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Literal
from pydantic import BaseModel
from collections import defaultdict
from datetime import datetime

from app.middleware.auth import get_current_user, TokenData
from app.models.base import get_db
from app.models.models import SolarReading, UserSettings
from app.routes.family import get_readings_user_id

router = APIRouter(prefix="/api", tags=["stats"])


class StatsResponse(BaseModel):
    """Response body for dashboard stats."""
    total_m1: float  # Total Meter 1 production (kWh)
    total_m2: float  # Total Meter 2 production (kWh)
    total_production: float  # Combined total (M1 + M2)
    money_saved: float  # total * cost_per_kwh
    co2_offset: float  # total * co2_factor (kg)
    trees_equivalent: float  # CO2 offset / 21 kg per tree per year
    specific_yield: float  # kWh per kWp (total / system_capacity)
    reading_count: int
    first_reading_date: Optional[str]
    last_reading_date: Optional[str]
    yearly_goal: float
    goal_progress: float  # percentage (0-100)
    system_capacity: float  # kWp
    currency_symbol: str


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get dashboard statistics calculated from user's readings.

    Returns total production, money saved, CO2 offset, and goal progress.
    If user is in a family, returns family-wide stats using family head's data and settings.
    """
    # Use family head's user_id if in a family
    effective_user_id = get_readings_user_id(db, current_user.user_id)

    # Get settings from effective user (family head if in family)
    settings = db.query(UserSettings).filter(
        UserSettings.user_id == effective_user_id
    ).first()

    if not settings:
        settings = UserSettings(user_id=effective_user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Calculate totals from readings (using family head's readings)
    result = db.query(
        func.sum(SolarReading.m1).label("total_m1"),
        func.sum(SolarReading.m2).label("total_m2"),
        func.count(SolarReading.id).label("count"),
        func.min(SolarReading.reading_date).label("first_date"),
        func.max(SolarReading.reading_date).label("last_date"),
    ).filter(
        SolarReading.user_id == effective_user_id
    ).first()

    total_m1 = float(result.total_m1 or 0)
    total_m2 = float(result.total_m2 or 0)
    total_production = total_m1 + total_m2
    reading_count = result.count or 0

    # Calculate derived values
    cost_per_kwh = float(settings.cost_per_kwh)
    co2_factor = float(settings.co2_factor)
    yearly_goal = float(settings.yearly_goal)
    system_capacity = float(settings.system_capacity or 5.0)

    money_saved = total_production * cost_per_kwh
    co2_offset = total_production * co2_factor
    trees_equivalent = co2_offset / 21  # Average tree absorbs ~21 kg CO2/year
    specific_yield = (total_production / system_capacity) if system_capacity > 0 else 0

    # Calculate goal progress
    goal_progress = (total_production / yearly_goal * 100) if yearly_goal > 0 else 0

    # Format dates
    first_date = result.first_date.strftime("%Y-%m-%d") if result.first_date else None
    last_date = result.last_date.strftime("%Y-%m-%d") if result.last_date else None

    return StatsResponse(
        total_m1=round(total_m1, 2),
        total_m2=round(total_m2, 2),
        total_production=round(total_production, 2),
        money_saved=round(money_saved, 2),
        co2_offset=round(co2_offset, 2),
        trees_equivalent=round(trees_equivalent, 1),
        specific_yield=round(specific_yield, 1),
        reading_count=reading_count,
        first_reading_date=first_date,
        last_reading_date=last_date,
        yearly_goal=yearly_goal,
        goal_progress=round(min(goal_progress, 100), 1),
        system_capacity=system_capacity,
        currency_symbol=settings.currency_symbol,
    )


# ============ Trends Endpoint ============

class TrendDataPoint(BaseModel):
    """Single data point for trend chart."""
    date: str
    m1: float
    m2: float
    total: float
    radiation: float  # Solar irradiance in MJ/m²
    snowfall: float   # Daily snowfall in cm


class TrendsResponse(BaseModel):
    """Response body for production trends."""
    period: str
    data: List[TrendDataPoint]


def get_period_key(reading_date: datetime, period: str) -> str:
    """Get aggregation key based on period."""
    if period == "daily":
        return reading_date.strftime("%Y-%m-%d")
    elif period == "weekly":
        # ISO week format: YYYY-WNN
        return reading_date.strftime("%Y-W%V")
    elif period == "monthly":
        return reading_date.strftime("%Y-%m")
    elif period == "yearly":
        return reading_date.strftime("%Y")
    return reading_date.strftime("%Y-%m-%d")


@router.get("/stats/trends", response_model=TrendsResponse)
async def get_trends(
    period: Literal["daily", "weekly", "monthly", "yearly"] = Query(
        default="monthly",
        description="Aggregation period"
    ),
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get production trends aggregated by time period.

    Returns data points with M1, M2, and total for each period.
    If user is in a family, returns family-wide trends.
    """
    # Use family head's user_id if in a family
    effective_user_id = get_readings_user_id(db, current_user.user_id)

    # Fetch all readings for the family
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == effective_user_id
    ).order_by(SolarReading.reading_date.asc()).all()

    # Aggregate by period
    aggregated: dict = defaultdict(lambda: {"m1": 0.0, "m2": 0.0, "radiation": 0.0, "snowfall": 0.0})

    for reading in readings:
        if reading.reading_date:
            key = get_period_key(reading.reading_date, period)
            aggregated[key]["m1"] += float(reading.m1 or 0)
            aggregated[key]["m2"] += float(reading.m2 or 0)
            aggregated[key]["radiation"] += float(reading.radiation_sum or 0)
            aggregated[key]["snowfall"] += float(reading.snowfall or 0)

    # Convert to sorted list of data points
    data = []
    for date_key in sorted(aggregated.keys()):
        m1 = round(aggregated[date_key]["m1"], 2)
        m2 = round(aggregated[date_key]["m2"], 2)
        radiation = round(aggregated[date_key]["radiation"], 2)
        snowfall = round(aggregated[date_key]["snowfall"], 2)
        data.append(TrendDataPoint(
            date=date_key,
            m1=m1,
            m2=m2,
            total=round(m1 + m2, 2),
            radiation=radiation,
            snowfall=snowfall,
        ))

    return TrendsResponse(period=period, data=data)


# ============ Records Endpoint ============

class RecordEntry(BaseModel):
    """A single record (best day or best month)."""
    value: float
    date: str


class RecordsResponse(BaseModel):
    """Response body for production records (hall of fame)."""
    best_day: Optional[RecordEntry]
    best_month: Optional[RecordEntry]


@router.get("/stats/records", response_model=RecordsResponse)
async def get_records(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get production records (best day and best month).

    Returns the highest production day and month for the user.
    If user is in a family, returns family-wide records.
    """
    # Use family head's user_id if in a family
    effective_user_id = get_readings_user_id(db, current_user.user_id)

    # Fetch all readings for the family
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == effective_user_id
    ).all()

    if not readings:
        return RecordsResponse(best_day=None, best_month=None)

    # Aggregate by day
    daily_totals: dict = defaultdict(float)
    monthly_totals: dict = defaultdict(float)

    for reading in readings:
        if reading.reading_date:
            day_key = reading.reading_date.strftime("%Y-%m-%d")
            month_key = reading.reading_date.strftime("%Y-%m")
            total = float(reading.m1 or 0) + float(reading.m2 or 0)
            daily_totals[day_key] += total
            monthly_totals[month_key] += total

    # Find best day
    best_day = None
    if daily_totals:
        best_day_key = max(daily_totals, key=daily_totals.get)
        best_day = RecordEntry(
            value=round(daily_totals[best_day_key], 2),
            date=best_day_key
        )

    # Find best month
    best_month = None
    if monthly_totals:
        best_month_key = max(monthly_totals, key=monthly_totals.get)
        best_month = RecordEntry(
            value=round(monthly_totals[best_month_key], 2),
            date=best_month_key
        )

    return RecordsResponse(best_day=best_day, best_month=best_month)
