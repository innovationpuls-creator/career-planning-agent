from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def unique_username(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def get_auth_headers(client: TestClient, role: str = "user") -> dict[str, str]:
    if role == "admin":
        login_response = client.post(
            "/api/login/account",
            json={"username": "admin", "password": "123456", "type": "account"},
        )
    else:
        username = unique_username(role)
        password = "strongpass123"
        register_response = client.post(
            "/api/register",
            json={"username": username, "password": password},
        )
        assert register_response.status_code == 200
        login_response = client.post(
            "/api/login/account",
            json={"username": username, "password": password, "type": "account"},
        )

    assert login_response.status_code == 200
    token = login_response.json()["token"]
    return {"Authorization": f"Bearer {token}"}
