# Node Alert 정책

현재 Node Alert는 `node_stale` 1종입니다. 이름은 기존 API 호환을 위해 `stale`을 유지하지만 실제 의미는
이전에 발견된 Node가 현재 ROS2 Graph에서 보이지 않는 연결 종료 감지입니다.

## `node_stale`

| 항목 | 내용 |
|---|---|
| level | `error` |
| alert_key 형식 | `node:<full_name>:node_stale` |
| 발생 조건 | 주요 감시 Node가 `nodes.stale_timeout_sec` 동안 Graph에서 계속 보이지 않아 `status == disconnected`로 확정됨 |
| 판정 데이터 | `status`, `full_name`, `last_seen_at` |
| 사용자 메시지 | `Monitored Node is confirmed absent from the ROS2 graph.` |
| 정상화 조건 | 같은 Node가 Graph에 다시 나타나 `active`가 됨 |

```text
처음부터 미발견
→ Alert 없음

Graph 발견
→ active

다음 Graph snapshot에서 사라짐
→ confirmation 후보 (`graph_missing_pending = true`, Alert 없음)

stale_timeout_sec 동안 계속 누락
→ disconnected 확정
→ node_stale (error)

다시 발견
→ active
→ Alert 해제
```

`node_stale` code는 DB/API 호환을 위해 유지하지만 사용자 화면에서는 `Graph 이탈`로 표시합니다.
Alert 대상은 최종 `is_primary == true`이고 Dashboard 내부 Node가 아닌 항목입니다. ros2cli daemon과
일시적인 보조 Node는 자동 주요 대상에서 제외하되, 설정 또는 사용자 별표로 명시한 항목은 감시할 수 있습니다.
처음부터 발견된 적 없는 Node에는 Alert를 만들지 않습니다.

소스 기준은 `ros2_dashboard_monitor/ros2_node/runtime.py`, `resource_state.py`,
`ros2_node/alerts.py`입니다.
