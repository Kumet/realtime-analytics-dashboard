from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi import WebSocket
from fastapi import WebSocketException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

CredentialsError = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def _resolve_user(token: str | None, db: Session) -> User:
    if not token:
        raise CredentialsError

    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except JWTError as exc:
        raise CredentialsError from exc

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise CredentialsError

    user = db.execute(select(User).where(User.email == subject)).scalar_one_or_none()
    if user is None:
        raise CredentialsError
    return user


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    return _resolve_user(token, db)


def get_current_user_from_websocket(websocket: WebSocket, db: Session) -> User:
    token = websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1]

    try:
        return _resolve_user(token, db)
    except HTTPException as exc:
        raise WebSocketException(code=1008, reason=exc.detail)
