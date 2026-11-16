"""The current request's id, readable anywhere while the request runs."""

from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
