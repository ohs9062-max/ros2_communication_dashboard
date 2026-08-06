#!/usr/bin/env python3

"""옵션 없이 Dashboard Backend를 통해 RobotControl failure를 실행한다."""

from __future__ import annotations

import argparse
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ros2_dashboard_demo_nodes.demo_robot_control_outcome_server import (
    FAILURE_SERVICE_NAME,
    TIMEOUT_SERVICE_NAME,
)


SERVICE_TYPE = 'rths_interfaces/srv/RobotControl'


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        'mode',
        choices=('failure', 'timeout'),
        nargs='?',
        default='failure',
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        '--backend-url',
        default='http://127.0.0.1:8000',
    )
    parser.add_argument('--timeout-sec', type=float, default=1.0)
    return parser.parse_args()


def _call_backend(args: argparse.Namespace) -> tuple[int, dict]:
    service_name = (
        FAILURE_SERVICE_NAME
        if args.mode == 'failure'
        else TIMEOUT_SERVICE_NAME
    )
    payload = {
        'service_name': service_name,
        'service_type': SERVICE_TYPE,
        'request': {'cmd': 1},
        'timeout_sec': args.timeout_sec,
    }
    request = Request(
        f'{args.backend_url.rstrip("/")}/ros/interfaces/service-call',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urlopen(request, timeout=max(args.timeout_sec + 3.0, 5.0)) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except HTTPError as exc:
        body = exc.read().decode('utf-8')
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {'detail': body}
        return exc.code, payload
    except URLError as exc:
        return 0, {'detail': f'Backend connection failed: {exc.reason}'}


def main(*, mode: str | None = None) -> None:
    args = _arguments()
    if mode is not None:
        args.mode = mode
    status_code, result = _call_backend(args)
    print(f'HTTP status={status_code}')
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if args.mode == 'failure':
        expected = (
            status_code == 200
            and result.get('success') is False
            and result.get('error_type') == 'response_failed'
        )
    else:
        expected = (
            status_code == 400
            and 'timeout' in str(result.get('detail', '')).lower()
        )

    if not expected:
        raise SystemExit(1)
    print(f'EXPECTED {args.mode.upper()} OBSERVED')


if __name__ == '__main__':
    main()
