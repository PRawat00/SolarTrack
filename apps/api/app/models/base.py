import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator

from app.config import settings

# Set TNS_ADMIN for Oracle wallet-based connections
# This must be set before creating the engine
if settings.TNS_ADMIN:
    os.environ["TNS_ADMIN"] = settings.TNS_ADMIN

# Build connect_args for Oracle wallet connections
connect_args = {}
if settings.DATABASE_URL.startswith("oracle"):
    connect_args = {
        "config_dir": settings.TNS_ADMIN,
        "wallet_location": settings.TNS_ADMIN,
        "wallet_password": settings.WALLET_PASSWORD if settings.WALLET_PASSWORD else None,
    }

# Create engine - supports both Oracle and PostgreSQL based on DATABASE_URL
# Oracle: oracle+oracledb://user:pass@service_name (with TNS_ADMIN pointing to wallet)
# PostgreSQL: postgresql://user:pass@host:port/db
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using
    pool_size=5,
    max_overflow=10,
    connect_args=connect_args if connect_args else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator:
    """
    Database session dependency for FastAPI.

    Usage:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
