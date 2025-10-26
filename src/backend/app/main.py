from __future__ import annotations

import asyncio
import logging

from contextlib import asynccontextmanager, suppress

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import api_router
from app.core.config import settings
from app.services.generator import start_generator
from app.db.seed import seed_initial_data
from app.db.session import SessionLocal, get_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        with SessionLocal() as session:
            seed_initial_data(session)
    except Exception as exc:  # pragma: no cover - best effort seeding
        logger.warning("Skipping database seed during startup: %s", exc)

    generator_task: asyncio.Task | None = None
    if settings.app_env == "local":
        generator_task = asyncio.create_task(start_generator())

    try:
        yield
    finally:
        if generator_task:
            generator_task.cancel()
            with suppress(asyncio.CancelledError):
                await generator_task


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        ) from exc
    return {"status": "ok"}


app.include_router(api_router)
