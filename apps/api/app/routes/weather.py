from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import List, Optional
import httpx

from app.middleware.auth import get_current_user, TokenData
from app.models.base import get_db
from app.models.models import UserSettings, SolarReading

router = APIRouter(prefix="/api", tags=["weather"])


class EnrichResponse(BaseModel):
    """Response body for weather enrichment."""
    enriched_count: int
    message: str


class GeoLocation(BaseModel):
    """A geocoded location result."""
    name: str
    latitude: float
    longitude: float
    country: str
    admin1: Optional[str] = None  # State/region
    display_name: str  # Formatted display name


class GeoSearchResponse(BaseModel):
    """Response for geocoding search."""
    results: List[GeoLocation]


@router.get("/geocode/search", response_model=GeoSearchResponse)
async def search_locations(
    q: str = Query(..., min_length=2, description="Location name to search"),
):
    """
    Search for locations by name using Open-Meteo Geocoding API.
    Returns list of matching locations with coordinates.
    """
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        "name": q,
        "count": 5,
        "language": "en",
        "format": "json",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()

    results = []
    for loc in data.get("results", []):
        # Build display name: City, State, Country
        parts = [loc.get("name", "")]
        if loc.get("admin1"):
            parts.append(loc.get("admin1"))
        if loc.get("country"):
            parts.append(loc.get("country"))
        display_name = ", ".join(parts)

        results.append(GeoLocation(
            name=loc.get("name", ""),
            latitude=loc.get("latitude", 0),
            longitude=loc.get("longitude", 0),
            country=loc.get("country", ""),
            admin1=loc.get("admin1"),
            display_name=display_name,
        ))

    return GeoSearchResponse(results=results)


async def fetch_weather_data(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
) -> dict:
    """
    Fetch historical weather data from Open-Meteo API.

    Returns a dict with dates as keys and weather data as values.
    """
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "daily": ["weather_code", "temperature_2m_max", "sunshine_duration", "shortwave_radiation_sum", "snowfall_sum"],
        "timezone": "auto",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=30.0)
        response.raise_for_status()
        data = response.json()

    # Parse response into a date-keyed dict
    daily = data.get("daily", {})
    dates = daily.get("time", [])
    weather_codes = daily.get("weather_code", [])
    temps = daily.get("temperature_2m_max", [])
    sunshine = daily.get("sunshine_duration", [])  # seconds
    radiation = daily.get("shortwave_radiation_sum", [])  # MJ/m2
    snowfall = daily.get("snowfall_sum", [])  # cm

    result = {}
    for i, date in enumerate(dates):
        # Convert sunshine from seconds to hours
        sunshine_hours = sunshine[i] / 3600 if sunshine[i] is not None else None
        result[date] = {
            "weather_code": weather_codes[i] if i < len(weather_codes) else None,
            "temp_max": temps[i] if i < len(temps) else None,
            "sunshine_hours": sunshine_hours,
            "radiation_sum": radiation[i] if i < len(radiation) else None,
            "snowfall": snowfall[i] if i < len(snowfall) else None,
        }

    return result


class ClearWeatherResponse(BaseModel):
    """Response body for clearing weather data."""
    cleared_count: int
    message: str


@router.post("/weather/clear", response_model=ClearWeatherResponse)
async def clear_weather_data(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Clear all weather data from solar readings.
    This allows re-fetching weather data including new fields like snowfall.
    """
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == current_user.user_id
    ).all()

    cleared_count = 0
    for reading in readings:
        if reading.weather_code is not None:
            reading.weather_code = None
            reading.temp_max = None
            reading.sunshine_hours = None
            reading.radiation_sum = None
            reading.snowfall = None
            cleared_count += 1

    db.commit()

    return ClearWeatherResponse(
        cleared_count=cleared_count,
        message=f"Cleared weather data from {cleared_count} readings"
    )


@router.post("/weather/enrich", response_model=EnrichResponse)
async def enrich_weather_data(
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Enrich solar readings with weather data from Open-Meteo API.

    Automatically finds readings with missing weather data and fetches
    weather information for those dates.
    """
    # Get user settings for location
    settings = db.query(UserSettings).filter(
        UserSettings.user_id == current_user.user_id
    ).first()

    if not settings:
        raise HTTPException(
            status_code=400,
            detail="User settings not found. Please configure your location in settings."
        )

    latitude = float(settings.latitude or 13.7563)
    longitude = float(settings.longitude or 100.5018)

    # Debug: Get total count and check snowfall values
    total_readings = db.query(SolarReading).filter(
        SolarReading.user_id == current_user.user_id
    ).count()

    # Check readings with NULL snowfall specifically
    null_snowfall_count = db.query(SolarReading).filter(
        SolarReading.user_id == current_user.user_id,
        SolarReading.snowfall.is_(None)
    ).count()

    # Check readings with NULL weather_code
    null_weather_count = db.query(SolarReading).filter(
        SolarReading.user_id == current_user.user_id,
        SolarReading.weather_code.is_(None)
    ).count()

    # Find readings with missing weather data (including snowfall)
    readings = db.query(SolarReading).filter(
        SolarReading.user_id == current_user.user_id,
        or_(
            SolarReading.weather_code.is_(None),
            SolarReading.snowfall.is_(None),
        )
    ).all()

    if not readings:
        return EnrichResponse(
            enriched_count=0,
            message=f"All readings already have complete weather data (total: {total_readings}, null_weather: {null_weather_count}, null_snowfall: {null_snowfall_count})"
        )

    # Get date range from readings
    dates = [r.reading_date for r in readings]
    start_date = min(dates).strftime("%Y-%m-%d")
    end_date = max(dates).strftime("%Y-%m-%d")

    # Fetch weather data from Open-Meteo
    try:
        weather_data = await fetch_weather_data(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch weather data: {str(e)}"
        )

    # Update readings with weather data
    enriched_count = 0
    for reading in readings:
        date_str = reading.reading_date.strftime("%Y-%m-%d")

        if date_str in weather_data:
            weather = weather_data[date_str]
            reading.weather_code = weather["weather_code"]
            reading.temp_max = weather["temp_max"]
            reading.sunshine_hours = weather["sunshine_hours"]
            reading.radiation_sum = weather["radiation_sum"]
            reading.snowfall = weather["snowfall"]
            enriched_count += 1

    db.commit()

    return EnrichResponse(
        enriched_count=enriched_count,
        message=f"Successfully enriched {enriched_count} readings with weather data"
    )
