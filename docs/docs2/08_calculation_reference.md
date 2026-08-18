# 계산 로직 코드 대조표

이 문서는 현재 목록과 Alert의 핵심 계산 위치만 표시한다.

## 수와 관계

| 값 | 의미 | 현재 코드 |
|---|---|---|
| `publisher_count/subscriber_count` | Dashboard endpoint를 포함한 Topic raw endpoint 수 | `ros2_topic/discovery.py build_topic_item()` L10-L43 |
| Service `server_count/client_count` | rclpy Graph의 raw Service count | `ros2_service/discovery.py build_service_item()` L17-L57 |
| Action `server_count/client_count` | rclpy Action Graph의 raw count | `ros2_action/discovery.py build_action_item()` L23-L65 |
| `*_node_count` | 역할·이름·exact type별 고유 Node 수 | `topology.py` L19-L54 |
| Topic 외부 Node/primary/Lab 상태 | Runtime snapshot에 API 필드 병합 | `snapshot_assembler.py enrich_topic_snapshot()` L21-L85 |
| Service 외부 Node/Call/QoS | Service snapshot 조립 | `service_snapshot.py assemble_service_snapshot()` L16-L112 |
| Action 외부 Node/Goal/QoS | Action snapshot 조립 | `action_snapshot.py assemble_action_snapshot()` L15-L127 |

기본 목록의 Node 수는 내부 `/ros2_dashboard_topic_monitor`를 제외한다. raw endpoint count와 endpoint
진단은 Dashboard를 포함한다. Interface Lab에서 사용자가 명시적으로 생성한 entity는 실행 상태로 별도 유지한다.

## 상태

| 영역 | 계산 | 현재 코드 |
|---|---|---|
| Topic Graph | active/no_subscriber/waiting_publisher/inactive | `ros2_topic/models.py topic_status()` L49-L67 |
| Topic 대표 | Graph status 또는 never_received/stale | `ros2_topic/snapshot.py _effective_status()` L157-L177 |
| Service | unknown/active/waiting_server/inactive | `ros2_service/models.py service_status()` L37-L58 |
| Action | unknown/active/waiting_server/inactive | `ros2_action/models.py action_status()` L63-L81 |
| Node 발견 | active | `ros2_node/models.py node_status()` L27-L39 |
| 이전 리소스 Graph 이탈 | disconnected | `resource_state.py disconnected_resource()` L59-L79 |
| Graph 이탈 debounce | 확인 횟수와 timeout 뒤 disconnected | `resource_state.py debounce_disconnected_resource()` L26-L56 |

Service 목록의 최근 사용자 Call 상태는 `service_snapshot.py` L16-L112에서,
Action의 최근 Goal/Feedback/Result는 `action_snapshot.py` L15-L127에서 Graph 상태와 별도 필드로 병합한다.

## Topic Hz와 시간

| 계산 | 현재 코드 |
|---|---|
| window 밖 timestamp 제거 | `ros2_topic/hz.py recent_timestamps()` L14-L22 |
| age와 stale 상태 | `ros2_topic/hz.py hz_status()` L25-L39 |
| `message_count / window_sec`와 응답 | `ros2_topic/hz.py build_hz_snapshot()` L42-L71 |
| callback timestamp 저장 | `ros2_topic/subscriptions.py update_subscription_entry()` L41-L56 |

Hz는 최근 window의 메시지 수를 전체 window 초로 나눈 현재 구현값이다. 한 번도 받지 못한 경우와 이전 수신
후 stale은 같은 값으로 합치지 않는다.

## Action과 Interface Lab 실행 시간

관찰 Action의 elapsed는 `ros2_action/subscriptions.py _elapsed_time_ms()` L214-L223에서 계산한다.
Service Call 실행과 기록은 `interface_lab/execution/service_call_runtime.py call_service()` L83-L129,
Action Goal 실행과 기록은 `interface_lab/execution/action_goal_runtime.py send_goal()` L84-L123이
executor 결과를 history 구조로 보존한다.

## Alert

| 계산 | 현재 코드 |
|---|---|
| Topic 후보 | `ros2_topic/alerts.py` L28-L218 |
| Service 후보 | `ros2_service/alerts.py` L10-L97 |
| Action 후보 | `ros2_action/alerts.py` L21-L176 |
| Node 후보 | `ros2_node/alerts.py` L13-L44 |
| source 결합과 lifecycle | `alert_assembler.py` |
| Monitor active/resolved 응답 | `ros_monitor.py alerts()` L278-L324 |
| Backend DB lifecycle | `backend/app/alerts/service.py` |

Topic command는 수신 Alert에서 제외하고 required/등록 감시 대상만 missing/stale/waiting 후보가 된다.
QoS는 확정 `incompatible`만 설정된 연속 갱신 횟수를 거쳐 Alert가 된다.

## 요약 meta

| 영역 | 현재 코드 |
|---|---|
| Topic meta | `ros2_topic/snapshot.py`, `snapshot_summary.py websocket_topic_meta()` |
| Service meta | `ros2_service/models.py service_meta()` L66-L145 |
| Action meta | `ros2_action/models.py action_meta()` L114-L159 |
| Node meta | `ros2_node/models.py node_meta()` L56-L88 |
| WebSocket 경량 meta | `snapshot_summary.py` |

Frontend는 Monitor/Backend의 resource status와 meta를 유지하고, Topic effective status와 Service/Action의 최근
실행값은 feature별 presentation helper로 같은 우선순위에 맞춰 표시한다.
