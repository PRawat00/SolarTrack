import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.middleware.auth import get_current_user, TokenData
from app.models.base import get_db
from app.models.models import SolarReading

router = APIRouter(prefix="/api", tags=["export"])


@router.get("/export/csv")
async def export_csv(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Export all user's readings as a CSV file.
    """
    # Get all readings for the user, ordered by date
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == current_user.user_id
    ).order_by(SolarReading.reading_date.asc()).all()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        "Date", "Time", "M1 (kWh)", "M2 (kWh)",
        "Weather Code", "Max Temp (°C)", "Sunshine (hours)",
        "Radiation (MJ/m²)", "Snowfall (cm)",
        "Notes", "Verified"
    ])

    # Write data rows
    for reading in readings:
        writer.writerow([
            reading.reading_date.strftime("%Y-%m-%d") if reading.reading_date else "",
            reading.reading_time or "",
            float(reading.m1) if reading.m1 else "",
            float(reading.m2) if reading.m2 else "",
            reading.weather_code if reading.weather_code is not None else "",
            f"{float(reading.temp_max):.1f}" if reading.temp_max is not None else "",
            f"{float(reading.sunshine_hours):.2f}" if reading.sunshine_hours is not None else "",
            f"{float(reading.radiation_sum):.2f}" if reading.radiation_sum is not None else "",
            f"{float(reading.snowfall):.2f}" if (reading.snowfall is not None and reading.snowfall > 0) else "",
            reading.notes or "",
            "Yes" if reading.is_verified else "No",
        ])

    # Prepare response
    output.seek(0)
    filename = f"solar_readings_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
        },
    )
