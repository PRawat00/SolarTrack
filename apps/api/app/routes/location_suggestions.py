"""
Location-based suggestions endpoint.

Provides accurate CO2 factors, electricity prices, and solar yield estimates
based on user location, using authoritative data sources.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

from app.services.location.location_data import (
    get_location_suggestions,
    get_us_state_data,
    get_country_data,
    US_STATES,
    COUNTRIES,
    TREE_CO2_ABSORPTION_KG_YEAR,
    DATA_SOURCES,
)


router = APIRouter(prefix="/api/location", tags=["location"])


# US State name to code mapping for reverse lookup
US_STATE_NAME_TO_CODE = {data["name"].lower(): code for code, data in US_STATES.items()}

# Add common variations
US_STATE_NAME_TO_CODE.update({
    "new york state": "NY",
    "new york city": "NY",  # Will use NYCW subregion data eventually
    "washington state": "WA",
    "washington dc": "DC",
    "washington d.c.": "DC",
    "district of columbia": "DC",
})


class LocationSuggestion(BaseModel):
    """Suggested values based on location."""
    co2_factor: float
    co2_source: str
    electricity_price: float
    electricity_source: str
    currency_symbol: str
    expected_yield: int
    expected_yield_source: str


class LocationSuggestionsResponse(BaseModel):
    """Response for location suggestions endpoint."""
    detected_country: Optional[str]
    detected_country_name: Optional[str]
    detected_state: Optional[str]
    detected_state_name: Optional[str]
    suggestions: LocationSuggestion
    tree_co2_absorption: float
    tree_source: str


class DataSourcesResponse(BaseModel):
    """Response listing all data sources."""
    sources: dict


def detect_us_state_from_admin1(admin1: str) -> Optional[str]:
    """
    Detect US state code from Open-Meteo admin1 field.

    Open-Meteo returns state names like "New York", "California", etc.
    """
    if not admin1:
        return None

    admin1_lower = admin1.lower().strip()

    # Direct match
    if admin1_lower in US_STATE_NAME_TO_CODE:
        return US_STATE_NAME_TO_CODE[admin1_lower]

    # Try matching against state names
    for code, data in US_STATES.items():
        if data["name"].lower() == admin1_lower:
            return code

    return None


def detect_country_code(country: str) -> Optional[str]:
    """
    Detect country code from Open-Meteo country field.

    Open-Meteo returns country names like "United States", "Thailand", etc.
    """
    if not country:
        return None

    country_lower = country.lower().strip()

    # Check for US variations
    if country_lower in ["united states", "united states of america", "usa", "us"]:
        return "US"

    # Match against country names
    for code, data in COUNTRIES.items():
        if data["name"].lower() == country_lower:
            return code

    return None


@router.get("/suggestions", response_model=LocationSuggestionsResponse)
async def get_suggestions(
    country: Optional[str] = Query(None, description="Country name from geocoding (e.g., 'United States')"),
    admin1: Optional[str] = Query(None, description="State/region from geocoding (e.g., 'New York')"),
    country_code: Optional[str] = Query(None, description="ISO 3166-1 alpha-2 country code (e.g., 'US')"),
    state_code: Optional[str] = Query(None, description="US state code (e.g., 'NY')"),
):
    """
    Get location-based suggestions for CO2 factor, electricity price, etc.

    Accepts either:
    - country + admin1 (from Open-Meteo geocoding response)
    - country_code + state_code (direct codes)

    For US locations, returns state-level data from EPA eGRID and EIA.
    For other countries, returns country-level estimates.

    Example for Rochester, NY:
    - CO2 factor: 0.125 kg/kWh (EPA eGRID NYUP subregion - very clean due to nuclear/hydro)
    - Electricity: $0.198/kWh (RG&E 2024 rates)
    - Solar yield: 1200 kWh/kWp/year (NREL estimate)
    """
    # Detect codes from names if not provided
    detected_country_code = country_code or detect_country_code(country)
    detected_state_code = state_code or detect_us_state_from_admin1(admin1)

    # Get suggestions based on location
    suggestions_data = get_location_suggestions(
        country_code=detected_country_code or "US",
        state_code=detected_state_code
    )

    # Get display names
    country_name = None
    state_name = None

    if detected_country_code:
        country_data = get_country_data(detected_country_code)
        if country_data:
            country_name = country_data["name"]

    if detected_state_code:
        state_data = get_us_state_data(detected_state_code)
        if state_data:
            state_name = state_data["name"]

    return LocationSuggestionsResponse(
        detected_country=detected_country_code,
        detected_country_name=country_name,
        detected_state=detected_state_code,
        detected_state_name=state_name,
        suggestions=LocationSuggestion(**suggestions_data),
        tree_co2_absorption=TREE_CO2_ABSORPTION_KG_YEAR,
        tree_source=DATA_SOURCES["tree_absorption"],
    )


@router.get("/sources", response_model=DataSourcesResponse)
async def get_data_sources():
    """
    Get list of all data sources used for calculations.

    Returns citations for transparency and verification.
    """
    return DataSourcesResponse(sources=DATA_SOURCES)


@router.get("/us-states")
async def list_us_states():
    """
    List all US states with their data.

    Returns CO2 factors, electricity prices, and expected solar yields
    for all 50 states + DC.
    """
    return {
        "states": [
            {
                "code": code,
                "name": data["name"],
                "co2_factor": data["co2_factor"],
                "electricity_price": data["electricity_price"],
                "expected_yield": data["expected_yield"],
                "egrid_subregion": data["egrid_subregion"],
            }
            for code, data in sorted(US_STATES.items(), key=lambda x: x[1]["name"])
        ],
        "source_co2": DATA_SOURCES["us_co2"],
        "source_electricity": DATA_SOURCES["us_electricity"],
        "source_solar": DATA_SOURCES["us_solar"],
    }


@router.get("/countries")
async def list_countries():
    """
    List all countries with their data.

    Returns CO2 factors, electricity prices, currencies, and expected solar yields.
    """
    return {
        "countries": [
            {
                "code": code,
                "name": data["name"],
                "co2_factor": data["co2_factor"],
                "electricity_price": data["electricity_price"],
                "currency_code": data["currency_code"],
                "currency_symbol": data["currency_symbol"],
                "expected_yield": data["expected_yield"],
            }
            for code, data in sorted(COUNTRIES.items(), key=lambda x: x[1]["name"])
        ],
        "source_co2": DATA_SOURCES["global_co2"],
        "source_electricity": DATA_SOURCES["global_electricity"],
    }
