# Service Alert 정책

현재 `build_service_alerts()`가 실제 생성하는 Service Alert는 3종입니다.

## `service_disconnected`

| 항목 | 내용 |
|---|---|
| level | `error` |
| alert_key 형식 | `service:<service_name>:service_disconnected` |
| 발생 조건 | 사용자 범주의 주요 등록 Service가 이전에 발견됐지만 현재 Graph에서 사라짐 |
| 정상화 조건 | 같은 Service가 Graph에 다시 나타남 |
| 메시지 의미 | 등록 Service 연결 종료 감지 |

## `service_call_timeout`

| 항목 | 내용 |
|---|---|
| level | `warning` |
| alert_key 형식 | `service:<service_name>:service_call_timeout` |
| 발생 조건 | Interface Lab에서 사용자가 명시한 Call이 서버로 전송됐고 최근 호출 상태가 `timeout`임 |
| 정상화 조건 | 같은 Service의 새 호출이 성공하거나 최근 호출 상태가 변경됨 |
| 메시지 의미 | 최근 사용자 Service Call 응답 제한 시간 초과 |

## `service_call_failed`

| 항목 | 내용 |
|---|---|
| level | `error` |
| alert_key 형식 | `service:<service_name>:service_call_failed` |
| 발생 조건 | 서버로 전송된 최근 사용자 Call 상태가 `failed`, `response_failed`, `service_call_error` 중 하나임 |
| 정상화 조건 | 같은 Service의 새 호출이 성공함 |
| 메시지 의미 | 최근 사용자 Service Call 실패 원인 |

## Alert에서 제외되는 상태

- Service server만 있고 client가 없는 상태는 정상 요청 대기이므로 Alert가 아닙니다.
- 아직 사용자가 Call하지 않은 상태는 Alert가 아닙니다.
- 요청이 서버로 전송되기 전 validation에 실패한 상태는 통신 Alert가 아닙니다.
- Active Check의 `timeout`, `failed`, `error`, `type_mismatch`는 현재 runtime 내부 점검 상태입니다.
  `build_service_alerts()`가 `service_active_check_*` Alert code를 생성하지 않으므로 실제 18종 목록과 DB 저장
  대상 code 목록에 포함하지 않습니다.

## 판정 흐름

```text
category != user 또는 hidden_by_default
→ Alert 제외

등록 주요 Service가 Graph에서 사라짐
→ service_disconnected (error)

최근 명시적 Call이 서버에 전송됨
├─ timeout
│  → service_call_timeout (warning)
└─ failed / response_failed / service_call_error
   → service_call_failed (error)
```

소스 기준은 `ros2_dashboard_monitor/ros2_service/alerts.py`이며, code를 변경하면
[00_total_alert.md](./00_total_alert.md)와 DB 정책도 함께 갱신합니다.
