# Alert 흐름

## Monitor 후보와 생명주기

```text
Topic / Service / Action / Node / QoS 상태
→ alert_assembler.collect_runtime_alerts()
→ reconcile_alert_state()
→ Monitor active/resolved memory
→ transport snapshot
→ Backend AlertHistoryService
→ MariaDB alert table
→ Alerts 화면
```

| 단계 | 현재 코드 위치 | 역할 |
|---:|---|---|
| 1 | `ros_monitor.py RosMonitor.alerts()` L378-L425 | 동일 snapshot에서 source별 후보 수집과 lifecycle 반영 |
| 2 | `alert_assembler.py collect_runtime_alerts()` | source builder와 QoS Alert 결과 결합 |
| 3 | `alert_assembler.py reconcile_alert_state()` | active/resolved, dismiss와 memory history 관리 |
| 4 | `transport/api.py transport_snapshot()` L66-L102 | Alert를 같은 coherent snapshot에 포함 |
| 5 | `backend/app/monitor_client/event_consumer.py` | snapshot polling과 cache 갱신 |
| 6 | `backend/app/alerts/service.py` | DB active/resolved/recurrence 동기화와 fallback |
| 7 | `backend/app/routers/alerts.py` L30-L64 | 현재 Alert와 페이지 이력 API |
| 8 | `frontend/src/pages/AlertsPage.jsx` L20-L620 | 현재/이전 Alert, 검색·페이지·초기화·대상 이동 |

## Source builder

| Source | 현재 코드 위치 | 주요 code |
|---|---|---|
| Topic | `ros2_topic/alerts.py` L28-L218 | waiting, missing, stale, disconnected |
| MonitorStatus | `ros2_topic/monitor_status_alerts.py` | warning, error, critical |
| Service | `ros2_service/alerts.py build_service_alerts()` L10-L97 | Call timeout/fail, disconnected |
| Action | `ros2_action/alerts.py build_action_alerts()` L21-L176 | disconnected, Goal/Result 상태 |
| Node | `ros2_node/alerts.py build_node_alerts()` L13-L44 | Graph에서 사라진 Node |
| QoS | `qos_alerts.py` | 확정 incompatible만, Action은 채널별 |

Alert ID는 `<source>:<name>:<code>`, Action QoS는 끝에 채널을 붙인다. `partial`, `unknown`,
`observed`, `graph_unavailable`, fallback, 미수신/timeout 추정 자체는 QoS Alert가 아니다.
QoS incompatible은 설정된 연속 Graph 갱신 횟수를 만족해야 한다.

## MariaDB

Backend는 같은 `alert_key`의 미해결 row를 유지하고 해결 때 `resolved_at`을 갱신한다. 해결 후 재발하면 새
row를 추가한다. DB 장애 중에도 Monitor와 UI는 마지막 cache/메모리 fallback으로 동작하고 재연결을 시도한다.

`POST /ros/alerts/current/reset`은 현재 표시를 확인 처리할 뿐 DB row를 삭제하지 않는다.
`POST /ros/alerts/history/reset`은 해결된 이력만 삭제한다.

## Alert AI 분석 (선택)

Alert 상세의 Cloud와 Local 분석은 서로 fallback하지 않는다. 두 분석 모두 현재 Dashboard context와 최근 최대 5건의
Topic/Service/Action history를 사용하며, 현재 Runtime은 Alert 발생 당시 상태와 다를 수 있음을 함께 전달한다.
Local은 Ollama `/api/chat`에 structured JSON 형식으로 한 번만 요청하고, summary·원인·확인 순서의 한국어 설명을
검증한다. `다른 관점 분석`은 같은 Alert의 `alternate=true` 요청으로, 기존 사실 밖의 원인을 만들지 않도록 별도 지시를
추가한다.

Local 모델의 상태는 `GET /ros/alerts/ai-diagnosis/local/model`, 다운로드 시작은
`POST /ros/alerts/ai-diagnosis/local/model`으로 확인한다. Backend는 한 process 안에서 하나의 Ollama `/api/pull`
task만 유지하고, 화면은 저장된 실제 진행률을 polling한다.
