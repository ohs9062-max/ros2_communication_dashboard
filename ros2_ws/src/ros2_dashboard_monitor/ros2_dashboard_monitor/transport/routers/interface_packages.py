"""업로드 ROS2 Interface package 관리용 내부 FastAPI Router입니다."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ros2_dashboard_monitor.interface_lab.management.packages import (
    InterfacePackageError,
    MAX_PACKAGE_ZIP_SIZE,
    delete_interface_package,
    extract_multipart_package_files,
    packages_snapshot,
    upload_interface_package,
    upload_interface_package_folder,
)
from ros2_dashboard_monitor.interface_lab.management.registry import (
    InterfaceUploadError,
    extract_multipart_file,
)
from ros2_dashboard_monitor.transport.request_parsing import read_limited_body


router = APIRouter()


@router.post('/ros/interfaces/packages/upload')
async def upload_ros_interface_package(
    request: Request,
    replace: bool = Query(False),
) -> dict[str, Any]:
    """업로드된 zip을 검증해 Interface package 저장소에 등록합니다."""
    body = await read_limited_body(
        request,
        payload_limit=MAX_PACKAGE_ZIP_SIZE,
        multipart_overhead=64 * 1024,
        too_large_detail='The package upload request is too large.',
    )
    try:
        file_name, content = extract_multipart_file(
            request.headers.get('content-type', ''), body,
        )
        entry = upload_interface_package(file_name, content, replace=replace)
    except InterfacePackageError as exc:
        status_code = 409 if 'already exists' in str(exc) else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except InterfaceUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        'success': True,
        'status': 'uploaded',
        'data': entry,
        'message': 'interface package 업로드가 완료되었습니다. 적용하기로 build/import를 진행하세요.',
    }


@router.post('/ros/interfaces/packages/folder-upload')
async def upload_ros_interface_package_folder(
    request: Request,
    replace: bool = Query(False),
) -> dict[str, Any]:
    """브라우저가 보낸 폴더 파일들을 검증해 Interface package로 등록합니다."""
    body = await read_limited_body(
        request,
        payload_limit=MAX_PACKAGE_ZIP_SIZE,
        multipart_overhead=512 * 1024,
        too_large_detail='The package folder upload request is too large.',
    )
    try:
        files = extract_multipart_package_files(
            request.headers.get('content-type', ''), body,
        )
        entry = upload_interface_package_folder(files, replace=replace)
    except InterfacePackageError as exc:
        status_code = 409 if 'already exists' in str(exc) else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return {
        'success': True,
        'status': 'uploaded',
        'data': entry,
        'message': 'interface package 폴더 업로드가 완료되었습니다. 적용하기로 build/import를 진행하세요.',
    }


@router.get('/ros/interfaces/packages')
def get_interface_packages() -> dict[str, Any]:
    """현재 등록된 Interface package 목록과 적용 상태를 반환합니다."""
    try:
        registry = packages_snapshot()
    except InterfacePackageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {
        'success': True,
        'data': registry['packages'],
        'meta': {'count': len(registry['packages'])},
        'message': '업로드된 interface package 목록을 조회했습니다.',
    }


@router.delete('/ros/interfaces/packages/{package_name}')
def delete_ros_interface_package(package_name: str) -> dict[str, Any]:
    """등록된 업로드 Interface package를 삭제합니다."""
    try:
        result = delete_interface_package(package_name)
    except InterfacePackageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        'success': True,
        'data': result,
        'message': 'interface package를 삭제했습니다. 적용하기로 build 상태를 갱신하세요.',
    }
