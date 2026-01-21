"""
Verification script to check daily production values match the calculation logic.

Compares stored daily values against runtime calculation to ensure consistency.

Usage:
    python -m scripts.verify_daily_production [--user-id USER_ID]
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.models.base import SessionLocal
from app.models.models import SolarReading
from app.routes.stats import calculate_daily_production


def verify_daily_values(db: Session, user_id: str = None) -> dict:
    """Verify stored daily values match calculated values."""

    # Get users to check
    if user_id:
        user_ids = [user_id]
    else:
        user_ids = [uid for (uid,) in db.query(SolarReading.user_id).distinct().all()]

    total_checked = 0
    total_mismatches = 0
    mismatches = []

    for uid in user_ids:
        # Get readings - sort same way as calculate_daily_production and backfill
        # Sort by date AND id for consistency when there are multiple readings per date
        readings = db.query(SolarReading).filter(
            SolarReading.user_id == uid
        ).order_by(SolarReading.reading_date.asc(), SolarReading.id.asc()).all()

        if not readings:
            continue

        # Calculate expected daily values
        # Returns list with one entry per reading EXCLUDING gaps and first reading
        expected = calculate_daily_production(readings)

        # Build expected dict by date for easier lookup
        expected_by_date = {}
        for e in expected:
            date_str = e['date'].strftime('%Y-%m-%d') if hasattr(e['date'], 'strftime') else str(e['date'])
            expected_by_date[date_str] = e

        # Verify first reading has NULL daily values
        first_reading = readings[0]
        if first_reading.m1_daily is not None or first_reading.m2_daily is not None or first_reading.total_daily is not None:
            mismatches.append({
                'user_id': uid,
                'date': first_reading.reading_date.strftime('%Y-%m-%d'),
                'issue': 'First reading should have NULL daily values',
                'stored_m1': float(first_reading.m1_daily) if first_reading.m1_daily is not None else None,
                'expected_m1': None,
                'stored_m2': float(first_reading.m2_daily) if first_reading.m2_daily is not None else None,
                'expected_m2': None,
            })
            total_mismatches += 1
        total_checked += 1

        # Compare remaining readings
        # Readings with non-NULL values should match expected
        # Readings with NULL values (gaps or first) should not be in expected
        for i in range(1, len(readings)):
            reading = readings[i]
            date_str = reading.reading_date.strftime('%Y-%m-%d')

            # Convert Decimal to float for comparison
            stored_m1 = float(reading.m1_daily) if reading.m1_daily is not None else None
            stored_m2 = float(reading.m2_daily) if reading.m2_daily is not None else None

            if stored_m1 is not None and stored_m2 is not None:
                # Has daily values - should be in expected
                if date_str not in expected_by_date:
                    mismatches.append({
                        'user_id': uid,
                        'date': date_str,
                        'issue': 'Has daily values but not in expected',
                        'stored_m1': stored_m1,
                        'expected_m1': None,
                        'stored_m2': stored_m2,
                        'expected_m2': None,
                    })
                    total_mismatches += 1
                else:
                    exp = expected_by_date[date_str]
                    # Compare values (with tolerance for floating point)
                    m1_match = abs(stored_m1 - exp['m1']) < 0.01
                    m2_match = abs(stored_m2 - exp['m2']) < 0.01

                    if not (m1_match and m2_match):
                        mismatches.append({
                            'user_id': uid,
                            'date': date_str,
                            'stored_m1': stored_m1,
                            'expected_m1': exp['m1'],
                            'stored_m2': stored_m2,
                            'expected_m2': exp['m2'],
                        })
                        total_mismatches += 1
            else:
                # Has NULL values - should NOT be in expected (gap or first reading)
                if date_str in expected_by_date:
                    exp = expected_by_date[date_str]
                    mismatches.append({
                        'user_id': uid,
                        'date': date_str,
                        'issue': 'NULL but in expected (should have values)',
                        'stored_m1': stored_m1,
                        'expected_m1': exp['m1'],
                        'stored_m2': stored_m2,
                        'expected_m2': exp['m2'],
                    })
                    total_mismatches += 1

            total_checked += 1

    return {
        'checked': total_checked,
        'mismatches': total_mismatches,
        'details': mismatches
    }


def main(user_id: str = None):
    """Main verification function."""
    db = SessionLocal()
    try:
        print("Verifying daily production values...")
        result = verify_daily_values(db, user_id)

        print(f"\nChecked: {result['checked']} readings")
        print(f"Mismatches: {result['mismatches']}")

        if result['mismatches'] > 0:
            print("\nMismatch details (showing first 10):")
            for m in result['details'][:10]:
                if 'issue' in m:
                    # Special case for first reading
                    print(f"  {m['user_id']} on {m['date']}: {m['issue']}")
                else:
                    print(f"  {m['user_id']} on {m['date']}: "
                          f"M1 stored={m['stored_m1']:.2f} "
                          f"expected={m['expected_m1']:.2f}, "
                          f"M2 stored={m['stored_m2']:.2f} "
                          f"expected={m['expected_m2']:.2f}")

            if len(result['details']) > 10:
                print(f"  ... and {len(result['details']) - 10} more mismatches")

        return 0 if result['mismatches'] == 0 else 1
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Verify daily production values")
    parser.add_argument("--user-id", type=str, help="Only verify for specific user")
    args = parser.parse_args()

    sys.exit(main(user_id=args.user_id))
