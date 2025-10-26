from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, WebSocket, WebSocketException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
logger = logging.getLogger(__name__)

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
        logger.warning("WS auth: JWT decode failed error=%s", exc)
        raise CredentialsError from exc

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        logger.info("WS auth: invalid subject sub=%s", subject)
        raise CredentialsError

    user = db.execute(select(User).where(User.email == subject)).scalar_one_or_none()
    if user is None:
        logger.info("WS auth: user not found email=%s", subject)
        raise CredentialsError
    return user


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    return _resolve_user(token, db)


async def get_current_user_from_websocket(
    websocket: WebSocket,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    token = websocket.query_params.get("token")

    if not token:
        try:
            message = await websocket.receive_json()
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.info("WS auth: failed to receive auth payload %s", exc)
            raise WebSocketException(code=1008, reason="Missing auth token") from exc

        if not isinstance(message, dict):
            logger.info("WS auth: unexpected payload type=%s", type(message))
            raise WebSocketException(code=1008, reason="Missing auth token")

        token_value = message.get("token")
        if not isinstance(token_value, str) or not token_value:
            logger.info(
                "WS auth: token missing in payload keys=%s", list(message.keys())
            )
            raise WebSocketException(code=1008, reason="Missing auth token")

        token = token_value

    try:
        return _resolve_user(token, db)
    except HTTPException as exc:
        raise WebSocketException(code=1008, reason=exc.detail) from exc
