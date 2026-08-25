"""Backend-owned ROS Domain preference and current Monitor runtime status API."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import json

from app.app_state import monitor_cache, monitor_client, user_preferences
from app.user_preferences.repository import UserPreferencesError


router = APIRouter(prefix='/ros/domains')


class DomainIdsRequest(BaseModel):
    domain_ids: list[int]


@router.get('')
def domains() -> dict[str, Any]:
    cache = monitor_cache.snapshot()
    runtime = cache['data'].get('domains') or {}
    active_domain_ids = runtime.get('active_domain_ids') or []
    return {
        'success': True,
        'data': {
            'configured_domain_ids': user_preferences.domain_ids(),
            'active_domain_ids': active_domain_ids,
            'runtime_status': runtime.get('status', 'unavailable'),
            'runtime_domains': runtime.get('domains') or [],
            'multiple_domain_runtime_supported': bool(runtime.get('multiple_domain_runtime_supported')),
        },
        'meta': {
            'monitor_connected': cache['connected'],
            'monitor_error': cache['error'],
        },
    }


@router.put('')
def update_domains(body: DomainIdsRequest) -> dict[str, Any]:
    try:
        result = user_preferences.set_domain_ids(body.domain_ids)
    except UserPreferencesError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        payload = json.dumps(user_preferences.snapshot()).encode('utf-8')
        response = monitor_client.request('PUT', '/transport/priority', body=payload, content_type='application/json')
        if not 200 <= response.status_code < 300:
            raise RuntimeError(f'Monitor HTTP {response.status_code}')
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f'Domain settings were saved but runtime could not be updated: {exc}') from exc
    return {'success': True, 'data': result}


@router.post('/{domain_id}')
def add_domain(domain_id: int) -> dict[str, Any]:
    """Persist one Domain and synchronously start only its missing runtime."""
    return update_domains(DomainIdsRequest(domain_ids=[
        *user_preferences.domain_ids(), domain_id,
    ]))


@router.delete('/{domain_id}')
def remove_domain(domain_id: int) -> dict[str, Any]:
    """Persist removal and synchronously stop only that Domain runtime."""
    return update_domains(DomainIdsRequest(domain_ids=[
        value for value in user_preferences.domain_ids() if value != domain_id
    ]))
