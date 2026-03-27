"""
Authentication API endpoints for user registration, login, and profile management.
"""
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBasic, HTTPBasicCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.auth import TokenResponse, UserLogin, UserRegister, UserResponse, UserUpdate
from app.models.database import User
from app.services.auth import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.services.auth import (
    get_current_user as get_user_from_token,
)

router = APIRouter()
security = HTTPBearer(auto_error=False)
basic_security = HTTPBasic(auto_error=False)


async def verify_auth(
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(security),
    basic: Optional[HTTPBasicCredentials] = Depends(basic_security),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """
    Verify authentication for dashboard endpoints.

    Supports multiple authentication methods for backward compatibility:
    1. JWT Bearer token (new multi-tenant system)
    2. HTTP Basic auth (legacy)
    3. X-API-Key header (legacy)

    Returns True if any authentication method succeeds.
    """
    settings = get_settings()

    # Try JWT Bearer token first (new system)
    if bearer and bearer.credentials:
        try:
            await get_user_from_token(bearer.credentials, db)
            return True
        except (JWTError, HTTPException):
            pass  # Try other methods

    # Try HTTP Basic auth (legacy)
    if basic and basic.username and basic.password:
        if settings.auth_username and settings.auth_password:
            if (secrets.compare_digest(basic.username, settings.auth_username) and
                secrets.compare_digest(basic.password, settings.auth_password)):
                return True

    # Try X-API-Key header (legacy dashboard access)
    if x_api_key:
        from app.services import api_keys as api_keys_service
        if api_keys_service.verify_api_key(x_api_key):
            return True

        # Also check env-based keys
        valid_keys = settings.ingest_api_keys_list
        for valid_key in valid_keys:
            if valid_key and secrets.compare_digest(x_api_key, valid_key):
                return True

    # No authentication method succeeded
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency for getting the current authenticated user from JWT token.

    Extracts token from Authorization: Bearer <token> header.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    return await get_user_from_token(token, db)


@router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    """
    Register a new user account.

    Returns JWT token and user information upon successful registration.
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    hashed_password = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        name=user_data.name,
    )

    try:
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create access token
    access_token = create_access_token(data={"sub": str(new_user.id)})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Login with email and password.

    Returns JWT token and user information upon successful authentication.
    """
    # Find user by email
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.

    Requires valid JWT token in Authorization header.
    """
    return UserResponse.model_validate(current_user)


@router.patch("/auth/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update current user's profile information.

    Only updates fields that are provided in the request.
    """
    # Update only provided fields
    if user_update.name is not None:
        current_user.name = user_update.name

    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url

    await db.commit()
    await db.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout endpoint (for token blacklist implementation in future).

    Currently just validates the token. Token blacklisting can be added later.
    """
    # For now, this just validates the token.
    # Token blacklisting should use short-lived tokens (e.g. 15-30 min) combined
    # with refresh tokens. A full Redis-based token blacklist can be added later
    # if immediate revocation is required.
    return None
