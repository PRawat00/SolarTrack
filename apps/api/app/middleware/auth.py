from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel

from app.config import settings

# Security scheme for Bearer token
security = HTTPBearer()

# Mock user for local development
MOCK_USER_ID = "mock-user-123"
MOCK_USER_EMAIL = "test@localhost.dev"


class TokenData(BaseModel):
    """Data extracted from validated JWT token."""
    user_id: str
    email: str | None = None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """
    Validate Supabase JWT and extract user info.

    Supabase JWTs contain:
    - sub: user UUID
    - email: user email
    - aud: "authenticated"
    - role: "authenticated"

    Usage:
        @app.get("/protected")
        def protected_route(current_user: TokenData = Depends(get_current_user)):
            return {"user_id": current_user.user_id}
    """
    # Mock auth for local development - skip JWT validation
    if settings.MOCK_AUTH:
        return TokenData(
            user_id=MOCK_USER_ID,
            email=MOCK_USER_EMAIL,
        )

    if not settings.SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret not configured",
        )

    token = credentials.credentials

    try:
        # Supabase uses HS256 with JWT secret
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )

        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
            )

        return TokenData(
            user_id=user_id,
            email=payload.get("email"),
        )

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
