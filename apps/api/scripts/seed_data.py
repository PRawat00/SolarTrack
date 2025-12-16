#!/usr/bin/env python3
"""
Seed script to populate the database with sample solar readings.

Usage:
    # From the apps/api directory:
    python scripts/seed_data.py --user-id <supabase_user_id>

    # Or to clear existing data first:
    python scripts/seed_data.py --user-id <supabase_user_id> --clear
"""

import argparse
import random
import math
import sys
import os

# Add the app directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.base import engine, SessionLocal
from app.models.models import SolarReading, UserSettings, generate_uuid_hex


# Weather notes for variety
WEATHER_NOTES = [
    None,
    None,
    None,  # Most days have no notes
    "Sunny",
    "Partly cloudy",
    "Overcast",
    "Rain",
    "Hazy",
    "Clear skies",
]


def get_seasonal_factor(date: datetime) -> float:
    """
    Returns a factor (0.5 to 1.0) based on the time of year.
    Summer months produce more, winter months produce less.
    Uses a sine wave to create smooth seasonal variation.
    """
    # Day of year (0-365)
    day_of_year = date.timetuple().tm_yday

    # Peak production around June 21 (day 172)
    # Use cosine shifted so peak is at summer solstice
    # Formula creates values between 0.5 and 1.0
    seasonal = 0.75 + 0.25 * math.cos((day_of_year - 172) * 2 * math.pi / 365)

    return seasonal


def get_daily_variation() -> float:
    """Returns random daily variation factor (0.6 to 1.1)."""
    return random.uniform(0.6, 1.1)


def generate_reading(user_id: str, date: datetime) -> SolarReading:
    """Generate a single solar reading for a given date."""
    seasonal = get_seasonal_factor(date)
    daily = get_daily_variation()

    # Base production values (kWh per day)
    # M1 typically higher (main panels), M2 lower (secondary array)
    base_m1 = 55  # 55 kWh base
    base_m2 = 35  # 35 kWh base

    # Apply seasonal and daily factors
    m1 = round(base_m1 * seasonal * daily + random.uniform(-5, 5), 2)
    m2 = round(base_m2 * seasonal * daily + random.uniform(-3, 3), 2)

    # Ensure minimum values
    m1 = max(5, m1)
    m2 = max(3, m2)

    # Occasionally have a bad day (equipment issue, heavy rain, etc.)
    if random.random() < 0.05:  # 5% chance
        m1 = round(m1 * 0.3, 2)
        m2 = round(m2 * 0.3, 2)

    # Random weather note
    notes = random.choice(WEATHER_NOTES)

    return SolarReading(
        id=generate_uuid_hex(),
        user_id=user_id,
        reading_date=date,
        reading_time="18:00",  # Evening reading
        m1=m1,
        m2=m2,
        notes=notes,
        is_verified=1,  # Mark as verified
    )


def seed_data(user_id: str, clear_existing: bool = False, days: int = 365):
    """Seed the database with sample solar readings."""
    db: Session = SessionLocal()

    try:
        # Clear existing data if requested
        if clear_existing:
            deleted = db.query(SolarReading).filter(
                SolarReading.user_id == user_id
            ).delete()
            print(f"Deleted {deleted} existing readings for user")
            db.commit()

        # Ensure user settings exist
        settings = db.query(UserSettings).filter(
            UserSettings.user_id == user_id
        ).first()

        if not settings:
            settings = UserSettings(
                id=generate_uuid_hex(),
                user_id=user_id,
                currency_symbol="$",
                cost_per_kwh=0.15,
                co2_factor=0.85,
                yearly_goal=25000,  # 25,000 kWh yearly goal
                theme="dark",
            )
            db.add(settings)
            db.commit()
            print("Created user settings")

        # Generate readings for the past N days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        readings = []
        current_date = start_date

        while current_date <= end_date:
            reading = generate_reading(user_id, current_date)
            readings.append(reading)
            current_date += timedelta(days=1)

        # Bulk insert
        db.bulk_save_objects(readings)
        db.commit()

        print(f"Successfully created {len(readings)} readings")
        print(f"Date range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")

        # Calculate and display summary
        total_m1 = sum(float(r.m1) for r in readings)
        total_m2 = sum(float(r.m2) for r in readings)
        total = total_m1 + total_m2

        print(f"\nSummary:")
        print(f"  Total M1: {total_m1:,.0f} kWh")
        print(f"  Total M2: {total_m2:,.0f} kWh")
        print(f"  Total Production: {total:,.0f} kWh")
        print(f"  Average Daily: {total / len(readings):.1f} kWh")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Seed the database with sample solar readings"
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="Supabase user ID to associate readings with",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing readings for the user before seeding",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=365,
        help="Number of days of data to generate (default: 365)",
    )

    args = parser.parse_args()

    print(f"Seeding data for user: {args.user_id}")
    print(f"Days of data: {args.days}")
    if args.clear:
        print("Will clear existing data first")
    print()

    seed_data(args.user_id, args.clear, args.days)


if __name__ == "__main__":
    main()
