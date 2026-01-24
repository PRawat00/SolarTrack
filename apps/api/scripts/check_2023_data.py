"""Check 2023 data for gaps and anomalies."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.base import SessionLocal
from app.models.models import SolarReading
from collections import defaultdict

db = SessionLocal()

# Get all users
user_ids = [uid for (uid,) in db.query(SolarReading.user_id).distinct().all()]

for user_id in user_ids:
    # Get 2023 readings
    readings_2023 = db.query(SolarReading).filter(
        SolarReading.user_id == user_id,
        SolarReading.reading_date >= '2023-01-01',
        SolarReading.reading_date < '2024-01-01'
    ).order_by(SolarReading.reading_date.asc(), SolarReading.id.asc()).all()

    if not readings_2023:
        continue

    print(f"\nUser {user_id[:8]}... - 2023 data ({len(readings_2023)} readings):")

    # Check for gaps
    gaps = []
    for i in range(1, len(readings_2023)):
        prev_date = readings_2023[i-1].reading_date.date()
        curr_date = readings_2023[i].reading_date.date()
        days_diff = (curr_date - prev_date).days

        if days_diff > 1:
            gaps.append((prev_date, curr_date, days_diff))

    if gaps:
        print(f"  Found {len(gaps)} gaps:")
        for prev, curr, days in gaps[:5]:
            print(f"    {prev} -> {curr}: {days} days")

    # Calculate monthly totals (with NULL handling)
    monthly = defaultdict(float)
    for r in readings_2023:
        month = r.reading_date.month
        if r.total_daily is not None:
            monthly[month] += float(r.total_daily)

    print(f"  Monthly production (kWh):")
    for month in range(1, 13):
        if month in monthly:
            print(f"    Month {month:2d}: {monthly[month]:8.2f} kWh")

db.close()
