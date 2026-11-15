import base64
import json
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import Settings, validate_auth_settings
from app.modules.auth.tokens import (
    TokenExpired,
    TokenInvalid,
    create_access_token,
    decode_access_token,
    hash_secret,
    new_secret,
    pkce_challenge,
)

SECRET = "s" * 32
NOW = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)


def _b64(data: dict[str, object]) -> str:
    raw = json.dumps(data).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def test_round_trip_returns_user_id() -> None:
    uid = uuid.uuid4()
    token = create_access_token(uid, SECRET, NOW)
    assert decode_access_token(token, SECRET, NOW + timedelta(minutes=1)) == uid


def test_expired_token_raises_token_expired() -> None:
    token = create_access_token(uuid.uuid4(), SECRET, NOW)
    with pytest.raises(TokenExpired) as exc:
        decode_access_token(token, SECRET, NOW + timedelta(minutes=16))
    assert exc.value.status_code == 401
    assert exc.value.code == "token_expired"


def test_tampered_signature_is_invalid() -> None:
    token = create_access_token(uuid.uuid4(), SECRET, NOW)
    head, body, sig = token.split(".")
    bad = f"{head}.{body}.{'A' if sig[0] != 'A' else 'B'}{sig[1:]}"
    with pytest.raises(TokenInvalid) as exc:
        decode_access_token(bad, SECRET, NOW)
    assert exc.value.status_code == 401
    assert exc.value.code == "token_invalid"


def test_other_secret_is_invalid() -> None:
    token = create_access_token(uuid.uuid4(), "o" * 32, NOW)
    with pytest.raises(TokenInvalid):
        decode_access_token(token, SECRET, NOW)


def test_wrong_audience_is_invalid() -> None:
    claims = {
        "sub": str(uuid.uuid4()),
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(minutes=15)).timestamp()),
        "iss": "cortex-api",
        "aud": "someone-else",
    }
    token = jwt.encode(claims, SECRET, algorithm="HS256")
    with pytest.raises(TokenInvalid):
        decode_access_token(token, SECRET, NOW)


def test_alg_none_is_invalid() -> None:
    claims = {
        "sub": str(uuid.uuid4()),
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(minutes=15)).timestamp()),
        "iss": "cortex-api",
        "aud": "cortex-web",
    }
    token = f"{_b64({'alg': 'none', 'typ': 'JWT'})}.{_b64(claims)}."
    with pytest.raises(TokenInvalid):
        decode_access_token(token, SECRET, NOW)


def test_non_uuid_subject_is_invalid() -> None:
    claims = {
        "sub": "not-a-uuid",
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(minutes=15)).timestamp()),
        "iss": "cortex-api",
        "aud": "cortex-web",
    }
    token = jwt.encode(claims, SECRET, algorithm="HS256")
    with pytest.raises(TokenInvalid):
        decode_access_token(token, SECRET, NOW)


def test_garbage_is_invalid() -> None:
    with pytest.raises(TokenInvalid):
        decode_access_token("not.a.jwt", SECRET, NOW)


def test_pkce_challenge_matches_rfc_7636_example() -> None:
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    assert pkce_challenge(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


def test_hash_secret_is_stable_64_hex() -> None:
    h = hash_secret("abc")
    assert h == hash_secret("abc")
    assert len(h) == 64
    assert int(h, 16) >= 0
    assert h != hash_secret("abd")


def test_new_secret_is_random_and_long() -> None:
    a, b = new_secret(), new_secret()
    assert a != b
    assert len(a) >= 43


def test_dev_mode_needs_nothing() -> None:
    validate_auth_settings(Settings(_env_file=None, auth_mode="dev"))


def test_prod_refuses_dev_mode() -> None:
    # An unset AUTH_MODE on the live API would serve one shared user to everyone.
    with pytest.raises(ValueError, match="AUTH_MODE=dev.*ENVIRONMENT=prod"):
        validate_auth_settings(Settings(_env_file=None, environment="prod", auth_mode="dev"))
    with pytest.raises(ValueError, match="AUTH_MODE"):
        validate_auth_settings(Settings(_env_file=None, environment="prod"))  # the default


def test_prod_accepts_jwt_mode() -> None:
    s = Settings(
        _env_file=None,
        environment="prod",
        auth_mode="jwt",
        jwt_secret="x" * 32,
        github_client_id="id",
        github_client_secret="sec",
    )
    validate_auth_settings(s)


def test_jwt_mode_rejects_short_secret() -> None:
    s = Settings(
        _env_file=None,
        auth_mode="jwt",
        jwt_secret="x" * 16,
        github_client_id="id",
        github_client_secret="sec",
    )
    with pytest.raises(ValueError, match="JWT_SECRET"):
        validate_auth_settings(s)


def test_jwt_mode_rejects_missing_secret() -> None:
    s = Settings(_env_file=None, auth_mode="jwt", github_client_id="i", github_client_secret="s")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        validate_auth_settings(s)


def test_jwt_mode_rejects_no_provider() -> None:
    s = Settings(_env_file=None, auth_mode="jwt", jwt_secret="x" * 32, github_client_id="only-id")
    with pytest.raises(ValueError, match="provider"):
        validate_auth_settings(s)


def test_jwt_mode_rejects_empty_frontend_url() -> None:
    s = Settings(
        _env_file=None,
        auth_mode="jwt",
        jwt_secret="x" * 32,
        frontend_url="",
        google_client_id="i",
        google_client_secret="s",
    )
    with pytest.raises(ValueError, match="FRONTEND_URL"):
        validate_auth_settings(s)


def test_jwt_mode_accepts_secret_and_github() -> None:
    s = Settings(
        _env_file=None,
        auth_mode="jwt",
        jwt_secret="x" * 32,
        github_client_id="id",
        github_client_secret="sec",
    )
    validate_auth_settings(s)


def test_invited_emails_comma_string_is_split_and_lowercased() -> None:
    s = Settings(_env_file=None, tutor_invited_emails="a@x.com, B@y.com")  # type: ignore[arg-type]
    assert s.tutor_invited_emails == ["a@x.com", "b@y.com"]


def test_invited_emails_env_comma_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TUTOR_INVITED_EMAILS", "a@x.com, B@y.com,")
    assert Settings(_env_file=None).tutor_invited_emails == ["a@x.com", "b@y.com"]


def test_invited_emails_json_list_works(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TUTOR_INVITED_EMAILS", '["A@x.com"]')
    assert Settings(_env_file=None).tutor_invited_emails == ["a@x.com"]
