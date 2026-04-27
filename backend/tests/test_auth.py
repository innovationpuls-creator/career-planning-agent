from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def unique_username(prefix: str) -> str:
    import uuid

    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_register_login_and_current_user_flow():
    username = unique_username("user")
    password = "strongpass123"

    register_response = client.post(
        "/api/register",
        json={"username": username, "password": password},
    )
    assert register_response.status_code == 200
    assert register_response.json()["success"] is True

    login_response = client.post(
        "/api/login/account",
        json={"username": username, "password": password, "type": "account"},
    )
    assert login_response.status_code == 200
    login_payload = login_response.json()
    assert login_payload["success"] is True
    assert login_payload["token"]

    current_user_response = client.get(
        "/api/currentUser",
        headers={"Authorization": f"Bearer {login_payload['token']}"},
    )
    assert current_user_response.status_code == 200
    current_user_payload = current_user_response.json()
    assert current_user_payload["data"]["name"] == username
    assert current_user_payload["data"]["access"] == "user"


def test_duplicate_registration_fails():
    username = unique_username("duplicate")
    payload = {"username": username, "password": "strongpass123"}

    first_response = client.post("/api/register", json=payload)
    second_response = client.post("/api/register", json=payload)

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json()["detail"] == "Username already exists."


def test_login_with_wrong_password_fails():
    username = unique_username("wrongpass")
    client.post("/api/register", json={"username": username, "password": "strongpass123"})

    login_response = client.post(
        "/api/login/account",
        json={"username": username, "password": "not-right-password", "type": "account"},
    )

    assert login_response.status_code == 401
    assert login_response.json()["detail"] == "Incorrect username or password."


def test_current_user_requires_valid_token():
    response = client.get("/api/currentUser")
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing Authorization header."

    invalid_token_response = client.get(
        "/api/currentUser",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert invalid_token_response.status_code == 401
    assert invalid_token_response.json()["detail"] == "Invalid or expired token."


def test_fixed_admin_can_login_and_get_admin_role():
    login_response = client.post(
        "/api/login/account",
        json={"username": "admin", "password": "123456", "type": "account"},
    )

    assert login_response.status_code == 200
    login_payload = login_response.json()
    assert login_payload["success"] is True
    assert login_payload["currentAuthority"] == "admin"
    assert login_payload["token"]

    current_user_response = client.get(
        "/api/currentUser",
        headers={"Authorization": f"Bearer {login_payload['token']}"},
    )
    assert current_user_response.status_code == 200
    assert current_user_response.json()["data"]["access"] == "admin"
