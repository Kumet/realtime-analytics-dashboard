from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.schemas.auth import LoginRequest, Token

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(payload: LoginRequest) -> Token:
    if payload.email != settings.demo_user_email or not verify_password(
        payload.password, settings.demo_user_hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    access_token = create_access_token(subject=payload.email)
    return Token(access_token=access_token, token_type="bearer")
