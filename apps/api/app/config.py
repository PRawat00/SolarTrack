from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "http://localhost:54321")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:54322/postgres"
    )
    TNS_ADMIN: str = os.getenv("TNS_ADMIN", "")
    WALLET_PASSWORD: str = os.getenv("WALLET_PASSWORD", "")

    # AI
    DEFAULT_AI_PROVIDER: str = os.getenv("DEFAULT_AI_PROVIDER", "mock")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_DAILY_LIMIT: int = int(os.getenv("GEMINI_DAILY_LIMIT", "100"))  # Daily request limit
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Mock auth for local development (bypasses JWT validation)
    MOCK_AUTH: bool = os.getenv("MOCK_AUTH", "false").lower() == "true"

    # Family feature
    FAMILY_DATA_PATH: str = os.getenv("FAMILY_DATA_PATH", "/data/families")
    FAMILY_CLAIM_TIMEOUT_MINUTES: int = int(os.getenv("FAMILY_CLAIM_TIMEOUT_MINUTES", "30"))
    FAMILY_MAX_MEMBERS: int = int(os.getenv("FAMILY_MAX_MEMBERS", "20"))
    FAMILY_MAX_PENDING_IMAGES: int = int(os.getenv("FAMILY_MAX_PENDING_IMAGES", "500"))

    # Frontend URL (for generating invite links)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # CORS - configurable via environment variable (comma-separated)
    # Default to localhost for development
    @property
    def CORS_ORIGINS(self) -> list:
        env_origins = os.getenv("CORS_ORIGINS", "")
        if env_origins:
            return [origin.strip() for origin in env_origins.split(",")]
        return [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:8000",
        ]

    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra env vars like CORS_ORIGINS


settings = Settings()
