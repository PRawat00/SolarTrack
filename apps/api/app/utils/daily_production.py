"""
Utility functions for calculating daily production values.

This module provides functions to calculate and update daily production values
for solar readings. Daily production is computed as the difference between
consecutive cumulative meter readings.
"""

from sqlalchemy.orm import Session
from app.models.models import SolarReading
from typing import Optional, Tuple


def calculate_daily_values(
    current_reading: SolarReading,
    previous_reading: Optional[SolarReading]
) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Calculate daily production values for a reading.

    Computes daily production by subtracting the previous day's cumulative reading
    from the current day's cumulative reading. Handles meter resets by setting
    production to 0 when readings decrease. Returns NULL for gaps (missing days).

    Args:
        current_reading: The reading to calculate daily values for
        previous_reading: The previous reading (chronologically), or None if first

    Returns:
        Tuple of (m1_daily, m2_daily, total_daily)
        Returns (None, None, None) if:
        - No previous reading exists (first reading)
        - There's a gap (more than 1 day between readings)
    """
    if previous_reading is None:
        return (None, None, None)

    # Check for date gap (more than 1 day between readings)
    curr_date = current_reading.reading_date.date()
    prev_date = previous_reading.reading_date.date()
    days_diff = (curr_date - prev_date).days

    if days_diff > 1:
        # Gap detected - return NULL to indicate unknown daily production
        return (None, None, None)

    # Calculate daily difference
    m1_daily = float(current_reading.m1 or 0) - float(previous_reading.m1 or 0)
    m2_daily = float(current_reading.m2 or 0) - float(previous_reading.m2 or 0)

    # Handle meter resets (when meter reading goes down)
    # When meters are replaced, they start from a low value
    # Example: 25807 -> 4 means new meter at 4 kWh
    # We set production to 0 for reset day and start fresh from new baseline
    if m1_daily < 0:
        m1_daily = 0
    if m2_daily < 0:
        m2_daily = 0

    total_daily = m1_daily + m2_daily

    return (m1_daily, m2_daily, total_daily)


def recalculate_reading_daily_values(
    db: Session,
    reading: SolarReading,
    commit: bool = True
) -> bool:
    """
    Recalculate and update daily values for a single reading.

    Fetches the previous reading (by date) for the same user and calculates
    the daily production values. Updates the reading's m1_daily, m2_daily,
    and total_daily columns.

    Args:
        db: Database session
        reading: The reading to recalculate
        commit: Whether to commit the transaction (default: True)

    Returns:
        True if values were updated, False otherwise
    """
    # Get previous reading (same user, earlier date)
    previous = db.query(SolarReading).filter(
        SolarReading.user_id == reading.user_id,
        SolarReading.reading_date < reading.reading_date
    ).order_by(SolarReading.reading_date.desc()).first()

    # Calculate new values
    m1_daily, m2_daily, total_daily = calculate_daily_values(reading, previous)

    # Update reading
    reading.m1_daily = m1_daily
    reading.m2_daily = m2_daily
    reading.total_daily = total_daily

    if commit:
        db.commit()

    return True


def recalculate_next_reading_daily_values(
    db: Session,
    user_id: str,
    reading_date,
    commit: bool = True
) -> bool:
    """
    Recalculate daily values for the reading immediately after the given date.

    Used when a reading is updated or deleted, and the next reading's daily
    values depend on it. This ensures cascading updates maintain data consistency.

    Args:
        db: Database session
        user_id: User ID
        reading_date: Date of the reading that was modified
        commit: Whether to commit the transaction (default: True)

    Returns:
        True if a next reading was found and updated, False otherwise
    """
    # Get next reading after this date
    next_reading = db.query(SolarReading).filter(
        SolarReading.user_id == user_id,
        SolarReading.reading_date > reading_date
    ).order_by(SolarReading.reading_date.asc()).first()

    if next_reading:
        recalculate_reading_daily_values(db, next_reading, commit=commit)
        return True

    return False
