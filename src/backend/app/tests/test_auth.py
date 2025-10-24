from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.security import get_password_hash
from app.models.user import User, UserRole


def create_user(db_session) -> User:
    user = User(
        email="admin@example.com",
        password_hash=get_password_hash("adminpass"),
        role=UserRole.ADMIN,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_login_returns_token(client: TestClient, db_session) -> None:
    create_user(db_session)

    response = client.post(
        "/auth/login",
        json={"email": "admin@example.com", "password": "adminpass"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data


def test_login_rejects_invalid_credentials(client: TestClient, db_session) -> None:
    create_user(db_session)

    response = client.post(
        "/auth/login",
        json={"email": "admin@example.com", "password": "wrong"},
    )

    assert response.status_code == 401


def test_metrics_requires_authentication(client: TestClient) -> None:
    response = client.get("/metrics")
    assert response.status_code == 401


def test_metrics_returns_data_with_token(client: TestClient, db_session) -> None:
    create_user(db_session)
    login_response = client.post(
        "/auth/login",
        json={"email": "admin@example.com", "password": "adminpass"},
    )
    token = login_response.json()["access_token"]

    response = client.get("/metrics", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    payload = response.json()
    assert "series" in payload
    assert payload["series"]
