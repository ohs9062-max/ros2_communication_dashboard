# Node Alert 정책

현재 Node Alert는 `node_stale` 1종입니다. 이름은 기존 API 호환을 위해 `stale`을 유지하지만 실제 의미는
이전에 발견된 Node가 현재 ROS2 Graph에서 보이지 않는 연결 종료 감지입니다.

## `node_stale`

| 항목 | 내용 |
|---|---|
| level | `error` |
| alert_key 형식 | `node:<full_name>:node_stale` |
| 발생 조건 | 이전 snapshot에서 발견된 Node가 현재 Graph에서 사라져 `status == disconnected`가 됨 |
| 판정 데이터 | `status`, `full_name`, `last_seen_at` |
| 사용자 메시지 | `Node connection lost; it is no longer visible in the ROS2 graph.` |
| 정상화 조건 | 같은 Node가 Graph에 다시 나타나 `active`가 됨 |

```text
처음부터 미발견
→ Alert 없음

Graph 발견
→ active

다음 Graph snapshot에서 사라짐
→ disconnected
→ node_stale (error)

다시 발견
→ active
→ Alert 해제
```

`NodeRuntime`은 현재 Graph에서 빠진 기존 Node를 `disconnected_resource()`로 즉시 변환합니다.
생성자에 전달되는 `stale_timeout_sec`은 현재 Node 상태 전이에 사용되지 않으므로, 5초 유예 뒤 Alert가
발생한다고 문서화하지 않습니다. 처음부터 발견된 적 없는 Node에는 Alert를 만들지 않습니다.

소스 기준은 `ros2_dashboard_monitor/ros2_node/runtime.py`, `resource_state.py`,
`ros2_node/alerts.py`입니다.
