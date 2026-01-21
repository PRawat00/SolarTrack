"""Simple verification: Check that readings after gaps have NULL daily values."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import timedelta
from app.models.base import SessionLocal
from app.models.models import SolarReading

db = SessionLocal()

user_ids = [uid for (uid,) in db.query(SolarReading.user_id).distinct().all()]

print(f"Checking {len(user_ids)} users for gap handling...\n")

total_gaps = 0
total_incorrect = 0

for user_id in user_ids:
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == user_id
    ).order_by(SolarReading.reading_date.asc(), SolarReading.id.asc()).all()

    if len(readings) < 2:
        continue

    incorrect_gaps = []
    for i in range(1, len(readings)):
        prev_date = readings[i-1].reading_date.date()
        curr_date = readings[i].reading_date.date()
        days_diff = (curr_date - prev_date).days

        if days_diff > 1:  # Gap detected
            total_gaps += 1
            # Current reading should have NULL daily values
            if (readings[i].m1_daily is not None or
                readings[i].m2_daily is not None or
                readings[i].total_daily is not None):
                incorrect_gaps.append({
                    'prev_date': prev_date,
                    'curr_date': curr_date,
                    'days': days_diff,
                    'm1_daily': readings[i].m1_daily,
                    'm2_daily': readings[i].m2_daily,
                })
                total_incorrect += 1

    if incorrect_gaps:
        print(f"User {user_id[:8]}... has {len(incorrect_gaps)} incorrect gaps:")
        for gap in incorrect_gaps[:3]:
            print(f"  {gap['prev_date']} -> {gap['curr_date']}: {gap['days']} day gap, "
                  f"but has values: M1={gap['m1_daily']}, M2={gap['m2_daily']}")
        if len(incorrect_gaps) > 3:
            print(f"  ... and {len(incorrect_gaps) - 3} more")
        print()

print(f"\n{'='*60}")
print(f"RESULTS")
print(f"{'='*60}")
print(f"Total gaps found: {total_gaps}")
print(f"Gaps with incorrect values (should be NULL): {total_incorrect}")

if total_incorrect == 0:
    print("\n✓ SUCCESS: All gaps correctly have NULL daily values")
    exit(0)
else:
    print(f"\n✗ FAILED: {total_incorrect} gaps have non-NULL values")
    exit(1)

db.close()
