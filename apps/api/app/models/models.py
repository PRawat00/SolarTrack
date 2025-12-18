from sqlalchemy import Column, String, Numeric, Integer, Text, DateTime, Index
from sqlalchemy.sql import func
from passlib.context import CryptContext
from .base import Base
import uuid
import secrets
import string

# Password hashing context for family passwords
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_uuid_hex() -> str:
    """Generate a UUID as hex string for compatibility with Oracle RAW(16) or PostgreSQL."""
    return uuid.uuid4().hex


class UserSettings(Base):
    """User settings/preferences table."""
    __tablename__ = "user_settings"

    id = Column(String(32), primary_key=True, default=generate_uuid_hex)
    user_id = Column(String(255), nullable=False, unique=True, index=True)
    currency_symbol = Column(String(5), default="$")
    cost_per_kwh = Column(Numeric(10, 4), default=0.15)
    co2_factor = Column(Numeric(10, 4), default=0.85)
    yearly_goal = Column(Numeric(10, 2), default=12000.00)
    system_capacity = Column(Numeric(10, 2), default=5.00)  # System capacity in kWp
    location_name = Column(String(255), default="Bangkok, Thailand")  # Human-readable location
    latitude = Column(Numeric(10, 6), default=13.7563)  # Default: Bangkok
    longitude = Column(Numeric(10, 6), default=100.5018)  # Default: Bangkok
    theme = Column(String(10), default="dark")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SolarReading(Base):
    """Solar production readings table."""
    __tablename__ = "solar_readings"

    id = Column(String(32), primary_key=True, default=generate_uuid_hex)
    user_id = Column(String(255), nullable=False, index=True)
    reading_date = Column(DateTime, nullable=False)  # DATE of reading
    reading_time = Column(String(10), nullable=True)  # TIME as "HH:MM"
    m1 = Column(Numeric(10, 2), nullable=False)  # Meter 1 reading (kWh)
    m2 = Column(Numeric(10, 2), nullable=True)   # Meter 2 reading (kWh)
    notes = Column(Text, nullable=True)
    is_verified = Column(Integer, default=0)  # Oracle uses NUMBER(1) for boolean
    # Weather data from Open-Meteo API
    weather_code = Column(Integer, nullable=True)  # WMO weather code
    temp_max = Column(Numeric(5, 1), nullable=True)  # Max temperature in Celsius
    sunshine_hours = Column(Numeric(5, 2), nullable=True)  # Hours of sunshine
    radiation_sum = Column(Numeric(8, 2), nullable=True)  # Solar radiation MJ/m2
    snowfall = Column(Numeric(5, 2), nullable=True)  # Daily snowfall in cm
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_readings_user_date", "user_id", "reading_date"),
    )


class ProcessingJob(Base):
    """AI processing job tracking table (audit trail)."""
    __tablename__ = "processing_jobs"

    id = Column(String(32), primary_key=True, default=generate_uuid_hex)
    user_id = Column(String(255), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    result = Column(Text, nullable=True)  # JSON stored as text
    error_text = Column(Text, nullable=True)  # 'error' is reserved
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_jobs_user_status", "user_id", "status"),
    )


class ApiUsage(Base):
    """Track API usage per user per day for rate limiting."""
    __tablename__ = "api_usage"

    id = Column(String(32), primary_key=True, default=generate_uuid_hex)
    user_id = Column(String(255), nullable=False)
    provider = Column(String(50), nullable=False)  # 'gemini', 'openai', etc.
    usage_date = Column(DateTime, nullable=False)  # Date of usage
    request_count = Column(Integer, default=0)

    __table_args__ = (
        Index("idx_api_usage_user_date", "user_id", "provider", "usage_date"),
    )


def generate_join_code(length: int = 8) -> str:
    """Generate random alphanumeric join code (uppercase), excluding confusing characters."""
    # Exclude confusing characters: 0, O, 1, I, L
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


class Family(Base):
    """Family group for collaborative solar tracking."""
    __tablename__ = "families"

    id = Column(String(32), primary_key=True, default=generate_uuid_hex)
    name = Column(String(100), nullable=False)
    join_code = Column(String(8), nullable=False, unique=True, index=True, default=generate_join_code)
    password_hash = Column(String(255), nullable=False)
    owner_id = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def set_password(self, password: str):
        """Hash and set the family password."""
        self.password_hash = pwd_context.hash(password)

    def verify_password(self, password: str) -> bool:
        """Verify the family password."""
        return pwd_context.verify(password, self.password_hash)


class FamilyMember(Base):
    """Membership in a family."""
    __tablename__ = "family_members"

    id = Column(String(32), primary_key=True, default=generate_uuid_hex)
    family_id = Column(String(32), nullable=False, index=True)
    user_id = Column(String(255), nullable=False, unique=True, index=True)  # One family per user
    display_name = Column(String(100), nullable=True)
    role = Column(String(20), default="member")  # "owner" or "member"
    joined_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_family_member", "family_id", "user_id"),
    )


class FamilyImage(Base):
    """Images uploaded to family pool for processing."""
    __tablename__ = "family_images"

    id = Column(String(32), primary_key=True, default=generate_uuid_hex)
    family_id = Column(String(32), nullable=False, index=True)
    uploader_id = Column(String(255), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    mime_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")  # pending, claimed, processing, processed, error
    claimed_by = Column(String(255), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    processed_by = Column(String(255), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    readings_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_family_images_status", "family_id", "status"),
        Index("idx_family_images_claimed", "family_id", "claimed_by"),
    )
