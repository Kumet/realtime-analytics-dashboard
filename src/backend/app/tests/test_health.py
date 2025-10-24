from collections.abc import Generator

from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app


class DummySession:
    def execute(self, statement):
        return [1]


def override_get_db() -> Generator[DummySession, None, None]:
    yield DummySession()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_health_endpoint_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def teardown_module() -> None:
    app.dependency_overrides.pop(get_db, None)
