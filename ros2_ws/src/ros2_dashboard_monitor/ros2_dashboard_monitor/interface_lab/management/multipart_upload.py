"""Interface upload의 multipart/form-data 파일 payload를 해석합니다."""

from __future__ import annotations

from email.parser import BytesParser
from email.policy import default

from ros2_dashboard_monitor.interface_lab.management.errors import InterfaceUploadError


def extract_multipart_file(content_type: str, body: bytes) -> tuple[str, bytes]:
    if not content_type.lower().startswith('multipart/form-data'):
        raise InterfaceUploadError('A multipart/form-data request is required.')
    message = BytesParser(policy=default).parsebytes(
        b'Content-Type: ' + content_type.encode('ascii', errors='ignore')
        + b'\r\nMIME-Version: 1.0\r\n\r\n' + body,
    )
    if not message.is_multipart():
        raise InterfaceUploadError('The multipart request could not be parsed.')
    for part in message.iter_parts():
        file_name = part.get_filename()
        if file_name:
            return file_name, part.get_payload(decode=True) or b''
    raise InterfaceUploadError('No file was provided for upload.')
