"""Logging setup and a middleware that gives every request an ID and logs its outcome.

Request logs carry the method, path (never the query string), status, duration, request id
and, when known, the user id. They never include headers, cookies, tokens, emails or bodies.
"""

import logging
import re
import time
import uuid

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.errors import INTERNAL_ERROR_MESSAGE, error_body
from app.core.request_context import request_id_var

__all__ = ["RequestContextMiddleware", "request_id_var", "setup_logging"]


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def setup_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s")
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


access_log = logging.getLogger("cortex.access")
REQUEST_ID = re.compile(r"[A-Za-z0-9-]{1,64}")  # a client's id is kept only if it looks like this


def _log_request(
    request: Request, status: int, start: float, request_id: str, crashed: bool = False
) -> None:
    if status >= 500:
        level = logging.ERROR
    elif status >= 400:
        level = logging.WARNING
    else:
        level = logging.INFO
    extra = ""
    user_id = getattr(request.state, "user_id", None)
    if user_id is not None:
        extra += f" user={user_id}"
    limit = getattr(request.state, "rate_limit", None)
    if limit is not None:
        extra += f" limit={limit}"
    access_log.log(
        level,
        "%s %s -> %s (%.1f ms) [%s]%s",
        request.method,
        request.url.path,
        status,
        (time.perf_counter() - start) * 1000,
        request_id,
        extra,
        exc_info=crashed,  # the traceback, for crashes only
    )


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        sent = request.headers.get("x-request-id", "")
        request_id = sent if REQUEST_ID.fullmatch(sent) else uuid.uuid4().hex[:16]
        token = request_id_var.set(request_id)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            # Log the crash once here, while the request id is set, and answer with the usual
            # envelope. Nothing re-raises it, so the server does not log it a second time.
            _log_request(request, 500, start, request_id, crashed=True)
            response = JSONResponse(
                error_body("internal_error", INTERNAL_ERROR_MESSAGE), status_code=500
            )
        else:
            _log_request(request, response.status_code, start, request_id)
        finally:
            request_id_var.reset(token)
        response.headers["x-request-id"] = request_id
        return response
