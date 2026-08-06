"""Cached monitoring REST endpoints and browser WebSocket."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Query

from app.app_state import monitor_cache, monitor_client
from app.monitor_client.client import MonitorUnavailable
from fastapi import HTTPException


router = APIRouter()


def _cached(key: str) -> Any:
    state = monitor_cache.snapshot()
    return state['data'].get(key)


@router.get('/ros/topics')
def topics() -> dict[str, Any]:
    snapshot = _cached('topics') or {'topics': [], 'count': 0, 'last_updated': None}
    return {
        'success': True,
        'data': snapshot.get('topics', []),
        'meta': {'count': snapshot.get('count', 0), 'last_updated': snapshot.get('last_updated')},
        'message': 'ROS2 topics fetched successfully',
    }


@router.get('/ros/services')
def services(include_hidden: bool = Query(False)) -> dict[str, Any] | None:
    if include_hidden:
        try:
            response = monitor_client.request('GET', '/ros/services?include_hidden=true')
        except MonitorUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return json.loads(response.content)
    snapshot = _cached('services') or {'services': [], 'meta': {}}
    return {'success': True, 'data': {'services': snapshot['services'], 'meta': snapshot['meta']}}


@router.get('/ros/actions')
def actions() -> dict[str, Any]:
    snapshot = _cached('actions') or {'actions': [], 'meta': {}}
    return {'success': True, 'data': {'actions': snapshot['actions'], 'meta': snapshot['meta']}}


@router.get('/ros/nodes')
def nodes() -> dict[str, Any]:
    snapshot = _cached('nodes') or {'nodes': [], 'meta': {}}
    return {'success': True, 'data': {'nodes': snapshot['nodes'], 'meta': snapshot['meta']}}
