"""업로드 Interface package archive와 폴더 입력의 안전 검증."""

from __future__ import annotations

import shutil
import stat
import zipfile
from email.parser import BytesParser
from email.policy import default
from pathlib import Path, PurePosixPath

from ros2_dashboard_monitor.interface_lab.management.errors import InterfacePackageError


MAX_PACKAGE_ZIP_SIZE = 8 * 1024 * 1024
MAX_PACKAGE_FILES = 200
MAX_PACKAGE_FILE_SIZE = 512 * 1024


def validate_zip_upload(file_name: str, content: bytes) -> str:
    safe_name = PurePosixPath(file_name.replace('\\', '/')).name
    if not safe_name.lower().endswith('.zip'):
        raise InterfacePackageError('zip 파일만 업로드할 수 있습니다.')
    if not content:
        raise InterfacePackageError('빈 zip 파일은 업로드할 수 없습니다.')
    if len(content) > MAX_PACKAGE_ZIP_SIZE:
        raise InterfacePackageError(
            f'패키지 zip 크기는 {MAX_PACKAGE_ZIP_SIZE // (1024 * 1024)}MB 이하여야 합니다.',
        )
    return safe_name


def extract_multipart_package_files(content_type: str, body: bytes) -> list[tuple[str, bytes]]:
    if not content_type.lower().startswith('multipart/form-data'):
        raise InterfacePackageError('multipart/form-data 요청이 필요합니다.')
    message = BytesParser(policy=default).parsebytes(
        b'Content-Type: ' + content_type.encode('ascii', errors='ignore')
        + b'\r\nMIME-Version: 1.0\r\n\r\n' + body,
    )
    if not message.is_multipart():
        raise InterfacePackageError('multipart 요청 형식을 읽을 수 없습니다.')
    files: list[tuple[str, bytes]] = []
    relative_paths: list[str] = []
    for part in message.iter_parts():
        name = part.get_param('name', header='content-disposition')
        payload = part.get_payload(decode=True) or b''
        if name == 'relative_path':
            relative_paths.append(payload.decode('utf-8', errors='ignore'))
        elif name == 'files' and part.get_filename():
            fallback = part.get_filename() or ''
            relative_path = part.get_param('filename', header='content-disposition') or fallback
            files.append((relative_path, payload))
    if relative_paths and len(relative_paths) == len(files):
        files = [(relative_paths[index], content) for index, (_, content) in enumerate(files)]
    if not files:
        raise InterfacePackageError('업로드할 package 폴더 파일이 없습니다.')
    return files


def validate_folder_upload(files: list[tuple[str, bytes]]) -> None:
    if len(files) > MAX_PACKAGE_FILES:
        raise InterfacePackageError(f'파일은 최대 {MAX_PACKAGE_FILES}개까지 허용합니다.')
    if sum(len(content) for _, content in files) > MAX_PACKAGE_ZIP_SIZE:
        raise InterfacePackageError(
            f'패키지 폴더 총 크기는 {MAX_PACKAGE_ZIP_SIZE // (1024 * 1024)}MB 이하여야 합니다.',
        )


def safe_extract_zip(zip_path: Path, destination: Path) -> None:
    with zipfile.ZipFile(zip_path) as archive:
        infos = [info for info in archive.infolist() if not info.is_dir()]
        if len(infos) > MAX_PACKAGE_FILES:
            raise InterfacePackageError(f'파일은 최대 {MAX_PACKAGE_FILES}개까지 허용합니다.')
        for info in infos:
            relative = safe_zip_member(info)
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as source, target.open('wb') as output:
                shutil.copyfileobj(source, output)


def safe_zip_member(info: zipfile.ZipInfo) -> PurePosixPath:
    if stat.S_ISLNK(info.external_attr >> 16):
        raise InterfacePackageError(f'symlink는 허용하지 않습니다: {info.filename}')
    return safe_package_relative_path(info.filename, info.file_size)


def safe_package_relative_path(relative_path: str, file_size: int) -> PurePosixPath:
    path = PurePosixPath(relative_path.replace('\\', '/'))
    if path.is_absolute() or '..' in path.parts or '\x00' in relative_path:
        raise InterfacePackageError(f'허용되지 않는 package 경로입니다: {relative_path}')
    if any(part in {'build', 'install', 'log', '.git', '__pycache__'} for part in path.parts):
        raise InterfacePackageError(f'생성물/내부 폴더는 업로드할 수 없습니다: {relative_path}')
    if file_size > MAX_PACKAGE_FILE_SIZE:
        raise InterfacePackageError(f'파일이 너무 큽니다: {relative_path}')
    name = path.name
    allowed = (
        name in {'package.xml', 'CMakeLists.txt'}
        or name.lower().startswith(('readme', 'license'))
        or (
            len(path.parts) >= 2
            and path.parts[-2] in {'msg', 'srv', 'action'}
            and path.suffix in {'.msg', '.srv', '.action'}
        )
    )
    if not allowed:
        raise InterfacePackageError(f'허용되지 않는 파일입니다: {relative_path}')
    return path


def find_package_root(extract_root: Path) -> Path:
    if (extract_root / 'package.xml').is_file():
        return extract_root
    children = [path for path in extract_root.iterdir() if path.is_dir()]
    if len(children) == 1 and (children[0] / 'package.xml').is_file():
        return children[0]
    raise InterfacePackageError('zip 내부에 package.xml을 포함한 최상위 패키지 폴더가 필요합니다.')
