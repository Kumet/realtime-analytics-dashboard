from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, Iterable

import psutil
import redis.asyncio as redis

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.metric import Metric

logger = logging.getLogger(__name__)

REDIS_TTL_SECONDS = 300
POLL_INTERVAL_SECONDS = 1


class PsutilMetricsCollector:
    def __init__(self) -> None:
        self.redis = redis.Redis(
            host=settings.redis_host, port=settings.redis_port, decode_responses=True
        )
        self.samples: dict[datetime, dict[str, list[float]]] = defaultdict(
            lambda: defaultdict(list)
        )
        self._prev_net = None

    async def run(self) -> None:
        logger.info("Starting psutil metrics collector")
        psutil.cpu_percent(interval=None)  # prime CPU measurement
        try:
            while True:
                timestamp = datetime.now(timezone.utc)
                metrics = self._collect_metrics()
                await self._publish(timestamp, metrics)
                self._buffer_samples(timestamp, metrics)
                await self._flush_ready_samples(timestamp)
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            raise
        finally:
            await self._flush_remaining()
            await self.redis.aclose()

    def _collect_metrics(self) -> Dict[str, float]:
        metrics: dict[str, float] = {}
        metrics["cpu"] = psutil.cpu_percent(interval=None)
        metrics["memory"] = psutil.virtual_memory().percent
        metrics["disk"] = psutil.disk_usage("/").percent

        net_counters = psutil.net_io_counters()
        if self._prev_net is None:
            metrics["network"] = 0.0
        else:
            delta_sent = net_counters.bytes_sent - self._prev_net.bytes_sent
            delta_recv = net_counters.bytes_recv - self._prev_net.bytes_recv
            bytes_per_second = (delta_sent + delta_recv) / max(POLL_INTERVAL_SECONDS, 1)
            metrics["network"] = bytes_per_second / (1024 * 1024)  # MB/s
        self._prev_net = net_counters

        return metrics

    async def _publish(self, timestamp: datetime, metrics: Dict[str, float]) -> None:
        for metric_type, value in metrics.items():
            payload = {
                "timestamp": timestamp.isoformat(),
                "value": float(value),
                "type": metric_type,
            }
            message = json.dumps(payload)
            channel = f"metrics:{metric_type}"
            await self.redis.publish(channel, message)
            await self.redis.setex(f"{channel}:latest", REDIS_TTL_SECONDS, message)

    def _buffer_samples(self, timestamp: datetime, metrics: Dict[str, float]) -> None:
        bucket_key = timestamp.replace(second=0, microsecond=0)
        bucket = self.samples[bucket_key]
        for metric_type, value in metrics.items():
            bucket[metric_type].append(value)

    async def _flush_ready_samples(self, timestamp: datetime) -> None:
        cutoff = timestamp.replace(second=0, microsecond=0)
        ready_minutes = [minute for minute in self.samples if minute < cutoff]
        for minute in sorted(ready_minutes):
            metric_samples = self.samples.pop(minute)
            await self._persist_minute(minute, metric_samples)

    async def _flush_remaining(self) -> None:
        for minute in sorted(self.samples):
            metric_samples = self.samples.pop(minute)
            await self._persist_minute(minute, metric_samples)

    async def _persist_minute(
        self, minute: datetime, metric_samples: Dict[str, Iterable[float]]
    ) -> None:
        if not metric_samples:
            return

        records = [
            Metric(type=metric_type, value=self._average(values), ts=minute)
            for metric_type, values in metric_samples.items()
            if values
        ]
        if not records:
            return

        def _persist_sync(items: list[Metric]) -> None:
            with SessionLocal() as session:
                session.add_all(items)
                session.commit()

        await asyncio.to_thread(_persist_sync, records)

    @staticmethod
    def _average(values: Iterable[float]) -> float:
        total = 0.0
        count = 0
        for value in values:
            total += float(value)
            count += 1
        return total / count if count else 0.0


async def publish_dummy_metrics() -> None:
    client = redis.Redis(
        host=settings.redis_host, port=settings.redis_port, decode_responses=True
    )
    logger.info("Starting dummy metric publisher (dev mode)")
    try:
        while True:
            payload = json.dumps(
                {
                    "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                    "value": 50,
                    "type": "cpu",
                }
            )
            await client.publish("metrics:cpu", payload)
            await client.setex("metrics:cpu:latest", REDIS_TTL_SECONDS, payload)
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        raise
    finally:
        await client.aclose()


async def start_generator() -> None:
    source = settings.metrics_source.lower()
    if source == "psutil":
        collector = PsutilMetricsCollector()
        await collector.run()
        return

    if source == "dummy":
        if settings.app_env != "local":
            logger.info(
                "Skipping dummy metrics generation for app_env=%s", settings.app_env
            )
            return
        await publish_dummy_metrics()
        return

    logger.info("Metrics generator disabled (source=%s)", source)
