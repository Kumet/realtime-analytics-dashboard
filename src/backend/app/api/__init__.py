from fastapi import APIRouter

from app.api import auth, metrics
from app.ws import metrics as ws_metrics

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
api_router.include_router(ws_metrics.router, tags=["ws"])
