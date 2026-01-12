from sqlalchemy import Column, String, Numeric, Integer, Text, DateTime, Index
from sqlalchemy.sql import func
from .base import Base
import uuid


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
    country_code = Column(String(2), nullable=True)  # ISO 3166-1 alpha-2 (e.g., "US", "TH")
    state_code = Column(String(2), nullable=True)  # US state code (e.g., "NY", "CA")
    theme = Column(String(10), default="dark")
    family_feature_enabled = Column(Integer, default=1)  # Oracle uses NUMBER(1) for boolean
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
    # Attribution - who actually created this reading (for family sharing)
    created_by = Column(String(255), nullable=True)  # Actual user who created this
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


def generate_uuid_str() -> str:
    """Generate a UUID as string for Supabase PostgreSQL."""
    return str(uuid.uuid4())


class Family(Base):
    """Family group for collaborative solar tracking."""
    __tablename__ = "families"

    id = Column(String(36), primary_key=True, default=generate_uuid_str)
    name = Column(String(100), nullable=False)
    owner_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class FamilyMember(Base):
    """Membership in a family."""
    __tablename__ = "family_members"

    id = Column(String(36), primary_key=True, default=generate_uuid_str)
    family_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, unique=True, index=True)  # One family per user
    display_name = Column(String(100), nullable=True)
    role = Column(String(20), default="member")  # "owner" or "member"
    joined_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_family_member", "family_id", "user_id"),
    )


class FamilyImage(Base):
    """Images uploaded to family pool for processing."""
    __tablename__ = "family_images"

    id = Column(String(36), primary_key=True, default=generate_uuid_str)
    family_id = Column(String(36), nullable=False, index=True)
    uploader_id = Column(String(36), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    mime_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)
    # Status: uploaded, tagged, claimed, processing, processed, error
    status = Column(String(20), default="uploaded")
    claimed_by = Column(String(36), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    processed_by = Column(String(36), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    readings_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    # Table tagging fields
    table_regions = Column(Text, nullable=True)  # JSON array of region coordinates
    tagged_by = Column(String(36), nullable=True)
    tagged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_family_images_status", "family_id", "status"),
        Index("idx_family_images_claimed", "family_id", "claimed_by"),
    )


class FamilyInvite(Base):
    """Invite link for joining a family (Discord-style)."""
    __tablename__ = "family_invites"

    id = Column(String(36), primary_key=True, default=generate_uuid_str)
    family_id = Column(String(36), nullable=False, index=True)
    token = Column(String(36), nullable=False, unique=True, index=True, default=generate_uuid_str)
    created_by = Column(String(36), nullable=False)
    expires_at = Column(DateTime, nullable=True)  # NULL = never expires
    max_uses = Column(Integer, nullable=True)  # NULL = unlimited
    use_count = Column(Integer, default=0)
    is_active = Column(Integer, default=1)  # Oracle uses NUMBER(1) for boolean
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_family_invites_token", "token"),
    )
