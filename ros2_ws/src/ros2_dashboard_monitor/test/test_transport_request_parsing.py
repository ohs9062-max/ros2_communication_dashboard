"""Monitor FastAPI transport request body parsing 회귀 테스트입니다."""

import asyncio

import pytest
from fastapi import HTTPException

from ros2_dashboard_monitor.transport.request_parsing import (
    read_json_object,
    read_limited_body,
)


class _Request:
    def __init__(self, *, chunks=(), content_length=None, json_value=None, json_error=None):
        self.headers = {}
        if content_length is not None:
            self.headers['content-length'] = str(content_length)
        self._chunks = chunks
        self._json_value = json_value
        self._json_error = json_error

    async def stream(self):
        for chunk in self._chunks:
            yield chunk

    async def json(self):
        if self._json_error is not None:
            raise self._json_error
        return self._json_value


def test_limited_body_returns_stream_bytes_within_limit() -> None:
    body = asyncio.run(read_limited_body(
        _Request(chunks=(b'abc', b'def'), content_length=6),
        payload_limit=4,
        multipart_overhead=2,
        too_large_detail='too large',
    ))

    assert body == b'abcdef'


@pytest.mark.parametrize('incoming_request', [
    _Request(chunks=(b'ignored',), content_length=7),
    _Request(chunks=(b'abcd', b'efg')),
])
def test_limited_body_rejects_header_or_stream_over_limit(incoming_request) -> None:
    with pytest.raises(HTTPException) as caught:
        asyncio.run(read_limited_body(
            incoming_request,
            payload_limit=4,
            multipart_overhead=2,
            too_large_detail='too large',
        ))

    assert caught.value.status_code == 413
    assert caught.value.detail == 'too large'


def test_json_parser_accepts_only_object_payload() -> None:
    payload = asyncio.run(read_json_object(_Request(json_value={'kind': 'msg'})))
    assert payload == {'kind': 'msg'}

    with pytest.raises(HTTPException) as caught:
        asyncio.run(read_json_object(_Request(json_value=[])))
    assert caught.value.status_code == 400
    assert caught.value.detail == 'JSON object 요청 본문이 필요합니다.'


def test_json_parser_maps_decode_failure_to_existing_error() -> None:
    with pytest.raises(HTTPException) as caught:
        asyncio.run(read_json_object(_Request(json_error=ValueError('invalid'))))

    assert caught.value.status_code == 400
    assert caught.value.detail == 'JSON 요청 본문이 필요합니다.'
