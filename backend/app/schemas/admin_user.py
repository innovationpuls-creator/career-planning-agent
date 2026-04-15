from datetime import datetime

from pydantic import BaseModel, Field


class AdminUserItem(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    avatar: str | None = None
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    success: bool = True
    data: list[AdminUserItem]
    total: int


class AdminUserDetailResponse(BaseModel):
    success: bool = True
    data: AdminUserItem


class AdminUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    display_name: str | None = Field(default=None, max_length=100)
    role: str = Field(default="user")
    is_active: bool = Field(default=True)


class AdminUserCreateResponse(BaseModel):
    success: bool = True
    data: AdminUserItem


class AdminUserUpdateRequest(BaseModel):
    role: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)
    display_name: str | None = Field(default=None)


class AdminUserUpdateResponse(BaseModel):
    success: bool = True
    data: AdminUserItem


class AdminProfileResponse(BaseModel):
    success: bool = True
    data: AdminUserItem


class AdminProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None)
    avatar: str | None = Field(default=None)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class AdminProfileUpdateResponse(BaseModel):
    success: bool = True
    data: AdminUserItem
