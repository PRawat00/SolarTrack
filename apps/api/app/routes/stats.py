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


def calculate_daily_production(readings: List[SolarReading]) -> List[dict]:
    """
    Convert cumulative meter readings to daily production values.

    Handles meter resets by detecting when readings decrease (indicating
    meter replacement). When a reset is detected, production for that day
    is set to 0 and calculations continue from the new baseline.

    Args:
        readings: List of SolarReading objects with cumulative meter values
                 (should be pre-sorted by date ascending)

    Returns:
        List of dicts with 'date', 'm1', 'm2', 'radiation', 'snowfall'
        representing daily production values
    """
    if len(readings) < 2:
        return []

    # Ensure sorted by date
    sorted_readings = sorted(readings, key=lambda r: r.reading_date)
    daily_production = []

    for i in range(1, len(sorted_readings)):
        current = sorted_readings[i]
        previous = sorted_readings[i-1]

        # Calculate daily difference
        m1_daily = float(current.m1 or 0) - float(previous.m1 or 0)
        m2_daily = float(current.m2 or 0) - float(previous.m2 or 0)

        # Handle meter resets (when meter reading goes down)
        # When meters are replaced, they start from a low value
        # Example: 25807 -> 4 means new meter at 4 kWh
        # We set production to 0 for reset day and start fresh from new baseline
        if m1_daily < 0:
            m1_daily = 0  # Skip this day - it's a reset point
        if m2_daily < 0:
            m2_daily = 0  # Skip this day - it's a reset point

        daily_production.append({
            'date': current.reading_date,
            'm1': m1_daily,
            'm2': m2_daily,
            'radiation': float(current.radiation_sum or 0),
            'snowfall': float(current.snowfall or 0)
        })

    return daily_production


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

    # Get all readings sorted by date to calculate daily production
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == effective_user_id
    ).order_by(SolarReading.reading_date.asc()).all()

    # Calculate daily production (handles meter resets automatically)
    daily_production = calculate_daily_production(readings)

    # Sum all daily production to get totals
    total_m1 = sum(day['m1'] for day in daily_production)
    total_m2 = sum(day['m2'] for day in daily_production)
    total_production = total_m1 + total_m2
    reading_count = len(readings)

    # Calculate derived values
    cost_per_kwh = float(settings.cost_per_kwh)
    co2_factor = float(settings.co2_factor)
    yearly_goal = float(settings.yearly_goal)
    system_capacity = float(settings.system_capacity or 5.0)

    money_saved = total_production * cost_per_kwh
    co2_offset = total_production * co2_factor
    # EPA official: urban tree sequesters 0.060 metric tons CO2/year = 60 kg CO2/year
    # Source: https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references
    trees_equivalent = co2_offset / 60
    specific_yield = (total_production / system_capacity) if system_capacity > 0 else 0

    # Calculate goal progress
    goal_progress = (total_production / yearly_goal * 100) if yearly_goal > 0 else 0

    # Format dates from readings
    first_date = readings[0].reading_date.strftime("%Y-%m-%d") if readings else None
    last_date = readings[-1].reading_date.strftime("%Y-%m-%d") if readings else None

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

    # Calculate daily production first (converts cumulative to daily)
    daily_production = calculate_daily_production(readings)

    # Aggregate daily production by period
    aggregated: dict = defaultdict(lambda: {"m1": 0.0, "m2": 0.0, "radiation": 0.0, "snowfall": 0.0})

    for day in daily_production:
        key = get_period_key(day['date'], period)
        aggregated[key]["m1"] += day['m1']
        aggregated[key]["m2"] += day['m2']
        aggregated[key]["radiation"] += day['radiation']
        aggregated[key]["snowfall"] += day['snowfall']

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
    ).order_by(SolarReading.reading_date.asc()).all()

    if not readings:
        return RecordsResponse(best_day=None, best_month=None)

    # Calculate daily production (converts cumulative to daily)
    daily_production = calculate_daily_production(readings)

    if not daily_production:
        return RecordsResponse(best_day=None, best_month=None)

    # Aggregate by day and month
    daily_totals: dict = {}  # Each day appears once, so use regular dict
    monthly_totals: dict = defaultdict(float)

    for day in daily_production:
        day_key = day['date'].strftime("%Y-%m-%d")
        month_key = day['date'].strftime("%Y-%m")

        daily_total = day['m1'] + day['m2']
        daily_totals[day_key] = daily_total
        monthly_totals[month_key] += daily_total

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
