from abc import ABC, abstractmethod
from typing import List
from pydantic import BaseModel


class ExtractedReading(BaseModel):
    """Model for extracted solar readings from AI"""

    date: str  # YYYY-MM-DD
    time: str | None = None  # HH:MM
    m1: float  # Meter 1 reading (kWh)
    m2: float | None = None  # Meter 2 reading (kWh)
    notes: str | None = None


class AIProvider(ABC):
    """Abstract base class for AI providers"""

    @abstractmethod
    async def extract_readings(
        self, image_data: bytes, mime_type: str, prompt: str | None = None
    ) -> List[ExtractedReading]:
        """
        Extract solar readings from an image

        Args:
            image_data: Binary image data
            mime_type: MIME type of the image (e.g., 'image/jpeg')
            prompt: Optional custom prompt for the AI

        Returns:
            List of extracted solar readings
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Get the name of the AI provider"""
        pass
