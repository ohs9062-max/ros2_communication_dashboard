"""Action type에 대응하는 status·feedback Message type/class를 해석합니다."""

from __future__ import annotations

from importlib import import_module

from rosidl_runtime_py.utilities import get_action


STATUS_TOPIC_TYPE = 'action_msgs/msg/GoalStatusArray'


def action_feedback_topic_type(action_type: str | None) -> str | None:
    if action_type is None:
        return None
    parts = action_type.split('/')
    if len(parts) != 3 or parts[1] != 'action':
        return None
    return f'{parts[0]}/action/{parts[2]}_FeedbackMessage'


def load_status_message_class() -> type | None:
    try:
        module = import_module('action_msgs.msg')
    except ImportError:
        return None
    return getattr(module, 'GoalStatusArray', None)


def load_feedback_message_class(action_type: str | None) -> type | None:
    if action_type is None:
        return None
    parts = action_type.split('/')
    if len(parts) != 3 or parts[1] != 'action':
        return None

    class_name = f'{parts[2]}_FeedbackMessage'
    try:
        module = import_module(f'{parts[0]}.action')
    except ImportError:
        module = None
    if module is not None:
        message_class = getattr(module, class_name, None)
        if message_class is not None:
            return message_class

    try:
        action_class = get_action(action_type)
    except (AttributeError, ImportError, LookupError, ValueError):
        return None
    return getattr(getattr(action_class, 'Impl', None), 'FeedbackMessage', None)
