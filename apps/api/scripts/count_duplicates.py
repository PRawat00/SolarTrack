"""Count duplicate readings (same date, same time, same values)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from collections import defaultdict
from app.models.base import SessionLocal
from app.models.models import SolarReading

db = SessionLocal()

user_ids = [uid for (uid,) in db.query(SolarReading.user_id).distinct().all()]

print(f"Checking {len(user_ids)} users for duplicate readings...\n")

total_duplicates = 0
users_with_duplicates = 0

for user_id in user_ids:
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == user_id
    ).order_by(SolarReading.reading_date.asc(), SolarReading.id.asc()).all()

    if len(readings) < 2:
        continue

    # Group by date+time+m1+m2
    groups = defaultdict(list)
    for r in readings:
        key = (
            r.reading_date.date(),
            r.reading_time,
            float(r.m1) if r.m1 else None,
            float(r.m2) if r.m2 else None
        )
        groups[key].append(r)

    # Find groups with more than 1 reading
    duplicates = {k: v for k, v in groups.items() if len(v) > 1}

    if duplicates:
        users_with_duplicates += 1
        dup_count = sum(len(v) - 1 for v in duplicates.values())  # Count extras
        total_duplicates += dup_count

        print(f"User {user_id[:8]}... has {dup_count} duplicate readings in {len(duplicates)} groups:")
        for i, (key, readings_group) in enumerate(list(duplicates.items())[:5]):
            date, time, m1, m2 = key
            m1_str = f"{m1:.2f}" if m1 is not None else "None"
            m2_str = f"{m2:.2f}" if m2 is not None else "None"
            print(f"  {date} {time or '--:--'} M1={m1_str} M2={m2_str}: {len(readings_group)} copies")
            # Show IDs
            ids = [r.id[:8] for r in readings_group]
            print(f"    IDs: {', '.join(ids)}...")
        if len(duplicates) > 5:
            print(f"  ... and {len(duplicates) - 5} more duplicate groups")
        print()

print(f"\n{'='*60}")
print(f"RESULTS")
print(f"{'='*60}")
print(f"Users with duplicates: {users_with_duplicates}")
print(f"Total duplicate readings (extras): {total_duplicates}")
print(f"Total readings: {sum(len(db.query(SolarReading).filter(SolarReading.user_id == uid).all()) for uid in user_ids)}")

db.close()
