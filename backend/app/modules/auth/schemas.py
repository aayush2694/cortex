from typing import Literal

from pydantic import BaseModel, Field


class ProvidersOut(BaseModel):
    mode: Literal["dev", "jwt"]
    providers: list[str]


class TokenIn(BaseModel):
    code: str = Field(min_length=1, max_length=200)


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=200)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
