"""Token primitives for sign-in: access JWTs, random secrets, hashing and PKCE. No I/O."""

import base64
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta

import jwt

from app.core.errors import AppError

ISSUER = "cortex-api"
AUDIENCE = "cortex-web"
ACCESS_TOKEN_MINUTES = 15


class TokenExpired(AppError):
    status_code = 401
    code = "token_expired"


class TokenInvalid(AppError):
    status_code = 401
    code = "token_invalid"


def create_access_token(user_id: uuid.UUID, secret: str, now: datetime) -> str:
    claims = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_MINUTES)).timestamp()),
        "iss": ISSUER,
        "aud": AUDIENCE,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def decode_access_token(token: str, secret: str, now: datetime) -> uuid.UUID:
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={
                "require": ["exp", "iat", "sub", "iss", "aud"],
                "verify_exp": False,
                "verify_iat": False,
            },
        )
        # Compare exp with the caller's clock ourselves, so tests control time.
        if int(claims["exp"]) <= int(now.timestamp()):
            raise TokenExpired("Access token has expired")
        return uuid.UUID(claims["sub"])
    except TokenExpired:
        raise
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise TokenInvalid("Access token is not valid") from exc


def new_secret() -> str:
    return secrets.token_urlsafe(32)


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
