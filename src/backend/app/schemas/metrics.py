from typing import List, TypedDict

from pydantic import BaseModel, Field


class MetricPoint(TypedDict):
    timestamp: str
    value: float
    type: str


class MetricSeriesResponse(BaseModel):
    series: List[MetricPoint] = Field(default_factory=list)
