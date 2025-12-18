from google import genai
from google.genai import types
from typing import List
import json
import os
from pydantic import ValidationError

from app.config import settings
from app.services.ai.base import AIProvider, ExtractedReading, ExtractionResult


EXTRACTION_PROMPT = """
Extract data from this handwritten solar production log table.

The table has columns: Date | Time | M1 | M2
Read each row from top to bottom.

If no valid readings found, return:
{"success": false, "error": "Brief description", "readings": []}

If readings found, return:
{"success": true, "error": null, "readings": [...]}

For each row:
- date: YYYY-MM-DD format (convert "9/17/19" to "2019-09-17")
- time: HH:MM 24-hour format (or null)
- m1: Meter reading in kWh (required, >= 0)
- m2: Second meter in kWh (or null)
- notes: null

Example:
{"success": true, "error": null, "readings": [
  {"date": "2019-09-17", "time": "07:00", "m1": 14388, "m2": 14775, "notes": null}
]}

Return ONLY valid JSON, no other text.
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

        # Generate response using new SDK (async)
        response = await self.client.aio.models.generate_content(
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
            skipped = 0
            for r in readings_data:
                try:
                    # Skip readings with missing required fields
                    if not r.get("date") or r.get("m1") is None:
                        skipped += 1
                        continue

                    reading = ExtractedReading(
                        date=r["date"],
                        time=r.get("time"),
                        m1=float(r["m1"]),
                        m2=float(r["m2"]) if r.get("m2") is not None else None,
                        notes=r.get("notes"),
                    )
                    readings.append(reading)
                except (ValidationError, KeyError, TypeError, ValueError):
                    # Skip invalid readings instead of failing entire batch
                    skipped += 1
                    continue

            # Return success if we got any valid readings
            if readings:
                return ExtractionResult(
                    success=True,
                    readings=readings,
                    error=None,
                )
            else:
                return ExtractionResult(
                    success=False,
                    error=f"Could not extract valid readings ({skipped} invalid entries skipped)",
                    readings=[],
                )

        except json.JSONDecodeError:
            return ExtractionResult(
                success=False,
                error="Failed to parse AI response. The image may not contain recognizable data.",
                readings=[],
            )

    def get_provider_name(self) -> str:
        return "gemini"
