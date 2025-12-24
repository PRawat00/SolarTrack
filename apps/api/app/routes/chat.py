"""
Chat endpoint for natural language queries on solar data.

Allows users to ask questions about their solar production data
and get responses with optional visualizations.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any

from app.middleware.auth import get_current_user, TokenData
from app.models.base import get_db
from app.models.models import ApiUsage
from app.routes.family import get_readings_user_id
from app.services.chat_service import ChatService, ChatResponse, ChartConfig
from app.config import settings

from datetime import datetime, date
import uuid

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    """Request body for chat query."""
    message: str


class ChatAPIResponse(BaseModel):
    """Response body for chat query."""
    answer: str
    data: list[dict[str, Any]]
    chart: ChartConfig | None = None
    sql: str | None = None
    error: str | None = None


def check_rate_limit(db: Session, user_id: str) -> tuple[bool, int]:
    """
    Check if user has exceeded daily rate limit.

    Returns (is_allowed, remaining_requests).
    """
    today = date.today()

    # Find or create today's usage record
    usage = db.query(ApiUsage).filter(
        ApiUsage.user_id == user_id,
        ApiUsage.provider == "gemini",
        ApiUsage.usage_date == today,
    ).first()

    if not usage:
        return True, settings.GEMINI_DAILY_LIMIT

    remaining = settings.GEMINI_DAILY_LIMIT - usage.request_count
    return remaining > 0, max(0, remaining)


def increment_usage(db: Session, user_id: str):
    """Increment API usage counter for today."""
    today = date.today()

    usage = db.query(ApiUsage).filter(
        ApiUsage.user_id == user_id,
        ApiUsage.provider == "gemini",
        ApiUsage.usage_date == today,
    ).first()

    if usage:
        usage.request_count += 1
    else:
        usage = ApiUsage(
            id=uuid.uuid4().hex,
            user_id=user_id,
            provider="gemini",
            usage_date=today,
            request_count=1,
        )
        db.add(usage)

    db.commit()


@router.post("/chat", response_model=ChatAPIResponse)
async def chat_query(
    request: ChatRequest,
    current_user: TokenData = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Process a natural language query about solar data.

    The query is converted to SQL, executed, and results are returned
    with an appropriate chart configuration.

    Rate limited to GEMINI_DAILY_LIMIT requests per day.
    """
    # Check rate limit
    is_allowed, remaining = check_rate_limit(db, current_user.user_id)
    if not is_allowed:
        raise HTTPException(
            status_code=429,
            detail="Daily API limit reached. Try again tomorrow."
        )

    # Validate message
    message = request.message.strip()
    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )

    if len(message) > 500:
        raise HTTPException(
            status_code=400,
            detail="Message too long (max 500 characters)"
        )

    # Get effective user ID (family head if in a family)
    effective_user_id = get_readings_user_id(db, current_user.user_id)

    try:
        # Initialize chat service
        chat_service = ChatService()

        # Process query
        response = await chat_service.query(
            question=message,
            user_id=effective_user_id,
            db_session=db,
        )

        # Increment usage counter (counts as 2 requests: SQL + chart config)
        increment_usage(db, current_user.user_id)
        increment_usage(db, current_user.user_id)

        return ChatAPIResponse(
            answer=response.answer,
            data=response.data,
            chart=response.chart,
            sql=response.sql if settings.ENVIRONMENT == "development" else None,
            error=response.error,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Configuration error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process query: {str(e)}"
        )


@router.get("/chat/suggestions")
async def get_suggestions(
    current_user: TokenData = Depends(get_current_user),
):
    """
    Get suggested queries for the chat interface.

    Returns a list of example questions users can ask.
    """
    return {
        "suggestions": [
            {"label": "This month", "query": "What was my total production this month?"},
            {"label": "Last 7 days", "query": "Show me production for the last 7 days"},
            {"label": "Best day", "query": "What was my best production day?"},
            {"label": "vs Weather", "query": "How does sunshine affect my production?"},
            {"label": "Goal progress", "query": "Am I on track for my yearly goal?"},
            {"label": "Monthly comparison", "query": "Compare this month to last month"},
        ]
    }
