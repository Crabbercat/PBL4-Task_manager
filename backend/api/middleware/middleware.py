import json
import logging
from pathlib import Path
from time import perf_counter
from typing import Optional, Tuple
from urllib.parse import parse_qs

from fastapi import Request
from jose import JWTError, jwt

from ...core.config import settings


ACTIVITY_HEADER = "| USER            | ACTION                 | TARGET                            | STATUS | CHANGES                          | NOTES"
SENSITIVE_FIELDS = {"password", "new_password", "current_password", "confirm_password", "hashed_password"}


def _ensure_table_header(file_name: str):
    path = Path(file_name)
    if not path.exists() or path.stat().st_size == 0:
        path.write_text(ACTIVITY_HEADER + '\n', encoding='utf-8')


def _configure_logger(name: str, file_name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.FileHandler(file_name)
        handler.setLevel(logging.INFO)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        _ensure_table_header(file_name)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger


request_logger = _configure_logger('app.request', 'info.log')
activity_logger = _configure_logger('app.activity', 'activity.log')
logger = request_logger


def _resolve_username(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith('bearer '):
        return 'anonymous'
    token = authorization.split(' ', 1)[1].strip()
    if not token:
        return 'anonymous'
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return 'invalid-token'
    return payload.get('sub') or f"user-{payload.get('user_id', 'unknown')}"


async def logging_middleware(request: Request, call_next):
    start_time = perf_counter()
    username = _resolve_username(request.headers.get('Authorization'))
    request_logger.info(
        "Incoming request: %s %s | user=%s", request.method, request.url.path, username
    )

    body_bytes, parsed_body = await _capture_body(request)
    cloned_request = _clone_request_with_body(request, body_bytes)
    response = None
    status_code = None
    try:
        response = await call_next(cloned_request)
        status_code = response.status_code
    except Exception:
        status_code = status_code or 500
        request_logger.exception(
            "Unhandled exception during %s %s", request.method, request.url.path
        )
        query_string = str(request.query_params) or '-'
        client_host = request.client.host if request.client else 'unknown'
        action, target, changes = _describe_action(request.method, request.url.path, parsed_body)
        notes = f"query={query_string} | ip={client_host}"
        activity_logger.exception(
            _format_activity_line(username, action, target, status_code, changes, notes)
        )
        raise
    finally:
        duration_ms = (perf_counter() - start_time) * 1000
        query_string = str(request.query_params) or '-'
        client_host = request.client.host if request.client else 'unknown'
        if status_code is not None:
            request_logger.info(
                "Outgoing response code: %s %s -> %s in %.2fms",
                request.method,
                request.url.path,
                status_code,
                duration_ms,
            )
            action, target, changes = _describe_action(request.method, request.url.path, parsed_body)
            if action.startswith('viewed'):
                return response
            notes = f"query={query_string} | ip={client_host} | duration={duration_ms:.2f}ms"
            activity_logger.info(
                _format_activity_line(username, action, target, status_code, changes, notes)
            )
    return response


def _ensure_table_header(file_name: str):
    path = Path(file_name)
    if not path.exists() or path.stat().st_size == 0:
        path.write_text(ACTIVITY_HEADER + '\n', encoding='utf-8')


def _format_activity_line(user: str, action: str, target: str, status: int, changes: str, notes: str) -> str:
    return (
        f"| {user[:15]:<15} | {action[:22]:<22} | {target[:32]:<32} | "
        f"{str(status)[:6]:<6} | {changes[:30]:<30} | {notes}"
    )


async def _capture_body(request: Request) -> Tuple[bytes, Optional[dict]]:
    body_bytes = await request.body()
    parsed_body = _parse_body(request.headers.get('content-type'), body_bytes)
    return body_bytes, parsed_body


def _parse_body(content_type: Optional[str], body_bytes: bytes) -> Optional[dict]:
    if not body_bytes:
        return None
    try:
        body_text = body_bytes.decode('utf-8')
    except UnicodeDecodeError:
        return None

    if content_type and 'application/json' in content_type:
        try:
            data = json.loads(body_text)
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None

    if content_type and 'application/x-www-form-urlencoded' in content_type:
        data = parse_qs(body_text)
        flattened = {k: v[0] if len(v) == 1 else v for k, v in data.items()}
        return flattened

    return None


def _clone_request_with_body(request: Request, body: bytes) -> Request:
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(request.scope, receive)


def _describe_action(method: str, path: str, body: Optional[dict]) -> Tuple[str, str, str]:
    method = method.upper()
    action = {
        'GET': 'viewed',
        'POST': 'created',
        'PUT': 'updated',
        'PATCH': 'patched',
        'DELETE': 'deleted'
    }.get(method, method.lower())
    target = path
    changes = '-'

    if path.startswith('/api/v1/tasks'):
        action, target, changes = _describe_task_action(method, path, body)
    elif path.startswith('/api/v1/projects'):
        action, target, changes = _describe_project_action(method, path, body)
    elif path.startswith('/api/v1/users') or path.startswith('/api/v1/me'):
        action, target, changes = _describe_user_action(method, path, body)
    elif path.startswith('/api/v1/teams'):
        action, target, changes = _describe_team_action(method, path, body)
    elif path.startswith('/api/v1/login'):
        username = body.get('username') if isinstance(body, dict) else '-'
        action = 'attempted login'
        target = 'auth/login'
        changes = f"username={username}"
    elif path.startswith('/api/v1/register'):
        username = body.get('username') if isinstance(body, dict) else '-'
        action = 'registered account'
        target = 'auth/register'
        changes = f"username={username}"
    else:
        target = path
        changes = _summarize_changes(body)

    return action, target, changes


def _describe_task_action(method: str, path: str, body: Optional[dict]) -> Tuple[str, str, str]:
    if method == 'POST' and isinstance(body, dict):
        title = body.get('title', 'task')
        if body.get('is_personal'):
            action = 'created personal task'
            target = f"personal:{title}"
        else:
            project_id = body.get('project_id', '-')
            action = 'created project task'
            target = f"project:{project_id}"
        changes = _summarize_changes(body, preferred_keys=['title', 'status', 'priority', 'assignee_id'])
        return action, target, changes

    if method in {'PUT', 'PATCH'} and isinstance(body, dict):
        action = 'updated task'
        target = path
        changes = _summarize_changes(body)
        return action, target, changes

    if method == 'DELETE':
        return 'deleted task', path, '-'

    action = 'viewed tasks' if method == 'GET' else method.lower() + ' tasks'
    return action, path, '-'


def _describe_project_action(method: str, path: str, body: Optional[dict]) -> Tuple[str, str, str]:
    if method == 'POST' and isinstance(body, dict):
        return 'created project', body.get('name', 'project'), _summarize_changes(body, preferred_keys=['name', 'color'])
    if method in {'PUT', 'PATCH'} and isinstance(body, dict):
        return 'updated project', path, _summarize_changes(body)
    if method == 'DELETE':
        return 'deleted project', path, '-'
    return 'viewed projects', path, '-'


def _describe_user_action(method: str, path: str, body: Optional[dict]) -> Tuple[str, str, str]:
    if method in {'PUT', 'PATCH'} and isinstance(body, dict):
        return 'updated profile', path, _summarize_changes(body)
    return 'viewed profile', path, '-'


def _describe_team_action(method: str, path: str, body: Optional[dict]) -> Tuple[str, str, str]:
    if method == 'POST' and isinstance(body, dict):
        return 'created team', body.get('name', 'team'), _summarize_changes(body, preferred_keys=['name'])
    if method in {'PUT', 'PATCH'} and isinstance(body, dict):
        return 'updated team', path, _summarize_changes(body)
    if method == 'DELETE':
        return 'deleted team', path, '-'
    return 'viewed teams', path, '-'


def _summarize_changes(data: Optional[dict], preferred_keys: Optional[list] = None) -> str:
    if not isinstance(data, dict):
        return '-'
    keys = preferred_keys or list(data.keys())
    entries = []
    for key in keys:
        if key in data and key not in SENSITIVE_FIELDS:
            value = data[key]
            entries.append(f"{key}={_shorten(value)}")
    if not entries:
        for key, value in list(data.items())[:5]:
            if key in SENSITIVE_FIELDS:
                continue
            entries.append(f"{key}={_shorten(value)}")
    return ', '.join(entries) if entries else '-'


def _shorten(value) -> str:
    text = str(value)
    return text if len(text) <= 20 else text[:19] + '…'
