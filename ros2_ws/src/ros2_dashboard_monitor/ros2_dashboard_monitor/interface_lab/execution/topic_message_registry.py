"""Interface Lab에서 사용할 수 있는 등록 Message 조회와 schema 조립."""

from __future__ import annotations

from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.execution.topic_support import InterfaceReceiveError


class TopicMessageRegistry:
    """수동·package registry의 Message를 실행 가능한 모델로 통합합니다."""

    def __init__(
        self,
        *,
        graph_topics: Callable[[], list[dict[str, Any]]],
        package_messages_loader: Callable[[], list[dict[str, Any]]],
        registry_loader: Callable[[], dict[str, Any]],
        schema_loader: Callable[[str], list[dict[str, Any]]],
    ) -> None:
        self._graph_topics = graph_topics
        self._package_messages_loader = package_messages_loader
        self._registry_loader = registry_loader
        self._schema_loader = schema_loader

    def messages(self) -> list[dict[str, Any]]:
        registry = self._registry_loader()['interface_registry']
        messages = []
        for item in registry.get('messages', []):
            build = item.get('build') or {}
            package_name = build.get('interface_package')
            type_name = item.get('type_name')
            if not package_name or not type_name:
                continue
            messages.append({
                'file_name': item.get('file_name'),
                'type_name': type_name,
                'message_type': f'{package_name}/msg/{type_name}',
                'message_schema': (
                    item.get('parsed', []) if isinstance(item.get('parsed'), list) else []
                ),
                'saved_path': build.get('saved_path'),
                'import_available': build.get('import_available') is True,
                'import_error': build.get('import_error'),
                'source': item.get('source', 'single_upload'),
                'package_name': package_name,
            })
        messages.extend(self._package_messages_loader())
        return messages

    def find(self, message_type: str) -> dict[str, Any] | None:
        return next(
            (item for item in self.messages() if item.get('message_type') == message_type),
            None,
        )

    def ensure_available(self, message_type: str) -> None:
        entry = self.find(message_type)
        if entry is None:
            raise InterfaceReceiveError('Only a Message full_type registered in the registry can be used.')
        if entry.get('import_available') is not True:
            raise InterfaceReceiveError(entry.get('import_error') or 'The Message type must be importable.')

    def schema(self, message_type: str) -> dict[str, Any]:
        entry = self.find(message_type)
        if entry is None:
            raise InterfaceReceiveError('The Message full_type is not registered in the registry.')
        schema = entry.get('message_schema') or []
        if entry.get('import_available') is True and not schema:
            schema = self._schema_loader(message_type)
        return {
            **entry,
            'message_schema': schema,
            'graph_topics': [
                item for item in self._graph_topics() if item.get('type') == message_type
            ],
        }

    def callable_messages(self) -> dict[str, Any]:
        messages = []
        graph = self._graph_topics()
        for entry in self.messages():
            message_type = entry['message_type']
            matching = [item for item in graph if item['type'] == message_type]
            matching_names = {item['name'] for item in matching}
            conflicts = [
                item for item in graph
                if item['name'] in matching_names and item['type'] != message_type
            ]
            messages.append({
                **entry,
                'full_type': message_type,
                'topic_type': message_type,
                'message_schema': entry.get('message_schema') or (
                    self._schema_loader(message_type)
                    if entry.get('import_available') is True else []
                ),
                'graph_topics': matching,
                'graph_conflicts': conflicts,
            })
        messages.sort(key=lambda item: (item.get('message_type') or '', item.get('source') or ''))
        return {
            'messages': messages,
            'meta': {
                'count': len(messages),
                'import_available_count': sum(
                    1 for item in messages if item.get('import_available') is True
                ),
            },
        }
