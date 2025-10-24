from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Final

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)
CHANNEL: Final[str] = "metrics:cpu"


async def publish_dummy_metrics() -> None:
    client = redis.Redis(
        host=settings.redis_host, port=settings.redis_port, decode_responses=True
    )
    while True:
        payload = json.dumps(
            {
                "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                "value": 50,
                "type": "cpu",
            }
        )
        await client.publish(CHANNEL, payload)
        await asyncio.sleep(1)


async def start_generator() -> None:
    if settings.app_env != "local":
        return
    logger.info("Starting dummy metric publisher (dev mode)")
    await publish_dummy_metrics()
