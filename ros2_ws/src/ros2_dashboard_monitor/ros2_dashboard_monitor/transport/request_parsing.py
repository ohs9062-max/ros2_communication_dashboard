"""Monitor 내부 FastAPI transport의 제한된 body와 JSON object 파싱 helper입니다."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request


async def read_limited_body(
    request: Request,
    *,
    payload_limit: int,
    multipart_overhead: int,
    too_large_detail: str,
) -> bytes:
    """Header와 실제 stream 모두에서 업로드 요청 크기 상한을 적용합니다."""
    request_limit = payload_limit + multipart_overhead
    content_length = request.headers.get('content-length')
    if content_length:
        try:
            request_size = int(content_length)
        except ValueError:
            request_size = 0
        if request_size > request_limit:
            raise HTTPException(status_code=413, detail=too_large_detail)

    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > request_limit:
            raise HTTPException(status_code=413, detail=too_large_detail)
    return bytes(body)


async def read_json_object(request: Request) -> dict[str, Any]:
    """요청 JSON을 읽고 object가 아니면 기존 400 응답으로 거부합니다."""
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail='JSON 요청 본문이 필요합니다.',
        ) from exc
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=400,
            detail='JSON object 요청 본문이 필요합니다.',
        )
    return payload
