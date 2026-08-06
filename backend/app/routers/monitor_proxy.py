"""Transparent command/detail proxy from public API to the ROS2 monitor."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.app_state import monitor_client
from app.monitor_client.client import MonitorUnavailable


router = APIRouter()


@router.api_route('/ros/{path:path}', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
async def proxy_monitor(path: str, request: Request) -> Response:
    query = request.url.query
    target = f'/ros/{path}' + (f'?{query}' if query else '')
    body = await request.body()
    try:
        response = await monitor_client.request_async(
            request.method,
            target,
            body=body or None,
            content_type=request.headers.get('content-type'),
        )
    except MonitorUnavailable as exc:
        return JSONResponse(status_code=503, content={'detail': str(exc)})
    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.content_type.split(';', 1)[0],
    )
