import base64
from threading import Lock
from types import SimpleNamespace

from sensor_msgs.msg import CompressedImage, Image

from ros2_dashboard_monitor.ros2_topic.camera_preview import (
    COMPRESSED_IMAGE_TYPE,
    IMAGE_TYPE,
    build_camera_metadata,
    encode_camera_preview,
)
from ros2_dashboard_monitor.ros2_topic.preview import build_message_preview
from ros2_dashboard_monitor.ros2_topic.query_facade import TopicQueryFacade
from ros2_dashboard_monitor.ros2_topic.snapshot import copy_subscription_snapshots


def _image(encoding: str, data: bytes, *, width: int = 2, height: int = 1) -> Image:
    message = Image()
    message.width = width
    message.height = height
    message.encoding = encoding
    message.step = width * (1 if encoding == 'mono8' else 3)
    message.header.frame_id = 'camera'
    message.header.stamp.sec = 12
    message.header.stamp.nanosec = 34
    message.data = data
    return message


def _encode(topic_type, message):
    return encode_camera_preview(
        topic_type,
        message,
        max_source_bytes=4096,
        max_width=100,
        max_height=100,
    )


def test_raw_camera_metadata_never_contains_binary_array() -> None:
    message = _image('rgb8', bytes((255, 0, 0, 0, 255, 0)))

    preview = build_message_preview(IMAGE_TYPE, message)

    assert preview == {
        'preview_kind': 'image',
        'header': {
            'stamp': {'sec': 12, 'nanosec': 34},
            'frame_id': 'camera',
        },
        'payload_size_bytes': 6,
        'width': 2,
        'height': 1,
        'encoding': 'rgb8',
        'step': 6,
    }
    assert 'data' not in preview


def test_rgb_bgr_and_mono_raw_images_become_png_data_urls() -> None:
    messages = (
        _image('rgb8', bytes((255, 0, 0, 0, 255, 0))),
        _image('bgr8', bytes((0, 0, 255, 0, 255, 0))),
        _image('mono8', bytes((0, 255))),
    )

    for message in messages:
        result = _encode(IMAGE_TYPE, message)
        payload = base64.b64decode(result['data_url'].split(',', 1)[1])
        assert result['status'] == 'ready'
        assert result['mime_type'] == 'image/png'
        assert payload.startswith(b'\x89PNG\r\n\x1a\n')


def test_unsupported_raw_encoding_is_reported_without_raising() -> None:
    message = _image('rgba8', bytes(8))

    result = _encode(IMAGE_TYPE, message)

    assert result['status'] == 'unsupported_encoding'
    assert result['data_url'] is None
    assert 'rgba8' in result['error']


def test_compressed_png_and_jpeg_are_passed_as_browser_data_urls() -> None:
    samples = (
        ('png', b'\x89PNG\r\n\x1a\ncontent', 'image/png'),
        ('jpeg', b'\xff\xd8\xffcontent', 'image/jpeg'),
    )
    for image_format, payload, mime_type in samples:
        message = CompressedImage(format=image_format, data=payload)
        result = _encode(COMPRESSED_IMAGE_TYPE, message)
        assert result['status'] == 'ready'
        assert result['mime_type'] == mime_type
        assert base64.b64decode(result['data_url'].split(',', 1)[1]) == payload


def test_unsupported_compressed_format_is_reported() -> None:
    message = CompressedImage(format='tiff', data=b'not-a-browser-image')

    result = _encode(COMPRESSED_IMAGE_TYPE, message)

    assert result['status'] == 'unsupported_format'
    assert result['data_url'] is None


def test_topic_snapshot_copy_excludes_cached_data_url() -> None:
    snapshots = copy_subscription_snapshots({
        '/camera': {
            'message_preview': {'width': 2},
            'image_preview': {'data_url': 'data:image/png;base64,large'},
            'last_received_at': 1.0,
            'timestamps': [1.0],
            'qos': {},
        },
    })

    assert snapshots['/camera']['message_preview'] == {'width': 2}
    assert 'image_preview' not in snapshots['/camera']


def test_stopping_live_preview_releases_only_cached_binary_frame() -> None:
    facade = TopicQueryFacade.__new__(TopicQueryFacade)
    facade._lock = Lock()
    facade._subscriptions = {
        '/camera': {
            'message_preview': {'width': 2},
            'image_preview_requested_until': 99.0,
            'image_preview': {'data_url': 'data:image/png;base64,large'},
            'image_preview_encoded_at': 98.0,
            'image_preview_frame_received_at': 98.0,
        },
    }

    result = facade.stop_image_preview('/camera')
    entry = facade._subscriptions['/camera']

    assert result['success'] is True
    assert entry['message_preview'] == {'width': 2}
    assert 'image_preview_requested_until' not in entry
    assert 'image_preview' not in entry
    assert 'image_preview_encoded_at' not in entry
    assert 'image_preview_frame_received_at' not in entry


def test_compressed_metadata_contains_header_and_format_only() -> None:
    message = SimpleNamespace(
        format='jpeg; compressed bgr8',
        header=SimpleNamespace(
            stamp=SimpleNamespace(sec=5, nanosec=6),
            frame_id='compressed_camera',
        ),
        data=b'ignored',
    )

    metadata = build_camera_metadata(COMPRESSED_IMAGE_TYPE, message)

    assert metadata['format'] == 'jpeg; compressed bgr8'
    assert metadata['payload_size_bytes'] == 7
    assert metadata['header']['frame_id'] == 'compressed_camera'
    assert 'data' not in metadata
