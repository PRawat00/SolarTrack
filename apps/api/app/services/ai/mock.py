from typing import List
from app.services.ai.base import AIProvider, ExtractedReading


class MockProvider(AIProvider):
    """Mock AI provider for testing without API costs"""

    async def extract_readings(
        self, image_data: bytes, mime_type: str, prompt: str | None = None
    ) -> List[ExtractedReading]:
        """
        Return mock solar readings for testing

        This provider returns realistic fake data for development and testing
        without requiring any API calls or costs.
        """
        # Return some fake but realistic solar readings
        return [
            ExtractedReading(
                date="2025-01-15",
                time="09:00",
                m1=45.5,
                m2=32.1,
                notes="Morning reading",
            ),
            ExtractedReading(
                date="2025-01-16",
                time="09:15",
                m1=52.3,
                m2=38.7,
                notes="Sunny day",
            ),
            ExtractedReading(
                date="2025-01-17",
                time="09:00",
                m1=48.7,
                m2=35.2,
                notes="Partly cloudy",
            ),
        ]

    def get_provider_name(self) -> str:
        """Get provider name"""
        return "mock"
