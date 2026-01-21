"""
Backfill script to populate daily production values for existing readings.

This script:
1. Fetches all readings grouped by user
2. Sorts by date chronologically
3. Calculates daily values using the same logic as the application
4. Updates readings with calculated values
5. Reports progress and any errors

Usage:
    python -m scripts.backfill_daily_production [--dry-run] [--user-id USER_ID]
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.base import SessionLocal, engine
from app.models.models import SolarReading
from app.utils.daily_production import calculate_daily_values


def backfill_user_readings(db: Session, user_id: str, dry_run: bool = False) -> dict:
    """Backfill daily values for a single user's readings."""
    # Get all readings for user, sorted by date and id for consistency
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == user_id
    ).order_by(SolarReading.reading_date.asc(), SolarReading.id.asc()).all()

    if not readings:
        return {"user_id": user_id, "count": 0, "updated": 0, "errors": []}

    updated_count = 0
    errors = []

    # Process readings chronologically
    for i, reading in enumerate(readings):
        try:
            previous = readings[i-1] if i > 0 else None

            # Calculate daily values
            m1_daily, m2_daily, total_daily = calculate_daily_values(reading, previous)

            # Update reading
            reading.m1_daily = m1_daily
            reading.m2_daily = m2_daily
            reading.total_daily = total_daily

            updated_count += 1

        except Exception as e:
            errors.append(f"Reading {reading.id} on {reading.reading_date}: {str(e)}")

    if not dry_run:
        db.commit()
        print(f"✓ User {user_id}: Updated {updated_count}/{len(readings)} readings")
    else:
        db.rollback()
        print(f"[DRY RUN] User {user_id}: Would update {updated_count}/{len(readings)} readings")

    return {
        "user_id": user_id,
        "count": len(readings),
        "updated": updated_count,
        "errors": errors
    }


def main(dry_run: bool = False, user_id: str = None):
    """Main backfill function."""
    db = SessionLocal()

    try:
        # Get list of users with readings
        if user_id:
            user_ids = [user_id]
        else:
            user_ids = [uid for (uid,) in db.query(SolarReading.user_id).distinct().all()]

        print(f"{'[DRY RUN] ' if dry_run else ''}Backfilling daily production for {len(user_ids)} users...")

        results = []
        for uid in user_ids:
            result = backfill_user_readings(db, uid, dry_run)
            results.append(result)

        # Summary
        total_readings = sum(r["count"] for r in results)
        total_updated = sum(r["updated"] for r in results)
        total_errors = sum(len(r["errors"]) for r in results)

        print("\n" + "="*60)
        print("BACKFILL SUMMARY")
        print("="*60)
        print(f"Users processed: {len(user_ids)}")
        print(f"Total readings: {total_readings}")
        print(f"Updated: {total_updated}")
        print(f"Errors: {total_errors}")

        if total_errors > 0:
            print("\nErrors:")
            for result in results:
                for error in result["errors"]:
                    print(f"  - {error}")

        return 0 if total_errors == 0 else 1

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Backfill daily production values")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually update database")
    parser.add_argument("--user-id", type=str, help="Only backfill for specific user")
    args = parser.parse_args()

    sys.exit(main(dry_run=args.dry_run, user_id=args.user_id))
