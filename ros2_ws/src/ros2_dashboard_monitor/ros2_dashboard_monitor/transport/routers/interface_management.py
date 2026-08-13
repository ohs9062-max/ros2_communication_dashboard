"""FastAPI Router의 interface_management 관련 기능을 담당하는 모듈입니다."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ros2_dashboard_monitor.transport.request_parsing import read_limited_body
from ros2_dashboard_monitor.interface_lab.apply.runtime import mark_interface_change_pending
from ros2_dashboard_monitor.interface_lab.management.registry import (
    InterfaceUploadError,
    MAX_INTERFACE_FILE_SIZE,
    default_registry_path,
    delete_registry_entry,
    extract_multipart_file,
    register_interface,
    registry_snapshot,
)
from ros2_dashboard_monitor.interface_lab.management.manual_interfaces import (
    delete_uploaded_interface,
)
from ros2_dashboard_monitor.transport.routers.interface_manual import (
    router as interface_manual_router,
)
from ros2_dashboard_monitor.transport.routers.interface_packages import (
    router as interface_packages_router,
)


router = APIRouter()
router.include_router(interface_packages_router)
router.include_router(interface_manual_router)


@router.post('/ros/interfaces/upload')
async def upload_ros_interface(request: Request) -> dict[str, Any]:
    """업로드된 단일 msg·srv·action 파일을 검사해 Registry에 등록합니다."""
    body = await read_limited_body(
        request,
        payload_limit=MAX_INTERFACE_FILE_SIZE,
        multipart_overhead=64 * 1024,
        too_large_detail='The upload request is too large.',
    )
    try:
        file_name, content = extract_multipart_file(
            request.headers.get('content-type', ''), body,
        )
        entry = register_interface(file_name, content)
        if not default_registry_path().is_file():
            raise InterfaceUploadError(
                f'interface_registry.yaml was not created: {default_registry_path()}',
            )
    except InterfaceUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    build = entry.get('build', {})
    file_ready = (
        build.get('file_saved')
        and build.get('cmake_registered')
        and build.get('package_xml_checked')
    )
    return {
        'success': bool(file_ready),
        'status': 'uploaded' if file_ready else 'partial',
        'data': entry,
        'registry_path': entry.get('registry_path'),
        'saved_path': build.get('saved_path'),
        'message': (
            'YAML 저장, interface 파일 생성, CMake 등록, package.xml 확인이 완료되었습니다.'
            if file_ready
            else 'Partial apply: file creation or CMake registration did not complete. Check the detailed status.'
        ),
    }


@router.get('/ros/interfaces/registry')
def get_interface_registry() -> dict[str, Any]:
    """현재 단일 Interface Registry와 적용 상태를 반환합니다."""
    try:
        registry = registry_snapshot()
    except InterfaceUploadError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {
        'success': True,
        'data': registry['interface_registry'],
        'message': '등록된 인터페이스 타입을 조회했습니다.',
    }


@router.delete('/ros/interfaces/registry/{kind}/{file_name}')
def delete_interface_registry_entry(
    kind: str,
    file_name: str,
    source: str | None = Query(default=None),
    full_type: str | None = Query(default=None),
) -> dict[str, Any]:
    """FastAPI Router에서 등록 항목이나 파일을 삭제하는 함수입니다."""
    try:
        collection_name = {'msg': 'messages', 'srv': 'services', 'action': 'actions'}.get(kind)
        items = registry_snapshot()['interface_registry'].get(collection_name, [])
        selected = next((
            item for item in items
            if item.get('file_name') == file_name
            and (source is None or item.get('source') == source)
            and (full_type is None or item.get('full_type') == full_type)
        ), None)
        package_name = str(
            (selected or {}).get('build', {}).get('interface_package')
            or str((selected or {}).get('full_type', '')).split('/', 1)[0]
        )
        if package_name == 'uploaded_interfaces':
            result = delete_uploaded_interface(
                kind=kind, file_name=file_name, source=source, full_type=full_type,
            )
            mark_interface_change_pending(
                f'{result.get("full_type") or file_name} was deleted. A rebuild is required.',
            )
        else:
            result = delete_registry_entry(
                kind=kind,
                file_name=file_name,
                source=source,
                full_type=full_type,
            )
    except InterfaceUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        'success': True,
        'data': result,
        'message': result['message'],
    }
