from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.metric import Metric
from app.models.user import User
from app.schemas.metrics import MetricSeriesResponse

router = APIRouter()


def _mock_metrics(
    metric_type: str, start_at: datetime, end_at: datetime
) -> MetricSeriesResponse:
    duration = (end_at - start_at).total_seconds() or 1
    steps = max(int(duration), 1)
    interval = max(duration / steps, 1)
    series = []
    current = start_at
    for idx in range(steps + 1):
        series.append(
            {
                "timestamp": current.isoformat().replace("+00:00", "Z"),
                "value": 50 + (idx % 10),
                "type": metric_type,
            }
        )
        current = current + timedelta(seconds=interval)
        if current > end_at:
            break
    return MetricSeriesResponse(series=series)


@router.get("", response_model=MetricSeriesResponse)
async def list_metrics(
    metric_type: Annotated[str, Query(alias="type")] = "cpu",
    from_ts: Annotated[datetime | None, Query(alias="from")] = None,
    to_ts: Annotated[datetime | None, Query(alias="to")] = None,
    _: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
) -> MetricSeriesResponse:
    now = datetime.now(tz=UTC)
    start_at = from_ts or now - timedelta(minutes=5)
    end_at = to_ts or now
    if start_at > end_at:
        start_at = end_at - timedelta(minutes=5)

    statement = (
        select(Metric)
        .where(Metric.type == metric_type)
        .where(Metric.ts >= start_at)
        .where(Metric.ts <= end_at)
        .order_by(Metric.ts)
    )
    records = db.execute(statement).scalars().all()
    if not records:
        return MetricSeriesResponse(series=[])

    series = [
        {
            "timestamp": metric.ts.replace(tzinfo=UTC)
            .isoformat()
            .replace("+00:00", "Z"),
            "value": metric.value,
            "type": metric.type,
        }
        for metric in records
    ]
    return MetricSeriesResponse(series=series)
