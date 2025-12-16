"""
Migration script to add snowfall column to solar_readings table.
Run this script to add the snowfall column for storing snow data from Open-Meteo API.
"""
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.models.base import engine


def run_migration():
    """Add snowfall column to solar_readings table."""
    with engine.connect() as conn:
        try:
            # Add snowfall column (NUMBER(5,2) for Oracle)
            conn.execute(text("""
                ALTER TABLE solar_readings ADD snowfall NUMBER(5,2)
            """))
            conn.commit()
            print("Successfully added snowfall column to solar_readings table")
        except Exception as e:
            if "ORA-01430" in str(e):  # Column already exists
                print("Column 'snowfall' already exists, skipping...")
            else:
                print(f"Error adding column: {e}")
                raise


if __name__ == "__main__":
    run_migration()
