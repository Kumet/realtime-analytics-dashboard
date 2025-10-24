from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "adminpass"


def seed_admin_user(session: Session) -> None:
    """Ensure the default admin user exists."""
    admin = session.execute(
        select(User).where(User.email == ADMIN_EMAIL)
    ).scalar_one_or_none()
    if admin:
        return

    admin_user = User(
        email=ADMIN_EMAIL,
        password_hash=get_password_hash(ADMIN_PASSWORD),
        role=UserRole.ADMIN,
    )
    session.add(admin_user)
    session.commit()
    logger.info("Seeded default admin user (%s)", ADMIN_EMAIL)


def seed_initial_data(session: Session) -> None:
    """Seed initial data required for the application."""
    seed_admin_user(session)
