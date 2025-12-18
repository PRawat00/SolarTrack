from google import genai
from google.genai import types
from typing import List
import json
import os
from pydantic import ValidationError

from app.config import settings
from app.services.ai.base import AIProvider, ExtractedReading, ExtractionResult


EXTRACTION_PROMPT = """
Analyze this image of a handwritten solar production log.

The log may have MULTIPLE COLUMN GROUPS on a single page (could be 2, 3, 4, or more).
Each column group contains: Date | Time | M1 | M2

Extract ALL readings from ALL column groups, reading left-to-right, top-to-bottom.

If the image does NOT contain solar/energy readings, return:
{"success": false, "error": "Brief description of what the image shows instead", "readings": []}

If the image DOES contain solar/energy readings, extract them and return:
{"success": true, "error": null, "readings": [...]}

For each reading in the array, extract:
- date: Convert to YYYY-MM-DD format (e.g., "9/17/19" becomes "2019-09-17")
- time: Time in HH:MM 24-hour format (or null if not visible)
- m1: Primary meter reading in kWh (REQUIRED, must be >= 0)
- m2: Secondary meter reading in kWh (or null if not present)
- notes: null (unless there's something notable)

Example successful response:
{"success": true, "error": null, "readings": [
  {"date": "2019-09-17", "time": "07:00", "m1": 14388, "m2": 14775, "notes": null},
  {"date": "2019-09-18", "time": "07:00", "m1": 14312, "m2": 14993, "notes": null}
]}

IMPORTANT:
- Return ONLY the JSON object, no other text
- Convert dates like "9/17/19" or "10/3/19" to ISO format "2019-09-17"
- M1 and M2 are daily production values in kWh
- Extract EVERY row from EVERY column group (however many there are)
- Do not skip any data
- success must be false if no valid readings can be extracted
"""


class GeminiProvider(AIProvider):
    """Google Gemini AI provider for solar log extraction."""

    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def extract_readings(
        self,
        image_data: bytes,
        mime_type: str,
        prompt: str | None = None,
    ) -> ExtractionResult:
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

            data = json.loads(text)

            # Check if AI reported failure
            if not data.get("success", False):
                return ExtractionResult(
                    success=False,
                    error=data.get("error", "Image does not contain valid solar readings"),
                    readings=[],
                )

            # Parse and validate readings
            readings_data = data.get("readings", [])
            if not readings_data:
                return ExtractionResult(
                    success=False,
                    error="No readings found in the image",
                    readings=[],
                )

            readings = []
            for r in readings_data:
                try:
                    reading = ExtractedReading(
                        date=r["date"],
                        time=r.get("time"),
                        m1=float(r["m1"]),
                        m2=float(r["m2"]) if r.get("m2") is not None else None,
                        notes=r.get("notes"),
                    )
                    readings.append(reading)
                except ValidationError as e:
                    # Return error with validation details
                    error_msg = str(e.errors()[0]["msg"]) if e.errors() else str(e)
                    return ExtractionResult(
                        success=False,
                        error=f"Invalid reading data: {error_msg}",
                        readings=[],
                    )
                except (KeyError, TypeError) as e:
                    return ExtractionResult(
                        success=False,
                        error=f"Missing required field in reading: {e}",
                        readings=[],
                    )

            return ExtractionResult(
                success=True,
                readings=readings,
                error=None,
            )

        except json.JSONDecodeError:
            return ExtractionResult(
                success=False,
                error="Failed to parse AI response. The image may not contain recognizable data.",
                readings=[],
            )

    def get_provider_name(self) -> str:
        return "gemini"
