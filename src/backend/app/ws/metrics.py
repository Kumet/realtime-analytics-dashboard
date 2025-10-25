from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Annotated

import redis.asyncio as redis
from fastapi import (
    APIRouter,
    Depends,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
)
from fastapi.websockets import WebSocketState
from sqlalchemy.orm import Session

from app.core.config import settings
from app.dependencies.auth import get_current_user_from_websocket
from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


async def subscribe_channel(channel: str) -> AsyncIterator[str]:
    client = redis.Redis(
        host=settings.redis_host, port=settings.redis_port, decode_responses=True
    )
    pubsub = client.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield message["data"]
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await client.aclose()


@router.websocket("/ws/metrics")
async def metrics_ws(
    websocket: WebSocket,
    metric_type: str,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    await websocket.accept()
    try:
        user: User = await get_current_user_from_websocket(websocket, db)
    except WebSocketException as exc:  # pragma: no cover
        await websocket.close(code=exc.code, reason=exc.reason)
        logger.warning("WS auth failed: %s", exc.reason)
        return

    channel = f"metrics:{metric_type}"
    try:
        async for payload in subscribe_channel(channel):
            if websocket.application_state != WebSocketState.CONNECTED:
                break
            await websocket.send_text(payload)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for %s", user.email)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("WebSocket error: %s", exc)
    finally:
        if websocket.application_state == WebSocketState.CONNECTED:
            await websocket.close()
