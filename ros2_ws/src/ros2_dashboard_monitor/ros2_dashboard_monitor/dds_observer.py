"""Fast DDS helper lifecycle, localhost polling and passive Service QoS model."""

from __future__ import annotations

from copy import deepcopy
import json
import logging
import os
from pathlib import Path
import subprocess
from threading import Event, Lock, Thread
from typing import Any, Callable
from urllib.request import urlopen

from ament_index_python.packages import get_package_prefix

from ros2_dashboard_monitor.monitor_config import FastDdsObserverConfig
from ros2_dashboard_monitor.qos import qos_state


LOGGER = logging.getLogger(__name__)
OBSERVER_PACKAGE = 'ros2_dashboard_dds_observer'
OBSERVER_EXECUTABLE = 'fastdds_qos_observer'
MONITOR_PACKAGE = 'ros2_dashboard_monitor'


class FastDdsQosObserver:
    """Manage the optional helper without creating ROS Service/Action entities."""

    def __init__(
        self,
        config: FastDdsObserverConfig,
        *,
        executable_resolver: Callable[[], Path | None] | None = None,
        snapshot_fetcher: Callable[[str, float], dict[str, Any]] | None = None,
    ) -> None:
        self._config = config
        self._resolve_executable = executable_resolver or observer_executable
        self._fetch_snapshot = snapshot_fetcher or fetch_json
        self._lock = Lock()
        self._stop_event = Event()
        self._thread: Thread | None = None
        self._process: subprocess.Popen | None = None
        self._domain_id: int | None = None
        self._snapshot = unavailable_snapshot('observer_not_started')
        self._server_endpoints_by_service: dict[str, list[dict[str, Any]]] = {}

    def start(self, rmw_identifier: str, domain_id: int) -> None:
        if self._thread and self._thread.is_alive():
            return
        if not self._config.enabled:
            self._set_unavailable('observer_disabled')
            return
        if rmw_identifier != 'rmw_fastrtps_cpp':
            self._set_unavailable('unsupported_rmw')
            return
        executable = self._resolve_executable()
        if executable is None:
            self._set_unavailable('observer_executable_not_found')
            return

        environment = os.environ.copy()
        self._domain_id = int(domain_id)
        environment['ROS_DOMAIN_ID'] = str(self._domain_id)
        environment['ROS2_DDS_QOS_OBSERVER_PORT'] = str(self._config.port)
        try:
            self._process = subprocess.Popen(
                [str(executable)], env=environment,
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except OSError as exc:
            LOGGER.warning('Failed to start Fast DDS QoS observer: %s', exc)
            self._set_unavailable('observer_start_failed')
            return

        self._stop_event.clear()
        self._thread = Thread(target=self._poll, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        process = self._process
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=2.0)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=1.0)
        self._thread = None
        self._process = None
        self._set_unavailable('observer_stopped')

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return deepcopy(self._snapshot)

    def service_qos(self, service_name: str) -> dict[str, Any]:
        with self._lock:
            available = self._snapshot.get('available') is True
            reason = self._snapshot.get('reason')
            endpoints = deepcopy(
                self._server_endpoints_by_service.get(service_name, []),
            )
        if not available:
            return unavailable_service_qos(reason)
        if not endpoints:
            return unavailable_service_qos('service_endpoints_not_discovered')
        public = [public_endpoint(endpoint) for endpoint in endpoints]
        publishers = [item for item in public if item.get('endpoint_kind') == 'writer']
        subscribers = [item for item in public if item.get('endpoint_kind') == 'reader']
        return qos_state(
            status='observed', source='fastdds_discovery', local=None,
            remote=public,
            reason=(
                'Remote Service endpoint QoS was discovered through Fast DDS. '
                'History and Depth are not available through discovery.'
            ),
            publisher_qos=publishers,
            subscriber_qos=subscribers,
            qos_visibility='dds_discovered',
        )

    def _poll(self) -> None:
        url = f'http://127.0.0.1:{self._config.port}/snapshot'
        while not self._stop_event.is_set():
            try:
                snapshot = self._fetch_snapshot(
                    url, self._config.request_timeout_sec,
                )
                if snapshot.get('available') is not True:
                    raise ValueError('observer returned unavailable snapshot')
                if snapshot.get('source') != 'fastdds_discovery':
                    raise ValueError('observer returned unexpected source')
                if snapshot.get('domain_id') != self._domain_id:
                    raise ValueError('observer domain does not match Monitor domain')
                self._replace_snapshot(snapshot)
            except Exception:
                process = self._process
                reason = (
                    'observer_process_exited'
                    if process is not None and process.poll() is not None
                    else 'observer_unreachable'
                )
                self._set_unavailable(reason)
            self._stop_event.wait(self._config.poll_interval_sec)

    def _set_unavailable(self, reason: str | None) -> None:
        self._replace_snapshot(unavailable_snapshot(reason))

    def _replace_snapshot(self, snapshot: dict[str, Any]) -> None:
        endpoints_by_service: dict[str, list[dict[str, Any]]] = {}
        for endpoint in snapshot.get('endpoints', []):
            service_name = endpoint.get('service_name')
            if not service_name or endpoint.get('service_role') != 'server':
                continue
            endpoints_by_service.setdefault(str(service_name), []).append(endpoint)
        with self._lock:
            self._snapshot = snapshot
            self._server_endpoints_by_service = endpoints_by_service


def observer_executable() -> Path | None:
    prefixes: list[Path] = []
    try:
        prefixes.append(Path(get_package_prefix(OBSERVER_PACKAGE)))
    except Exception:
        try:
            monitor_prefix = Path(get_package_prefix(MONITOR_PACKAGE))
        except Exception:
            return None
        # A shell sourced before the optional helper was first built can still
        # locate the Monitor while its AMENT_PREFIX_PATH lacks the new sibling
        # package. Support both isolated and merged colcon install layouts.
        prefixes.extend((monitor_prefix.parent / OBSERVER_PACKAGE, monitor_prefix))

    for prefix in prefixes:
        executable = prefix / 'lib' / OBSERVER_PACKAGE / OBSERVER_EXECUTABLE
        if executable.is_file():
            return executable
    return None


def fetch_json(url: str, timeout: float) -> dict[str, Any]:
    with urlopen(url, timeout=timeout) as response:  # noqa: S310 - loopback URL only
        if response.status != 200:
            raise OSError(f'observer HTTP status {response.status}')
        data = json.load(response)
    if not isinstance(data, dict):
        raise ValueError('observer snapshot is not an object')
    return data


def unavailable_snapshot(reason: str | None) -> dict[str, Any]:
    return {
        'available': False,
        'source': 'fastdds_unavailable',
        'reason': reason or 'observer_unavailable',
        'endpoints': [],
    }


def unavailable_service_qos(reason: str | None = None) -> dict[str, Any]:
    return qos_state(
        status='unknown', source='graph_unavailable', local=None,
        reason='Service endpoint QoS could not be discovered through DDS.',
        qos_visibility='graph_unavailable',
        observer_reason=reason or 'observer_unavailable',
    )


def public_endpoint(endpoint: dict[str, Any]) -> dict[str, Any]:
    return {
        'guid': endpoint.get('guid'),
        'dds_topic': endpoint.get('dds_topic'),
        'dds_type': endpoint.get('dds_type'),
        'service_channel': endpoint.get('service_channel'),
        'endpoint_kind': endpoint.get('endpoint_kind'),
        'service_role': endpoint.get('service_role'),
        'qos': deepcopy(endpoint.get('qos')),
        'qos_source': 'fastdds_discovery',
        'dashboard_owned': False,
    }
