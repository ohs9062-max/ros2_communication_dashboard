"""Transparent command/detail proxy from public API to the ROS2 monitor."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.app_state import monitor_client
from app.monitor_client.client import MonitorUnavailable


router = APIRouter()


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


@router.get('/ros/{path:path}')
async def proxy_monitor_get(path: str, request: Request) -> Response:
    return await proxy_monitor(path, request)


@router.post('/ros/{path:path}')
async def proxy_monitor_post(path: str, request: Request) -> Response:
    return await proxy_monitor(path, request)


@router.put('/ros/{path:path}')
async def proxy_monitor_put(path: str, request: Request) -> Response:
    return await proxy_monitor(path, request)


@router.delete('/ros/{path:path}')
async def proxy_monitor_delete(path: str, request: Request) -> Response:
    return await proxy_monitor(path, request)


@router.patch('/ros/{path:path}')
async def proxy_monitor_patch(path: str, request: Request) -> Response:
    return await proxy_monitor(path, request)
