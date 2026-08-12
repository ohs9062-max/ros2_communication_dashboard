"""Synthetic Image and CompressedImage publisher for Dashboard validation."""

from __future__ import annotations

import struct
import zlib

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import CompressedImage, Image


WIDTH = 320
HEIGHT = 180
FRAME_ID = 'demo_camera_frame'
PUBLISH_PERIOD_SEC = 1.0


class DemoCameraPublisher(Node):
    def __init__(self) -> None:
        super().__init__('demo_camera_publisher')
        self._raw_publisher = self.create_publisher(
            Image, '/demo_camera/image_raw', 10,
        )
        self._compressed_publisher = self.create_publisher(
            CompressedImage, '/demo_camera/image_compressed', 10,
        )
        self._rgb = build_test_pattern(WIDTH, HEIGHT)
        self._png = encode_rgb_png(WIDTH, HEIGHT, self._rgb)
        self._timer = self.create_timer(PUBLISH_PERIOD_SEC, self._publish)

    def _publish(self) -> None:
        stamp = self.get_clock().now().to_msg()

        raw = Image()
        raw.header.stamp = stamp
        raw.header.frame_id = FRAME_ID
        raw.height = HEIGHT
        raw.width = WIDTH
        raw.encoding = 'rgb8'
        raw.is_bigendian = 0
        raw.step = WIDTH * 3
        raw.data = self._rgb
        self._raw_publisher.publish(raw)

        compressed = CompressedImage()
        compressed.header.stamp = stamp
        compressed.header.frame_id = FRAME_ID
        compressed.format = 'png'
        compressed.data = self._png
        self._compressed_publisher.publish(compressed)


def build_test_pattern(width: int, height: int) -> bytes:
    """Create deterministic RGB bars with a small gradient."""
    pixels = bytearray(width * height * 3)
    colors = (
        (239, 68, 68),
        (245, 158, 11),
        (34, 197, 94),
        (14, 165, 233),
        (99, 102, 241),
        (168, 85, 247),
    )
    band_width = max(1, width // len(colors))
    for y in range(height):
        brightness = 0.65 + 0.35 * y / max(1, height - 1)
        for x in range(width):
            red, green, blue = colors[min(x // band_width, len(colors) - 1)]
            offset = (y * width + x) * 3
            pixels[offset:offset + 3] = (
                int(red * brightness),
                int(green * brightness),
                int(blue * brightness),
            )
    return bytes(pixels)


def encode_rgb_png(width: int, height: int, rgb: bytes) -> bytes:
    rows = b''.join(
        b'\x00' + rgb[y * width * 3:(y + 1) * width * 3]
        for y in range(height)
    )
    header = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    return (
        b'\x89PNG\r\n\x1a\n'
        + _png_chunk(b'IHDR', header)
        + _png_chunk(b'IDAT', zlib.compress(rows, level=6))
        + _png_chunk(b'IEND', b'')
    )


def _png_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    checksum = zlib.crc32(chunk_type)
    checksum = zlib.crc32(payload, checksum) & 0xffffffff
    return struct.pack('>I', len(payload)) + chunk_type + payload + struct.pack('>I', checksum)


def main(args=None) -> None:
    rclpy.init(args=args)
    node = DemoCameraPublisher()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()
