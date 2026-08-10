"""Interface Lab manual type/definition HTTP endpoint를 제공합니다."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ros2_dashboard_monitor.interface_lab.apply.runtime import (
    mark_interface_change_pending,
)
from ros2_dashboard_monitor.interface_lab.management.manual_interfaces import (
    delete_manual_definition,
    rebuild_uploaded_interfaces_cmake,
    register_manual_type,
    update_manual_definition,
    validate_manual_definition,
    write_manual_definition,
)
from ros2_dashboard_monitor.interface_lab.management.registry import (
    InterfaceUploadError,
)
from ros2_dashboard_monitor.transport.request_parsing import read_json_object


router = APIRouter()


@router.post('/ros/interfaces/manual-type')
async def register_manual_interface_type(request: Request) -> dict[str, Any]:
    """기존 빌드 ROS interface type을 파일 생성 없이 등록합니다."""
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
    """파일을 변경하지 않고 manual definition 문법을 검증합니다."""
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
async def update_manual_interface_definition(
    kind: str,
    type_name: str,
    request: Request,
) -> dict[str, Any]:
    """등록된 manual definition을 검증 후 갱신합니다."""
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
    """Manual definition 파일과 Registry 항목을 삭제합니다."""
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
    """현재 generated interface 파일 기준으로 package metadata를 재생성합니다."""
    result = rebuild_uploaded_interfaces_cmake()
    mark_interface_change_pending(
        'uploaded_interfaces package metadata 재생성됨; rebuild 필요',
    )
    return {
        'success': True,
        'data': result,
        'message': 'uploaded_interfaces/CMakeLists.txt를 실제 파일 목록 기준으로 재생성했습니다.',
    }
