"""Interface management 하위 Router 분리 후 공개 경로 계약 테스트입니다."""

from ros2_dashboard_monitor.transport.api import app


def _routes(container):
    for route in container.routes:
        if hasattr(route, 'path'):
            yield route
        nested = getattr(route, 'original_router', None)
        if nested is not None:
            yield from _routes(nested)


def test_interface_management_router_includes_package_routes_once() -> None:
    routes = [
        (route.path, tuple(sorted(getattr(route, 'methods', None) or ())))
        for route in _routes(app)
    ]
    expected = {
        ('/ros/interfaces/packages/upload', ('POST',)),
        ('/ros/interfaces/packages/folder-upload', ('POST',)),
        ('/ros/interfaces/packages', ('GET',)),
        ('/ros/interfaces/packages/{package_name}', ('DELETE',)),
    }

    assert expected.issubset(set(routes))
    for route in expected:
        assert routes.count(route) == 1


def test_interface_management_router_keeps_registry_and_manual_routes() -> None:
    paths = {
        route.path for route in _routes(app)
    }

    assert '/ros/interfaces/upload' in paths
    assert '/ros/interfaces/registry' in paths
    assert '/ros/interfaces/manual-type' in paths
    assert '/ros/interfaces/manual-definition' in paths
    assert '/ros/interfaces/manual-definition/validate' in paths
    assert '/ros/interfaces/manual-definition/{kind}/{type_name}' in paths


def test_camera_preview_keeps_a_separate_topic_detail_route() -> None:
    paths = {route.path for route in _routes(app)}

    assert '/ros/topics/image-preview' in paths
