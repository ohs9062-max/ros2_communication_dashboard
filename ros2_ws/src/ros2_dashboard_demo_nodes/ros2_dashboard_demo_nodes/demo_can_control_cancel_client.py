#!/usr/bin/env python3

"""옵션 없이 CanControl Goal 취소 demo를 실행한다."""

from ros2_dashboard_demo_nodes.demo_can_control_outcome_client import main


if __name__ == '__main__':
    main(mode='cancel')
