"""Bounded Camera Topic metadata and browser preview conversion."""

from __future__ import annotations

import base64
import struct
import zlib
from typing import Any


IMAGE_TYPE = 'sensor_msgs/msg/Image'
COMPRESSED_IMAGE_TYPE = 'sensor_msgs/msg/CompressedImage'
CAMERA_TOPIC_TYPES = (IMAGE_TYPE, COMPRESSED_IMAGE_TYPE)
SUPPORTED_RAW_ENCODINGS = ('rgb8', 'bgr8', 'mono8')


def is_camera_topic_type(topic_type: str | None) -> bool:
    return topic_type in CAMERA_TOPIC_TYPES


def build_camera_metadata(topic_type: str, message: Any) -> dict[str, Any]:
    """Return small metadata only; binary image data never enters snapshots."""
    preview = {
        'preview_kind': 'image',
        'header': _header_metadata(getattr(message, 'header', None)),
    }
    if topic_type == IMAGE_TYPE:
        preview.update({
            'width': _integer(getattr(message, 'width', 0)),
            'height': _integer(getattr(message, 'height', 0)),
            'encoding': str(getattr(message, 'encoding', '') or ''),
            'step': _integer(getattr(message, 'step', 0)),
        })
    else:
        preview['format'] = str(getattr(message, 'format', '') or '')
    return preview


def encode_camera_preview(
    topic_type: str,
    message: Any,
    *,
    max_source_bytes: int,
    max_width: int,
    max_height: int,
) -> dict[str, Any]:
    """Convert one requested frame to a bounded browser data URL."""
    try:
        if topic_type == IMAGE_TYPE:
            return _encode_raw_image(
                message,
                max_source_bytes=max_source_bytes,
                max_width=max_width,
                max_height=max_height,
            )
        if topic_type == COMPRESSED_IMAGE_TYPE:
            return _encode_compressed_image(
                message,
                max_source_bytes=max_source_bytes,
            )
    except (BufferError, TypeError, ValueError, zlib.error) as exc:
        return _error_preview('decode_error', str(exc))
    return _error_preview('unsupported_type', 'Camera Topic type is not supported')


def _encode_raw_image(
    message: Any,
    *,
    max_source_bytes: int,
    max_width: int,
    max_height: int,
) -> dict[str, Any]:
    width = _integer(getattr(message, 'width', 0))
    height = _integer(getattr(message, 'height', 0))
    step = _integer(getattr(message, 'step', 0))
    encoding = str(getattr(message, 'encoding', '') or '').lower()
    if encoding not in SUPPORTED_RAW_ENCODINGS:
        return _error_preview(
            'unsupported_encoding',
            f'이미지 미리보기 미지원 encoding: {encoding or "unknown"}',
        )
    if width <= 0 or height <= 0 or width > max_width or height > max_height:
        return _error_preview(
            'size_limit',
            f'Image dimensions exceed preview limit ({max_width}x{max_height})',
        )

    channels = 1 if encoding == 'mono8' else 3
    row_bytes = width * channels
    if step < row_bytes:
        return _error_preview('invalid_data', 'Image step is smaller than one pixel row')
    expected_bytes = step * height
    if expected_bytes > max_source_bytes:
        return _error_preview(
            'size_limit',
            f'Image payload exceeds preview limit ({max_source_bytes} bytes)',
        )

    source = _byte_view(getattr(message, 'data', b''))
    if len(source) < expected_bytes:
        return _error_preview('invalid_data', 'Image payload is shorter than height * step')

    rows = bytearray()
    for row_index in range(height):
        row = source[row_index * step:row_index * step + row_bytes]
        rows.append(0)
        if encoding == 'bgr8':
            for offset in range(0, row_bytes, 3):
                rows.extend((row[offset + 2], row[offset + 1], row[offset]))
        else:
            rows.extend(row)

    color_type = 0 if encoding == 'mono8' else 2
    png = _png_bytes(width, height, color_type, bytes(rows))
    return _success_preview('image/png', png)


def _encode_compressed_image(
    message: Any,
    *,
    max_source_bytes: int,
) -> dict[str, Any]:
    source = _byte_view(getattr(message, 'data', b''))
    if not source:
        return _error_preview('invalid_data', 'Compressed image payload is empty')
    if len(source) > max_source_bytes:
        return _error_preview(
            'size_limit',
            f'Compressed image exceeds preview limit ({max_source_bytes} bytes)',
        )

    image_format = str(getattr(message, 'format', '') or '').lower()
    if ('jpeg' in image_format or 'jpg' in image_format) and bytes(source[:3]) == b'\xff\xd8\xff':
        return _success_preview('image/jpeg', bytes(source))
    if 'png' in image_format and bytes(source[:8]) == b'\x89PNG\r\n\x1a\n':
        return _success_preview('image/png', bytes(source))
    return _error_preview(
        'unsupported_format',
        f'이미지 미리보기 미지원 format: {image_format or "unknown"}',
    )


def _png_bytes(width: int, height: int, color_type: int, rows: bytes) -> bytes:
    signature = b'\x89PNG\r\n\x1a\n'
    header = struct.pack('>IIBBBBB', width, height, 8, color_type, 0, 0, 0)
    return signature + _png_chunk(b'IHDR', header) + _png_chunk(
        b'IDAT', zlib.compress(rows, level=3),
    ) + _png_chunk(b'IEND', b'')


def _png_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    checksum = zlib.crc32(chunk_type)
    checksum = zlib.crc32(payload, checksum) & 0xffffffff
    return struct.pack('>I', len(payload)) + chunk_type + payload + struct.pack('>I', checksum)


def _success_preview(mime_type: str, payload: bytes) -> dict[str, Any]:
    encoded = base64.b64encode(payload).decode('ascii')
    return {
        'status': 'ready',
        'mime_type': mime_type,
        'size_bytes': len(payload),
        'data_url': f'data:{mime_type};base64,{encoded}',
        'error': None,
    }


def _error_preview(status: str, message: str) -> dict[str, Any]:
    return {
        'status': status,
        'mime_type': None,
        'size_bytes': 0,
        'data_url': None,
        'error': message,
    }


def _byte_view(value: Any) -> memoryview:
    try:
        return memoryview(value).cast('B')
    except (TypeError, ValueError):
        return memoryview(bytes(value))


def _header_metadata(header: Any) -> dict[str, Any]:
    stamp = getattr(header, 'stamp', None)
    return {
        'stamp': {
            'sec': _integer(getattr(stamp, 'sec', 0)),
            'nanosec': _integer(getattr(stamp, 'nanosec', 0)),
        },
        'frame_id': str(getattr(header, 'frame_id', '') or ''),
    }


def _integer(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0
