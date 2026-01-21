"""Check for date gaps in readings."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import timedelta
from app.models.base import SessionLocal
from app.models.models import SolarReading

db = SessionLocal()

# Get all users
user_ids = [uid for (uid,) in db.query(SolarReading.user_id).distinct().all()]

print(f"Checking {len(user_ids)} users for date gaps...\n")

total_gaps = 0
for user_id in user_ids:
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == user_id
    ).order_by(SolarReading.reading_date.asc(), SolarReading.id.asc()).all()

    if len(readings) < 2:
        continue

    gaps_found = []
    for i in range(1, len(readings)):
        prev_date = readings[i-1].reading_date.date()
        curr_date = readings[i].reading_date.date()

        # Calculate days between readings
        days_diff = (curr_date - prev_date).days

        if days_diff > 1:  # More than 1 day gap
            m1_daily = float(readings[i].m1_daily) if readings[i].m1_daily is not None else None
            m2_daily = float(readings[i].m2_daily) if readings[i].m2_daily is not None else None
            total_daily = float(readings[i].total_daily) if readings[i].total_daily is not None else None

            gaps_found.append({
                'prev_date': prev_date,
                'curr_date': curr_date,
                'days': days_diff,
                'm1_daily': m1_daily,
                'm2_daily': m2_daily,
                'total_daily': total_daily
            })

    if gaps_found:
        print(f"User {user_id[:8]}... has {len(gaps_found)} gaps:")
        for gap in gaps_found[:5]:  # Show first 5
            daily_str = f"{gap['total_daily']:.2f} kWh" if gap['total_daily'] is not None else "NULL"
            print(f"  {gap['prev_date']} -> {gap['curr_date']}: {gap['days']} day gap, "
                  f"stored daily = {daily_str}")
        if len(gaps_found) > 5:
            print(f"  ... and {len(gaps_found) - 5} more gaps")
        print()
        total_gaps += len(gaps_found)

print(f"\nTotal gaps found: {total_gaps}")

db.close()
