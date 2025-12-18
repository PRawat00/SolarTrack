"""
File storage service for family images.
Stores images on the local filesystem.
"""

import os
import aiofiles
from pathlib import Path
from typing import Optional
from app.config import settings


class FileStorageService:
    """Service for storing and retrieving family images on the filesystem."""

    BASE_PATH = Path(settings.FAMILY_DATA_PATH if hasattr(settings, 'FAMILY_DATA_PATH') else "/data/families")

    @classmethod
    def get_family_images_path(cls, family_id: str) -> Path:
        """Get the path to a family's images directory."""
        return cls.BASE_PATH / family_id / "images"

    @classmethod
    async def save_image(
        cls,
        family_id: str,
        image_id: str,
        filename: str,
        data: bytes
    ) -> str:
        """
        Save image to filesystem.

        Args:
            family_id: The family's ID
            image_id: The image record's ID
            filename: Original filename
            data: Image bytes

        Returns:
            Relative storage path from BASE_PATH
        """
        dir_path = cls.get_family_images_path(family_id)
        dir_path.mkdir(parents=True, exist_ok=True)

        # Sanitize filename and prepend image_id
        safe_filename = f"{image_id}_{filename}"
        file_path = dir_path / safe_filename

        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(data)

        # Return relative path from BASE_PATH
        return str(file_path.relative_to(cls.BASE_PATH))

    @classmethod
    async def read_image(cls, storage_path: str) -> bytes:
        """
        Read image from filesystem.

        Args:
            storage_path: Relative path from BASE_PATH

        Returns:
            Image bytes

        Raises:
            FileNotFoundError: If image doesn't exist
        """
        full_path = cls.BASE_PATH / storage_path
        if not full_path.exists():
            raise FileNotFoundError(f"Image not found: {storage_path}")

        async with aiofiles.open(full_path, 'rb') as f:
            return await f.read()

    @classmethod
    async def delete_image(cls, storage_path: str) -> bool:
        """
        Delete image from filesystem.

        Args:
            storage_path: Relative path from BASE_PATH

        Returns:
            True if deleted, False if didn't exist
        """
        full_path = cls.BASE_PATH / storage_path
        if full_path.exists():
            os.remove(full_path)
            return True
        return False

    @classmethod
    def get_absolute_path(cls, storage_path: str) -> Path:
        """Get the absolute filesystem path for a storage path."""
        return cls.BASE_PATH / storage_path

    @classmethod
    def ensure_base_path(cls) -> None:
        """Ensure the base storage directory exists."""
        cls.BASE_PATH.mkdir(parents=True, exist_ok=True)
