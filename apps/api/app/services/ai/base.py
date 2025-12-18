from abc import ABC, abstractmethod
from typing import List
from pydantic import BaseModel, field_validator
from datetime import datetime


class ExtractedReading(BaseModel):
    """Model for extracted solar readings from AI"""

    date: str  # YYYY-MM-DD
    time: str | None = None  # HH:MM
    m1: float  # Meter 1 reading (kWh)
    m2: float | None = None  # Meter 2 reading (kWh)
    notes: str | None = None

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        """Try multiple date formats and normalize to YYYY-MM-DD"""
        formats = [
            "%Y-%m-%d",  # ISO: 2025-01-15
            "%m/%d/%y",  # US short: 9/17/19, 10/3/19 (USER'S FORMAT)
            "%m-%d-%y",  # US short with dash: 9-17-19
            "%m/%d/%Y",  # US with slash: 01/15/2025
            "%m-%d-%Y",  # US: 01-15-2025
            "%d-%m-%Y",  # EU: 15-01-2025
            "%d/%m/%Y",  # EU with slash: 15/01/2025
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(v, fmt)
                return dt.strftime("%Y-%m-%d")  # Normalize to ISO
            except ValueError:
                continue
        raise ValueError(f"Could not parse date: {v}")

    @field_validator("m1")
    @classmethod
    def validate_m1(cls, v: float) -> float:
        """Validate m1 is non-negative"""
        if v < 0:
            raise ValueError(f"m1 cannot be negative: {v}")
        return v

    @field_validator("m2")
    @classmethod
    def validate_m2(cls, v: float | None) -> float | None:
        """Validate m2 is non-negative if present"""
        if v is not None and v < 0:
            raise ValueError(f"m2 cannot be negative: {v}")
        return v


class ExtractionResult(BaseModel):
    """Result from AI extraction with success/error status"""

    success: bool
    readings: List[ExtractedReading] = []
    error: str | None = None


class AIProvider(ABC):
    """Abstract base class for AI providers"""

    @abstractmethod
    async def extract_readings(
        self, image_data: bytes, mime_type: str, prompt: str | None = None
    ) -> ExtractionResult:
        """
        Extract solar readings from an image

        Args:
            image_data: Binary image data
            mime_type: MIME type of the image (e.g., 'image/jpeg')
            prompt: Optional custom prompt for the AI

        Returns:
            ExtractionResult with success status, readings, and optional error
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Get the name of the AI provider"""
        pass
