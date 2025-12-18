from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
import logging

from app.config import settings
from app.routes import (
    settings_router,
    readings_router,
    upload_router,
    stats_router,
    export_router,
    weather_router,
    family_router,
    family_images_router,
    family_stats_router,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
# Disable docs in production for security
is_production = settings.ENVIRONMENT == "production"
app = FastAPI(
    title="SolarLog AI API",
    description="Backend API for SolarLog AI - AI-powered solar log digitization",
    version="0.1.0",
    docs_url=None if is_production else "/docs",
    openapi_url=None if is_production else "/openapi.json",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(settings_router)
app.include_router(readings_router)
app.include_router(upload_router)
app.include_router(stats_router)
app.include_router(export_router)
app.include_router(weather_router)
app.include_router(family_router)
app.include_router(family_images_router)
app.include_router(family_stats_router)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return JSONResponse(
        {
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat(),
            "environment": settings.ENVIRONMENT,
            "ai_provider": settings.DEFAULT_AI_PROVIDER,
        }
    )


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "SolarLog AI API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
