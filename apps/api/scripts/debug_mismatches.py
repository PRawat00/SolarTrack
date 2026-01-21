"""Debug script to investigate mismatches."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.base import SessionLocal
from app.models.models import SolarReading

db = SessionLocal()
user_id = '57c48944-f992-428f-84b1-538c31d2c9d7'

# Get readings sorted by date and time
readings = db.query(SolarReading).filter(
    SolarReading.user_id == user_id
).order_by(SolarReading.reading_date.asc(), SolarReading.reading_time.asc()).all()

print(f'User {user_id} has {len(readings)} readings:\n')
print(f"{'Date':<12} {'Time':<8} {'M1 (cum)':<10} {'M2 (cum)':<10} {'M1 Daily':<10} {'M2 Daily':<10}")
print("="*70)

for r in readings:
    date_str = r.reading_date.strftime("%Y-%m-%d")
    time_str = r.reading_time or "--:--"
    m1 = float(r.m1) if r.m1 else 0
    m2 = float(r.m2) if r.m2 else 0
    m1_d = float(r.m1_daily) if r.m1_daily is not None else None
    m2_d = float(r.m2_daily) if r.m2_daily is not None else None

    m1_d_str = f"{m1_d:.2f}" if m1_d is not None else "NULL"
    m2_d_str = f"{m2_d:.2f}" if m2_d is not None else "NULL"

    print(f"{date_str:<12} {time_str:<8} {m1:<10.2f} {m2:<10.2f} {m1_d_str:<10} {m2_d_str:<10}")

db.close()
