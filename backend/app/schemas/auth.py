from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    autoLogin: bool | None = None
    type: str | None = "account"


class CurrentUserData(BaseModel):
    name: str
    userid: str
    access: str
    avatar: str | None = None


class CurrentUserResponse(BaseModel):
    success: bool = True
    data: CurrentUserData


class LoginResponse(BaseModel):
    success: bool
    status: str
    type: str = "account"
    currentAuthority: str | None = None
    token: str | None = None
    errorMessage: str | None = None


class RegisterResponse(BaseModel):
    success: bool
    status: str
    currentAuthority: str | None = None
    errorMessage: str | None = None


class BasicSuccessResponse(BaseModel):
    success: bool = True
    data: dict = {}
