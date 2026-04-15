from __future__ import annotations

import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def unique_username(prefix: str = "user") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def get_admin_headers() -> dict[str, str]:
    resp = client.post(
        "/api/login/account",
        json={"username": "admin", "password": "123456", "type": "account"},
    )
    assert resp.status_code == 200
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def get_admin_user_id() -> int:
    resp = client.post(
        "/api/login/account",
        json={"username": "admin", "password": "123456", "type": "account"},
    )
    assert resp.status_code == 200
    token = resp.json()["token"]
    profile_resp = client.get("/api/admin/profile", headers={"Authorization": f"Bearer {token}"})
    assert profile_resp.status_code == 200
    return profile_resp.json()["data"]["id"]


def get_user_headers() -> tuple[dict[str, str], str]:
    username = unique_username("user")
    password = "strongpass123"
    client.post("/api/register", json={"username": username, "password": password})
    resp = client.post(
        "/api/login/account",
        json={"username": username, "password": password, "type": "account"},
    )
    assert resp.status_code == 200
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}, username


# ─── List ─────────────────────────────────────────────────────────────────────

def test_list_users_returns_success_and_data_array():
    resp = client.get("/api/admin/users", headers=get_admin_headers())
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    assert isinstance(payload["data"], list)
    assert "total" in payload


def test_list_users_pagination_respects_page_and_page_size():
    resp = client.get(
        "/api/admin/users", params={"page": 1, "page_size": 5}, headers=get_admin_headers()
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    assert len(payload["data"]) <= 5
    assert payload["total"] >= 0


def test_list_users_username_filter_uses_contains():
    # create a user with a unique username
    username = unique_username("filtertest")
    client.post("/api/register", json={"username": username, "password": "strongpass123"})
    resp = client.get(
        "/api/admin/users", params={"username": username[:8]}, headers=get_admin_headers()
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    # at least the created user should be in the result
    usernames = [u["username"] for u in payload["data"]]
    assert any(username[:8] in u for u in usernames)


def test_list_users_role_filter():
    resp = client.get("/api/admin/users", params={"role": "admin"}, headers=get_admin_headers())
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    for user in payload["data"]:
        assert user["role"] == "admin"


def test_list_users_is_active_filter():
    resp = client.get(
        "/api/admin/users", params={"is_active": True}, headers=get_admin_headers()
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    for user in payload["data"]:
        assert user["is_active"] is True


# ─── Create ───────────────────────────────────────────────────────────────────

def test_create_user_successfully():
    username = unique_username("newuser")
    resp = client.post(
        "/api/admin/users",
        json={
            "username": username,
            "password": "pass123456",
            "display_name": "Test User",
            "role": "user",
            "is_active": True,
        },
        headers=get_admin_headers(),
    )
    assert resp.status_code == 201
    payload = resp.json()
    assert payload["success"] is True
    assert payload["data"]["username"] == username
    assert payload["data"]["display_name"] == "Test User"
    assert payload["data"]["role"] == "user"
    assert payload["data"]["is_active"] is True


def test_create_user_returns_409_on_duplicate_username():
    username = unique_username("duplicate")
    client.post("/api/register", json={"username": username, "password": "strongpass123"})
    resp = client.post(
        "/api/admin/users",
        json={"username": username, "password": "pass123456"},
        headers=get_admin_headers(),
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "Username already exists"


def test_create_user_returns_400_on_invalid_role():
    username = unique_username("invalidrole")
    resp = client.post(
        "/api/admin/users",
        json={"username": username, "password": "pass123456", "role": "superadmin"},
        headers=get_admin_headers(),
    )
    assert resp.status_code == 400
    assert "Invalid role" in resp.json()["detail"]


# ─── Detail ───────────────────────────────────────────────────────────────────

def test_get_user_returns_user_item():
    # use the admin user id
    admin_id = get_admin_user_id()
    resp = client.get(f"/api/admin/users/{admin_id}", headers=get_admin_headers())
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    user = payload["data"]
    assert "username" in user
    assert "role" in user
    assert "is_active" in user


def test_get_user_returns_404_for_nonexistent():
    resp = client.get("/api/admin/users/99999999", headers=get_admin_headers())
    assert resp.status_code == 404
    assert resp.json()["detail"] == "User not found"


# ─── Update ────────────────────────────────────────────────────────────────────

def _find_user_id_by_username(username: str) -> int:
    """Find a user's id by searching via the admin list endpoint."""
    resp = client.get(
        "/api/admin/users", params={"username": username}, headers=get_admin_headers()
    )
    assert resp.status_code == 200
    users = resp.json()["data"]
    matching = [u for u in users if u["username"] == username]
    assert len(matching) >= 1, f"User {username} not found in list"
    return matching[0]["id"]


def test_update_user_display_name():
    username = unique_username("updatetest")
    client.post("/api/register", json={"username": username, "password": "strongpass123"})
    user_id = _find_user_id_by_username(username)

    resp = client.patch(
        f"/api/admin/users/{user_id}",
        json={"display_name": "Updated Name"},
        headers=get_admin_headers(),
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    assert payload["data"]["display_name"] == "Updated Name"


def test_update_user_role():
    username = unique_username("roletest")
    client.post("/api/register", json={"username": username, "password": "strongpass123"})
    user_id = _find_user_id_by_username(username)

    resp = client.patch(
        f"/api/admin/users/{user_id}",
        json={"role": "admin"},
        headers=get_admin_headers(),
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["data"]["role"] == "admin"


def test_update_user_invalid_role():
    username = unique_username("invalidroletest")
    client.post("/api/register", json={"username": username, "password": "strongpass123"})
    user_id = _find_user_id_by_username(username)

    resp = client.patch(
        f"/api/admin/users/{user_id}",
        json={"role": "invalid"},
        headers=get_admin_headers(),
    )
    assert resp.status_code == 400
    assert "Invalid role" in resp.json()["detail"]


# ─── Delete ───────────────────────────────────────────────────────────────────

def test_delete_user_successfully():
    username = unique_username("deletetest")
    client.post("/api/register", json={"username": username, "password": "strongpass123"})
    user_id = _find_user_id_by_username(username)

    resp = client.delete(f"/api/admin/users/{user_id}", headers=get_admin_headers())
    assert resp.status_code == 204

    # verify user is gone
    get_resp = client.get(f"/api/admin/users/{user_id}", headers=get_admin_headers())
    assert get_resp.status_code == 404


def test_delete_user_prevents_self_deletion():
    admin_id = get_admin_user_id()
    resp = client.delete(f"/api/admin/users/{admin_id}", headers=get_admin_headers())
    assert resp.status_code == 400
    assert "Cannot delete yourself" in resp.json()["detail"]


# ─── Admin Profile ─────────────────────────────────────────────────────────────

def test_get_admin_profile():
    resp = client.get("/api/admin/profile", headers=get_admin_headers())
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["success"] is True
    user = payload["data"]
    assert user["username"] == "admin"


def test_update_admin_profile_display_name():
    original_resp = client.get("/api/admin/profile", headers=get_admin_headers())
    original_name = original_resp.json()["data"]["display_name"]
    new_name = f"Admin-{uuid.uuid4().hex[:6]}"
    resp = client.patch(
        "/api/admin/profile", json={"display_name": new_name}, headers=get_admin_headers()
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["display_name"] == new_name
    # restore
    client.patch(
        "/api/admin/profile", json={"display_name": original_name}, headers=get_admin_headers()
    )


def test_update_admin_profile_password():
    resp = client.patch(
        "/api/admin/profile",
        json={"password": "new-password-123"},
        headers=get_admin_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    # restore original password
    client.patch(
        "/api/admin/profile",
        json={"password": "123456"},
        headers=get_admin_headers(),
    )


def test_update_admin_profile_avatar():
    original_resp = client.get("/api/admin/profile", headers=get_admin_headers())
    original_avatar = original_resp.json()["data"].get("avatar")
    new_avatar = "https://example.com/new-avatar.png"
    resp = client.patch(
        "/api/admin/profile", json={"avatar": new_avatar}, headers=get_admin_headers()
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["avatar"] == new_avatar
    # restore
    client.patch(
        "/api/admin/profile",
        json={"avatar": original_avatar} if original_avatar else {"avatar": None},
        headers=get_admin_headers(),
    )


# ─── Auth Guard ───────────────────────────────────────────────────────────────

def test_list_users_without_auth_returns_401_or_403():
    resp = client.get("/api/admin/users")
    assert resp.status_code in (401, 403)


def test_list_users_non_admin_returns_403():
    headers, _ = get_user_headers()
    resp = client.get("/api/admin/users", headers=headers)
    assert resp.status_code == 403


def test_create_user_without_auth_returns_401_or_403():
    resp = client.post(
        "/api/admin/users",
        json={"username": "x", "password": "x"},
    )
    assert resp.status_code in (401, 403)


def test_create_user_non_admin_returns_403():
    headers, _ = get_user_headers()
    resp = client.post(
        "/api/admin/users",
        json={"username": "x", "password": "x"},
        headers=headers,
    )
    assert resp.status_code == 403


def test_get_profile_without_auth_returns_401_or_403():
    resp = client.get("/api/admin/profile")
    assert resp.status_code in (401, 403)


def test_update_profile_without_auth_returns_401_or_403():
    resp = client.patch("/api/admin/profile", json={"display_name": "x"})
    assert resp.status_code in (401, 403)
