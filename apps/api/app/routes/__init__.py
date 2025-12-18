from .settings import router as settings_router
from .readings import router as readings_router
from .upload import router as upload_router
from .stats import router as stats_router
from .export import router as export_router
from .weather import router as weather_router
from .family import router as family_router
from .family_images import router as family_images_router
from .family_stats import router as family_stats_router

__all__ = [
    "settings_router",
    "readings_router",
    "upload_router",
    "stats_router",
    "export_router",
    "weather_router",
    "family_router",
    "family_images_router",
    "family_stats_router",
]
