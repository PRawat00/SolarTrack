"""
Location-based data for accurate dashboard calculations.

Data Sources:
- CO2 emissions (USA): EPA eGRID 2022 (released Jan 2024)
  https://www.epa.gov/egrid
- Electricity prices (USA): EIA State Electricity Profiles 2024
  https://www.eia.gov/electricity/state/
- Solar yield (USA): NREL PVWatts / NSRDB
  https://pvwatts.nrel.gov/
- Tree CO2 absorption: EPA Greenhouse Gas Equivalencies Calculator
  https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references
- Global CO2: Ember Climate / Our World in Data 2023
  https://ourworldindata.org/grapher/carbon-intensity-electricity
- Global electricity prices: GlobalPetrolPrices Q3 2024
  https://www.globalpetrolprices.com/electricity_prices/
"""

from typing import Optional, TypedDict


class StateData(TypedDict):
    name: str
    co2_factor: float  # kg CO2 per kWh
    electricity_price: float  # USD per kWh
    expected_yield: int  # kWh per kWp per year
    egrid_subregion: str  # EPA eGRID subregion code


class CountryData(TypedDict):
    name: str
    co2_factor: float  # kg CO2 per kWh
    electricity_price: float  # USD per kWh
    currency_code: str
    currency_symbol: str
    expected_yield: int  # kWh per kWp per year (national average)


# EPA official value for tree CO2 absorption
# Source: EPA Greenhouse Gas Equivalencies Calculator
# Urban tree sequesters 0.060 metric tons CO2/year = 60 kg CO2/year
TREE_CO2_ABSORPTION_KG_YEAR = 60

# US National average (for fallback)
US_NATIONAL_CO2_FACTOR = 0.37  # kg/kWh (EIA 2023)
US_NATIONAL_ELECTRICITY_PRICE = 0.165  # USD/kWh (EIA 2024)


# ============================================================================
# US STATES DATA
# CO2: EPA eGRID 2022 (lbs CO2/MWh converted to kg CO2/kWh)
# Prices: EIA 2024 residential average (cents/kWh converted to $/kWh)
# Solar: NREL PVWatts regional estimates (kWh/kWp/year)
# ============================================================================

US_STATES: dict[str, StateData] = {
    # NEW YORK - Priority state with subregion data
    # NYUP (Upstate): 274.6 lbs/MWh = 0.125 kg/kWh (nuclear + hydro)
    # NYCW (NYC/Westchester): 885.2 lbs/MWh = 0.401 kg/kWh
    # NYLI (Long Island): 1200.7 lbs/MWh = 0.545 kg/kWh
    # Rochester is in NYUP subregion
    "NY": {
        "name": "New York",
        "co2_factor": 0.125,  # NYUP (Upstate) - Rochester area
        "electricity_price": 0.198,  # RG&E Rochester 2024
        "expected_yield": 1200,  # Rochester area (northeast)
        "egrid_subregion": "NYUP",
    },

    # Other states (EPA eGRID 2022 + EIA 2024)
    "AL": {
        "name": "Alabama",
        "co2_factor": 0.358,  # SRSO subregion
        "electricity_price": 0.136,
        "expected_yield": 1400,
        "egrid_subregion": "SRSO",
    },
    "AK": {
        "name": "Alaska",
        "co2_factor": 0.420,  # AKGD/AKMS
        "electricity_price": 0.229,
        "expected_yield": 1000,
        "egrid_subregion": "AKGD",
    },
    "AZ": {
        "name": "Arizona",
        "co2_factor": 0.349,  # AZNM subregion
        "electricity_price": 0.137,
        "expected_yield": 1850,  # Excellent solar
        "egrid_subregion": "AZNM",
    },
    "AR": {
        "name": "Arkansas",
        "co2_factor": 0.420,  # SPSO subregion
        "electricity_price": 0.098,
        "expected_yield": 1400,
        "egrid_subregion": "SPSO",
    },
    "CA": {
        "name": "California",
        "co2_factor": 0.220,  # CAMX subregion (very clean)
        "electricity_price": 0.267,
        "expected_yield": 1600,
        "egrid_subregion": "CAMX",
    },
    "CO": {
        "name": "Colorado",
        "co2_factor": 0.540,  # RMPA subregion
        "electricity_price": 0.145,
        "expected_yield": 1550,
        "egrid_subregion": "RMPA",
    },
    "CT": {
        "name": "Connecticut",
        "co2_factor": 0.210,  # NEWE subregion
        "electricity_price": 0.219,
        "expected_yield": 1200,
        "egrid_subregion": "NEWE",
    },
    "DE": {
        "name": "Delaware",
        "co2_factor": 0.375,  # RFCE subregion
        "electricity_price": 0.135,
        "expected_yield": 1300,
        "egrid_subregion": "RFCE",
    },
    "FL": {
        "name": "Florida",
        "co2_factor": 0.380,  # FRCC subregion
        "electricity_price": 0.138,
        "expected_yield": 1450,
        "egrid_subregion": "FRCC",
    },
    "GA": {
        "name": "Georgia",
        "co2_factor": 0.350,  # SRSO subregion
        "electricity_price": 0.132,
        "expected_yield": 1400,
        "egrid_subregion": "SRSO",
    },
    "HI": {
        "name": "Hawaii",
        "co2_factor": 0.620,  # HIOA (petroleum-heavy)
        "electricity_price": 0.321,
        "expected_yield": 1650,
        "egrid_subregion": "HIOA",
    },
    "ID": {
        "name": "Idaho",
        "co2_factor": 0.120,  # NWPP (hydro-heavy)
        "electricity_price": 0.099,
        "expected_yield": 1350,
        "egrid_subregion": "NWPP",
    },
    "IL": {
        "name": "Illinois",
        "co2_factor": 0.285,  # RFCW (nuclear + renewables)
        "electricity_price": 0.148,
        "expected_yield": 1250,
        "egrid_subregion": "RFCW",
    },
    "IN": {
        "name": "Indiana",
        "co2_factor": 0.680,  # RFCW (coal-heavy)
        "electricity_price": 0.141,
        "expected_yield": 1250,
        "egrid_subregion": "RFCW",
    },
    "IA": {
        "name": "Iowa",
        "co2_factor": 0.380,  # MROW (wind + coal)
        "electricity_price": 0.122,
        "expected_yield": 1300,
        "egrid_subregion": "MROW",
    },
    "KS": {
        "name": "Kansas",
        "co2_factor": 0.420,  # SPNO subregion
        "electricity_price": 0.127,
        "expected_yield": 1450,
        "egrid_subregion": "SPNO",
    },
    "KY": {
        "name": "Kentucky",
        "co2_factor": 0.750,  # SRTV (coal-heavy)
        "electricity_price": 0.117,
        "expected_yield": 1300,
        "egrid_subregion": "SRTV",
    },
    "LA": {
        "name": "Louisiana",
        "co2_factor": 0.380,  # SPSO subregion
        "electricity_price": 0.098,
        "expected_yield": 1400,
        "egrid_subregion": "SPSO",
    },
    "ME": {
        "name": "Maine",
        "co2_factor": 0.160,  # NEWE (hydro + renewables)
        "electricity_price": 0.189,
        "expected_yield": 1150,
        "egrid_subregion": "NEWE",
    },
    "MD": {
        "name": "Maryland",
        "co2_factor": 0.340,  # RFCE subregion
        "electricity_price": 0.145,
        "expected_yield": 1300,
        "egrid_subregion": "RFCE",
    },
    "MA": {
        "name": "Massachusetts",
        "co2_factor": 0.280,  # NEWE subregion
        "electricity_price": 0.219,
        "expected_yield": 1200,
        "egrid_subregion": "NEWE",
    },
    "MI": {
        "name": "Michigan",
        "co2_factor": 0.450,  # RFCM subregion
        "electricity_price": 0.177,
        "expected_yield": 1200,
        "egrid_subregion": "RFCM",
    },
    "MN": {
        "name": "Minnesota",
        "co2_factor": 0.380,  # MROW (wind growing)
        "electricity_price": 0.139,
        "expected_yield": 1250,
        "egrid_subregion": "MROW",
    },
    "MS": {
        "name": "Mississippi",
        "co2_factor": 0.380,  # SRSO subregion
        "electricity_price": 0.118,
        "expected_yield": 1400,
        "egrid_subregion": "SRSO",
    },
    "MO": {
        "name": "Missouri",
        "co2_factor": 0.680,  # SRMW (coal-heavy)
        "electricity_price": 0.117,
        "expected_yield": 1350,
        "egrid_subregion": "SRMW",
    },
    "MT": {
        "name": "Montana",
        "co2_factor": 0.450,  # NWPP subregion
        "electricity_price": 0.115,
        "expected_yield": 1350,
        "egrid_subregion": "NWPP",
    },
    "NE": {
        "name": "Nebraska",
        "co2_factor": 0.520,  # MROW subregion
        "electricity_price": 0.106,
        "expected_yield": 1400,
        "egrid_subregion": "MROW",
    },
    "NV": {
        "name": "Nevada",
        "co2_factor": 0.320,  # NWPP subregion
        "electricity_price": 0.125,
        "expected_yield": 1750,
        "egrid_subregion": "NWPP",
    },
    "NH": {
        "name": "New Hampshire",
        "co2_factor": 0.140,  # NEWE (nuclear)
        "electricity_price": 0.199,
        "expected_yield": 1150,
        "egrid_subregion": "NEWE",
    },
    "NJ": {
        "name": "New Jersey",
        "co2_factor": 0.250,  # RFCE (nuclear)
        "electricity_price": 0.169,
        "expected_yield": 1250,
        "egrid_subregion": "RFCE",
    },
    "NM": {
        "name": "New Mexico",
        "co2_factor": 0.480,  # AZNM subregion
        "electricity_price": 0.132,
        "expected_yield": 1750,
        "egrid_subregion": "AZNM",
    },
    "NC": {
        "name": "North Carolina",
        "co2_factor": 0.320,  # SRVC (nuclear)
        "electricity_price": 0.123,
        "expected_yield": 1350,
        "egrid_subregion": "SRVC",
    },
    "ND": {
        "name": "North Dakota",
        "co2_factor": 0.680,  # MROW (coal)
        "electricity_price": 0.105,
        "expected_yield": 1350,
        "egrid_subregion": "MROW",
    },
    "OH": {
        "name": "Ohio",
        "co2_factor": 0.480,  # RFCW subregion
        "electricity_price": 0.136,
        "expected_yield": 1200,
        "egrid_subregion": "RFCW",
    },
    "OK": {
        "name": "Oklahoma",
        "co2_factor": 0.350,  # SPSO (wind + gas)
        "electricity_price": 0.102,
        "expected_yield": 1450,
        "egrid_subregion": "SPSO",
    },
    "OR": {
        "name": "Oregon",
        "co2_factor": 0.160,  # NWPP (hydro)
        "electricity_price": 0.117,
        "expected_yield": 1300,
        "egrid_subregion": "NWPP",
    },
    "PA": {
        "name": "Pennsylvania",
        "co2_factor": 0.320,  # RFCE (nuclear)
        "electricity_price": 0.156,
        "expected_yield": 1200,
        "egrid_subregion": "RFCE",
    },
    "RI": {
        "name": "Rhode Island",
        "co2_factor": 0.350,  # NEWE subregion
        "electricity_price": 0.217,
        "expected_yield": 1200,
        "egrid_subregion": "NEWE",
    },
    "SC": {
        "name": "South Carolina",
        "co2_factor": 0.280,  # SRVC (nuclear)
        "electricity_price": 0.137,
        "expected_yield": 1400,
        "egrid_subregion": "SRVC",
    },
    "SD": {
        "name": "South Dakota",
        "co2_factor": 0.250,  # MROW (hydro + wind)
        "electricity_price": 0.117,
        "expected_yield": 1400,
        "egrid_subregion": "MROW",
    },
    "TN": {
        "name": "Tennessee",
        "co2_factor": 0.340,  # SRTV (TVA nuclear)
        "electricity_price": 0.115,
        "expected_yield": 1350,
        "egrid_subregion": "SRTV",
    },
    "TX": {
        "name": "Texas",
        "co2_factor": 0.350,  # ERCT (wind + gas)
        "electricity_price": 0.142,
        "expected_yield": 1500,
        "egrid_subregion": "ERCT",
    },
    "UT": {
        "name": "Utah",
        "co2_factor": 0.620,  # NWPP (coal)
        "electricity_price": 0.108,
        "expected_yield": 1550,
        "egrid_subregion": "NWPP",
    },
    "VT": {
        "name": "Vermont",
        "co2_factor": 0.030,  # NEWE (hydro + nuclear import)
        "electricity_price": 0.179,
        "expected_yield": 1150,
        "egrid_subregion": "NEWE",
    },
    "VA": {
        "name": "Virginia",
        "co2_factor": 0.300,  # SRVC (nuclear)
        "electricity_price": 0.127,
        "expected_yield": 1300,
        "egrid_subregion": "SRVC",
    },
    "WA": {
        "name": "Washington",
        "co2_factor": 0.080,  # NWPP (hydro-dominant)
        "electricity_price": 0.097,
        "expected_yield": 1100,
        "egrid_subregion": "NWPP",
    },
    "WV": {
        "name": "West Virginia",
        "co2_factor": 0.870,  # RFCW (coal-dominant)
        "electricity_price": 0.127,
        "expected_yield": 1200,
        "egrid_subregion": "RFCW",
    },
    "WI": {
        "name": "Wisconsin",
        "co2_factor": 0.480,  # MROE subregion
        "electricity_price": 0.146,
        "expected_yield": 1200,
        "egrid_subregion": "MROE",
    },
    "WY": {
        "name": "Wyoming",
        "co2_factor": 0.820,  # RMPA (coal)
        "electricity_price": 0.097,
        "expected_yield": 1500,
        "egrid_subregion": "RMPA",
    },
    "DC": {
        "name": "District of Columbia",
        "co2_factor": 0.340,  # RFCE subregion
        "electricity_price": 0.138,
        "expected_yield": 1250,
        "egrid_subregion": "RFCE",
    },
}


# ============================================================================
# COUNTRIES DATA
# For non-US countries, using Ember/Our World in Data + GlobalPetrolPrices
# These are reasonable estimates; users can override
# ============================================================================

COUNTRIES: dict[str, CountryData] = {
    "US": {
        "name": "United States",
        "co2_factor": 0.370,  # National average (state data is more accurate)
        "electricity_price": 0.165,
        "currency_code": "USD",
        "currency_symbol": "$",
        "expected_yield": 1400,
    },
    "CA": {
        "name": "Canada",
        "co2_factor": 0.120,  # Hydro-dominant
        "electricity_price": 0.130,
        "currency_code": "CAD",
        "currency_symbol": "C$",
        "expected_yield": 1200,
    },
    "MX": {
        "name": "Mexico",
        "co2_factor": 0.420,
        "electricity_price": 0.080,
        "currency_code": "MXN",
        "currency_symbol": "$",
        "expected_yield": 1600,
    },
    "GB": {
        "name": "United Kingdom",
        "co2_factor": 0.200,  # Offshore wind growing
        "electricity_price": 0.280,
        "currency_code": "GBP",
        "currency_symbol": "£",
        "expected_yield": 950,
    },
    "DE": {
        "name": "Germany",
        "co2_factor": 0.350,
        "electricity_price": 0.360,
        "currency_code": "EUR",
        "currency_symbol": "€",
        "expected_yield": 1000,
    },
    "FR": {
        "name": "France",
        "co2_factor": 0.050,  # Nuclear-dominant
        "electricity_price": 0.210,
        "currency_code": "EUR",
        "currency_symbol": "€",
        "expected_yield": 1150,
    },
    "ES": {
        "name": "Spain",
        "co2_factor": 0.150,
        "electricity_price": 0.180,
        "currency_code": "EUR",
        "currency_symbol": "€",
        "expected_yield": 1500,
    },
    "IT": {
        "name": "Italy",
        "co2_factor": 0.280,
        "electricity_price": 0.290,
        "currency_code": "EUR",
        "currency_symbol": "€",
        "expected_yield": 1350,
    },
    "NL": {
        "name": "Netherlands",
        "co2_factor": 0.330,
        "electricity_price": 0.230,
        "currency_code": "EUR",
        "currency_symbol": "€",
        "expected_yield": 950,
    },
    "BE": {
        "name": "Belgium",
        "co2_factor": 0.140,  # Nuclear
        "electricity_price": 0.310,
        "currency_code": "EUR",
        "currency_symbol": "€",
        "expected_yield": 950,
    },
    "AT": {
        "name": "Austria",
        "co2_factor": 0.100,  # Hydro
        "electricity_price": 0.250,
        "currency_code": "EUR",
        "currency_symbol": "€",
        "expected_yield": 1100,
    },
    "CH": {
        "name": "Switzerland",
        "co2_factor": 0.030,  # Hydro + nuclear
        "electricity_price": 0.220,
        "currency_code": "CHF",
        "currency_symbol": "CHF",
        "expected_yield": 1100,
    },
    "SE": {
        "name": "Sweden",
        "co2_factor": 0.030,  # Hydro + nuclear
        "electricity_price": 0.200,
        "currency_code": "SEK",
        "currency_symbol": "kr",
        "expected_yield": 900,
    },
    "NO": {
        "name": "Norway",
        "co2_factor": 0.020,  # Almost 100% hydro
        "electricity_price": 0.150,
        "currency_code": "NOK",
        "currency_symbol": "kr",
        "expected_yield": 850,
    },
    "DK": {
        "name": "Denmark",
        "co2_factor": 0.120,  # Wind leader
        "electricity_price": 0.350,
        "currency_code": "DKK",
        "currency_symbol": "kr",
        "expected_yield": 950,
    },
    "FI": {
        "name": "Finland",
        "co2_factor": 0.080,  # Nuclear + hydro
        "electricity_price": 0.180,
        "currency_code": "EUR",
        "currency_symbol": "€",
        "expected_yield": 900,
    },
    "PL": {
        "name": "Poland",
        "co2_factor": 0.680,  # Coal-heavy
        "electricity_price": 0.180,
        "currency_code": "PLN",
        "currency_symbol": "zł",
        "expected_yield": 1050,
    },
    "AU": {
        "name": "Australia",
        "co2_factor": 0.510,
        "electricity_price": 0.250,
        "currency_code": "AUD",
        "currency_symbol": "A$",
        "expected_yield": 1500,
    },
    "NZ": {
        "name": "New Zealand",
        "co2_factor": 0.100,  # Hydro + geothermal
        "electricity_price": 0.200,
        "currency_code": "NZD",
        "currency_symbol": "NZ$",
        "expected_yield": 1300,
    },
    "JP": {
        "name": "Japan",
        "co2_factor": 0.450,
        "electricity_price": 0.220,
        "currency_code": "JPY",
        "currency_symbol": "¥",
        "expected_yield": 1200,
    },
    "KR": {
        "name": "South Korea",
        "co2_factor": 0.420,
        "electricity_price": 0.110,
        "currency_code": "KRW",
        "currency_symbol": "₩",
        "expected_yield": 1250,
    },
    "CN": {
        "name": "China",
        "co2_factor": 0.530,
        "electricity_price": 0.080,
        "currency_code": "CNY",
        "currency_symbol": "¥",
        "expected_yield": 1300,
    },
    "IN": {
        "name": "India",
        "co2_factor": 0.710,  # Coal-heavy
        "electricity_price": 0.080,
        "currency_code": "INR",
        "currency_symbol": "₹",
        "expected_yield": 1500,
    },
    "TH": {
        "name": "Thailand",
        "co2_factor": 0.450,
        "electricity_price": 0.120,
        "currency_code": "THB",
        "currency_symbol": "฿",
        "expected_yield": 1350,
    },
    "SG": {
        "name": "Singapore",
        "co2_factor": 0.400,
        "electricity_price": 0.200,
        "currency_code": "SGD",
        "currency_symbol": "S$",
        "expected_yield": 1400,
    },
    "MY": {
        "name": "Malaysia",
        "co2_factor": 0.550,
        "electricity_price": 0.070,
        "currency_code": "MYR",
        "currency_symbol": "RM",
        "expected_yield": 1400,
    },
    "PH": {
        "name": "Philippines",
        "co2_factor": 0.520,
        "electricity_price": 0.180,
        "currency_code": "PHP",
        "currency_symbol": "₱",
        "expected_yield": 1450,
    },
    "ID": {
        "name": "Indonesia",
        "co2_factor": 0.650,
        "electricity_price": 0.100,
        "currency_code": "IDR",
        "currency_symbol": "Rp",
        "expected_yield": 1400,
    },
    "VN": {
        "name": "Vietnam",
        "co2_factor": 0.450,
        "electricity_price": 0.080,
        "currency_code": "VND",
        "currency_symbol": "₫",
        "expected_yield": 1350,
    },
    "BR": {
        "name": "Brazil",
        "co2_factor": 0.080,  # Hydro-dominant
        "electricity_price": 0.150,
        "currency_code": "BRL",
        "currency_symbol": "R$",
        "expected_yield": 1500,
    },
    "AR": {
        "name": "Argentina",
        "co2_factor": 0.310,
        "electricity_price": 0.050,
        "currency_code": "ARS",
        "currency_symbol": "$",
        "expected_yield": 1500,
    },
    "CL": {
        "name": "Chile",
        "co2_factor": 0.340,
        "electricity_price": 0.140,
        "currency_code": "CLP",
        "currency_symbol": "$",
        "expected_yield": 1700,
    },
    "ZA": {
        "name": "South Africa",
        "co2_factor": 0.850,  # Coal-heavy
        "electricity_price": 0.100,
        "currency_code": "ZAR",
        "currency_symbol": "R",
        "expected_yield": 1600,
    },
    "AE": {
        "name": "United Arab Emirates",
        "co2_factor": 0.420,
        "electricity_price": 0.080,
        "currency_code": "AED",
        "currency_symbol": "د.إ",
        "expected_yield": 1800,
    },
    "SA": {
        "name": "Saudi Arabia",
        "co2_factor": 0.550,
        "electricity_price": 0.050,
        "currency_code": "SAR",
        "currency_symbol": "﷼",
        "expected_yield": 1850,
    },
    "IL": {
        "name": "Israel",
        "co2_factor": 0.480,
        "electricity_price": 0.150,
        "currency_code": "ILS",
        "currency_symbol": "₪",
        "expected_yield": 1750,
    },
    "EG": {
        "name": "Egypt",
        "co2_factor": 0.450,
        "electricity_price": 0.040,
        "currency_code": "EGP",
        "currency_symbol": "£",
        "expected_yield": 1800,
    },
}


# Data source citations
DATA_SOURCES = {
    "us_co2": "EPA eGRID 2022 (released January 2024)",
    "us_electricity": "EIA State Electricity Profiles 2024",
    "us_solar": "NREL PVWatts / National Solar Radiation Database",
    "tree_absorption": "EPA Greenhouse Gas Equivalencies Calculator",
    "global_co2": "Ember Climate / Our World in Data 2023",
    "global_electricity": "GlobalPetrolPrices Q3 2024",
    "rochester_ny": "EPA eGRID NYUP subregion + RG&E 2024 rates",
}


def get_us_state_data(state_code: str) -> Optional[StateData]:
    """Get data for a US state by 2-letter code."""
    return US_STATES.get(state_code.upper())


def get_country_data(country_code: str) -> Optional[CountryData]:
    """Get data for a country by ISO 3166-1 alpha-2 code."""
    return COUNTRIES.get(country_code.upper())


def get_location_suggestions(
    country_code: str,
    state_code: Optional[str] = None
) -> dict:
    """
    Get suggested values based on location.

    For US locations, uses state-level data if available.
    For other countries, uses country-level data.

    Returns dict with co2_factor, electricity_price, currency_symbol,
    expected_yield, and source citations.
    """
    # US locations use state-level data
    if country_code.upper() == "US" and state_code:
        state_data = get_us_state_data(state_code)
        if state_data:
            return {
                "co2_factor": state_data["co2_factor"],
                "co2_source": f"EPA eGRID 2022 ({state_data['egrid_subregion']} subregion)",
                "electricity_price": state_data["electricity_price"],
                "electricity_source": f"EIA 2024 - {state_data['name']}",
                "currency_symbol": "$",
                "expected_yield": state_data["expected_yield"],
                "expected_yield_source": f"NREL PVWatts - {state_data['name']}",
            }

    # Non-US or no state data: use country data
    country_data = get_country_data(country_code)
    if country_data:
        return {
            "co2_factor": country_data["co2_factor"],
            "co2_source": DATA_SOURCES["global_co2"],
            "electricity_price": country_data["electricity_price"],
            "electricity_source": DATA_SOURCES["global_electricity"],
            "currency_symbol": country_data["currency_symbol"],
            "expected_yield": country_data["expected_yield"],
            "expected_yield_source": "Global Solar Atlas / PVGIS estimates",
        }

    # Fallback to US national average
    return {
        "co2_factor": US_NATIONAL_CO2_FACTOR,
        "co2_source": "US National Average (EIA 2023)",
        "electricity_price": US_NATIONAL_ELECTRICITY_PRICE,
        "electricity_source": "US National Average (EIA 2024)",
        "currency_symbol": "$",
        "expected_yield": 1400,
        "expected_yield_source": "Global average estimate",
    }
