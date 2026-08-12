"""ROS2 Dashboard Backend의 main 관련 기능을 담당하는 모듈입니다."""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

from ros2_dashboard_monitor.transport.state import backend_config, priority_state, ros_monitor
from pydantic import BaseModel
from ros2_dashboard_monitor.interface_lab.apply.runtime import apply_status
from ros2_dashboard_monitor.transport.routers import (
    action_execution,
    interface_apply,
    interface_management,
    monitoring,
    service_execution,
    topic_execution,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI가 시작될 때 ROS 모니터를 켜고 종료될 때 안전하게 정리합니다."""
    ros_monitor.start()
    try:
        yield
    finally:
        ros_monitor.stop()


app = FastAPI(lifespan=lifespan)

app.include_router(monitoring.router)
app.include_router(interface_management.router)
app.include_router(interface_apply.router)
app.include_router(topic_execution.router)
app.include_router(service_execution.router)
app.include_router(action_execution.router)


class PriorityPayload(BaseModel):
    priority: dict[str, list[str]]


@app.put('/transport/priority')
def update_priority(payload: PriorityPayload) -> dict[str, Any]:
    priority_state.replace(payload.priority)
    return {'success': True}


@app.get('/health')
def health() -> dict[str, Any]:
    """Backend와 ROS 모니터의 현재 연결 상태를 반환합니다."""
    return {
        'success': True,
        'data': {
            'status': 'running',
        },
        'message': 'Backend is running',
    }


@app.get('/transport/snapshot')
def transport_snapshot() -> dict[str, Any]:
    """Return one coherent payload for the backend runtime cache."""
    topics = ros_monitor.snapshot()
    services = ros_monitor.service_snapshot(include_hidden=False)
    actions = ros_monitor.action_snapshot()
    nodes = ros_monitor.node_snapshot()
    alerts = ros_monitor.alerts(
        action_snapshot=actions,
        node_snapshot=nodes,
        service_snapshot=services,
        topic_snapshot=topics,
    )
    return {
        'success': True,
        'data': {
            'topics': topics,
            'services': services,
            'actions': actions,
            'nodes': nodes,
            'alerts': alerts,
            'websocket': ros_monitor.websocket_snapshot(
                topic_snapshot=topics,
                service_snapshot=services,
                action_snapshot=actions,
                node_snapshot=nodes,
                alerts=alerts,
            ),
            'interface_apply': apply_status(),
        },
    }
