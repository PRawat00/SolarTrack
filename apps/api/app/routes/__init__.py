from .settings import router as settings_router
from .readings import router as readings_router
from .upload import router as upload_router
from .stats import router as stats_router
from .export import router as export_router
from .weather import router as weather_router

__all__ = ["settings_router", "readings_router", "upload_router", "stats_router", "export_router", "weather_router"]
