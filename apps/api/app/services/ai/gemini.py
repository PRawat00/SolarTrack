from google import genai
from google.genai import types
from typing import List
import json
import os

from app.config import settings
from app.services.ai.base import AIProvider, ExtractedReading


EXTRACTION_PROMPT = """
Analyze this image of a solar production log or meter reading. Extract all solar energy readings visible.

For each reading, identify:
1. Date (format as YYYY-MM-DD)
2. Time if visible (format as HH:MM, 24-hour)
3. m1: Primary meter reading in kWh
4. m2: Secondary meter reading in kWh (if present)
5. Any notes or additional info visible

Return a JSON array with this exact format:
[
  {"date": "2025-01-15", "time": "09:00", "m1": 45.5, "m2": null, "notes": "morning reading"},
  {"date": "2025-01-16", "time": null, "m1": 52.3, "m2": 12.1, "notes": null}
]

Important:
- Only return the JSON array, no other text
- If no readings can be extracted, return an empty array: []
- Date format must be YYYY-MM-DD
- m1 is required for each reading
"""


class GeminiProvider(AIProvider):
    """Google Gemini AI provider for solar log extraction."""

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        # Set API key in environment for the client
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
        self.client = genai.Client()

    async def extract_readings(
        self,
        image_data: bytes,
        mime_type: str,
        prompt: str | None = None,
    ) -> List[ExtractedReading]:
        """
        Extract readings from image using Gemini vision.

        The image is processed in memory and not stored anywhere.
        """
        # Create image part using the new SDK
        image_part = types.Part.from_bytes(
            data=image_data,
            mime_type=mime_type,
        )

        # Generate response using new SDK
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                prompt or EXTRACTION_PROMPT,
                image_part,
            ],
        )

        # Parse JSON response
        try:
            text = response.text.strip()

            # Handle markdown code blocks that Gemini sometimes returns
            if text.startswith("```"):
                lines = text.split("\n")
                # Remove first and last lines (``` markers)
                text = "\n".join(lines[1:-1])
                if text.startswith("json"):
                    text = text[4:].strip()

            readings_data = json.loads(text)

            return [
                ExtractedReading(
                    date=r["date"],
                    time=r.get("time"),
                    m1=float(r["m1"]),
                    m2=float(r["m2"]) if r.get("m2") is not None else None,
                    notes=r.get("notes"),
                )
                for r in readings_data
            ]
        except (json.JSONDecodeError, KeyError, TypeError):
            # Return empty list if parsing fails
            return []

    def get_provider_name(self) -> str:
        return "gemini"
