"""FastAPI Router의 interface_management 관련 기능을 담당하는 모듈입니다."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ros2_dashboard_monitor.transport.request_parsing import (
    read_json_object,
    read_limited_body,
)
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
    delete_manual_definition,
    delete_uploaded_interface,
    rebuild_uploaded_interfaces_cmake,
    register_manual_type,
    update_manual_definition,
    validate_manual_definition,
    write_manual_definition,
)
from ros2_dashboard_monitor.transport.routers.interface_packages import (
    router as interface_packages_router,
)


router = APIRouter()
router.include_router(interface_packages_router)


@router.post('/ros/interfaces/upload')
async def upload_ros_interface(request: Request) -> dict[str, Any]:
    """업로드된 단일 msg·srv·action 파일을 검사해 Registry에 등록합니다."""
    body = await read_limited_body(
        request,
        payload_limit=MAX_INTERFACE_FILE_SIZE,
        multipart_overhead=64 * 1024,
        too_large_detail='업로드 요청이 너무 큽니다.',
    )
    try:
        file_name, content = extract_multipart_file(
            request.headers.get('content-type', ''), body,
        )
        entry = register_interface(file_name, content)
        if not default_registry_path().is_file():
            raise InterfaceUploadError(
                f'interface_registry.yaml 파일이 생성되지 않았습니다: {default_registry_path()}',
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
            else '부분 적용: 파일 생성 또는 CMake 등록이 완료되지 않았습니다. 상세 상태를 확인하세요.'
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
                f'{result.get("full_type") or file_name} 삭제됨; rebuild 필요',
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


@router.post('/ros/interfaces/manual-type')
async def register_manual_interface_type(request: Request) -> dict[str, Any]:
    """FastAPI Router에서 interface 등록 정보를 저장하는 함수입니다."""
    payload = await read_json_object(request)
    try:
        entry = register_manual_type(
            full_type=str(payload.get('full_type') or ''),
            allowlisted=payload.get('allowlisted', True) is not False,
            description=str(payload.get('description') or ''),
        )
    except InterfaceUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        'success': True,
        'entry': entry,
        'data': entry,
        'message': '기존 빌드 타입 등록이 완료되었습니다. 파일/CMake/package.xml은 수정하지 않았습니다.',
    }


@router.post('/ros/interfaces/manual-definition')
async def write_manual_interface_definition(request: Request) -> dict[str, Any]:
    """사용자가 입력한 Interface 정의를 파일과 Registry에 저장합니다."""
    payload = await read_json_object(request)
    try:
        entry = write_manual_definition(
            package=str(payload.get('package') or 'uploaded_interfaces'),
            kind=str(payload.get('kind') or ''),
            type_name=str(payload.get('type_name') or ''),
            definition=str(payload.get('definition') or ''),
        )
    except InterfaceUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        'success': True,
        'entry': entry,
        'data': entry,
        'message': '인터페이스 직접 작성이 저장되었습니다. 적용하기로 build/import를 진행하세요.',
    }


@router.post('/ros/interfaces/manual-definition/validate')
async def validate_manual_interface_definition(request: Request) -> dict[str, Any]:
    """FastAPI Router에서 입력값을 검증하는 함수입니다."""
    payload = await read_json_object(request)
    try:
        result = validate_manual_definition(
            package=str(payload.get('package') or 'uploaded_interfaces'),
            kind=str(payload.get('kind') or ''),
            type_name=str(payload.get('type_name') or ''),
            definition=str(payload.get('definition') or ''),
        )
    except InterfaceUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        'success': True,
        'data': result,
        'message': '문법 검증을 통과했습니다. 아직 파일/CMake/registry는 수정하지 않았습니다.',
    }


@router.put('/ros/interfaces/manual-definition/{kind}/{type_name}')
async def update_manual_interface_definition(kind: str, type_name: str, request: Request) -> dict[str, Any]:
    """FastAPI Router에서 runtime 상태를 갱신하는 함수입니다."""
    payload = await read_json_object(request)
    try:
        entry = update_manual_definition(
            kind=kind,
            type_name=type_name,
            definition=str(payload.get('definition') or ''),
        )
    except InterfaceUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        'success': True,
        'entry': entry,
        'data': entry,
        'message': '인터페이스 직접 작성 항목을 수정했습니다. 적용하기로 build/import를 다시 진행하세요.',
    }


@router.delete('/ros/interfaces/manual-definition/{kind}/{type_name}')
def delete_manual_interface_definition(kind: str, type_name: str) -> dict[str, Any]:
    """FastAPI Router에서 등록 항목이나 파일을 삭제하는 함수입니다."""
    try:
        result = delete_manual_definition(kind=kind, type_name=type_name)
        mark_interface_change_pending(
            f'{result.get("full_type") or type_name} 삭제됨; rebuild 필요',
        )
    except InterfaceUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        'success': True,
        'data': result,
        'message': '인터페이스 직접 작성 항목을 삭제하고 CMakeLists.txt를 재생성했습니다.',
    }


@router.post('/ros/interfaces/uploaded-interfaces/rebuild-cmake')
def rebuild_uploaded_interfaces_cmake_endpoint() -> dict[str, Any]:
    """현재 업로드 파일을 다시 스캔해 CMakeLists와 package.xml을 재생성합니다."""
    result = rebuild_uploaded_interfaces_cmake()
    mark_interface_change_pending('uploaded_interfaces package metadata 재생성됨; rebuild 필요')
    return {
        'success': True,
        'data': result,
        'message': 'uploaded_interfaces/CMakeLists.txt를 실제 파일 목록 기준으로 재생성했습니다.',
    }
