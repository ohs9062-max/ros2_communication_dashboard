# Service Alert 정책

현재 Service Alert code는 4종입니다.

## `service_qos_incompatible`

사용자 상태명은 `QoS 불일치`입니다. QoS 조건 일부가 맞지 않아 통신 문제가 생길 가능성이 있으면
`warning`, QoS 불일치로 실제 통신이 불가능한 것이 확인되면 `error`입니다.

코드상으로는 판정 대상 Service의 QoS가 `incompatible`로 설정 횟수 연속 확인될 때 생성합니다.
ID는 `service:<name>:service_qos_incompatible`이며 partial/unknown/graph_unavailable, observer 미사용,
fallback 자체와 Call timeout만으로는 생성하지 않습니다. compatible 복귀 또는 endpoint 소멸 시 해결됩니다.

## `service_disconnected`

Graph에서 처음 누락된 시점에는 기존 상태를 유지한 confirmation 후보이며 Alert를 만들지 않습니다.
`services.graph_missing_timeout_sec`(기본 5초) 동안 계속 보이지 않을 때만 `disconnected`로 확정합니다.
재등장하면 즉시 후보를 지우고 정상 상태로 복귀합니다.

| 항목 | 내용 |
|---|---|
| 사용자 상태명 | Service 연결 끊김 |
| level | `error` |
| alert_key 형식 | `service:<service_name>:service_disconnected` |
| 발생 조건 | 사용자 범주의 주요 등록 Service가 이전에 발견됐지만 현재 Graph에서 사라짐 |
| 정상화 조건 | 같은 Service가 Graph에 다시 나타남 |
| 메시지 의미 | 이전에 연결된 Service를 더 이상 확인할 수 없음 |

## `service_call_timeout`

| 항목 | 내용 |
|---|---|
| 사용자 상태명 | Service 응답 지연 |
| level | `warning` |
| alert_key 형식 | `service:<service_name>:service_call_timeout` |
| 발생 조건 | Interface Lab에서 사용자가 명시한 Call이 서버로 전송됐고 최근 호출 상태가 `timeout`임 |
| 정상화 조건 | 같은 Service의 새 호출이 성공하거나 최근 호출 상태가 변경됨 |
| 메시지 의미 | Service 응답이 제한 시간 안에 오지 않음 |

## `service_call_failed`

| 항목 | 내용 |
|---|---|
| 사용자 상태명 | Service 호출 실패 |
| level | `error` |
| alert_key 형식 | `service:<service_name>:service_call_failed` |
| 발생 조건 | 서버로 전송된 최근 사용자 Call 상태가 `failed`, `response_failed`, `service_call_error` 중 하나임 |
| 정상화 조건 | 같은 Service의 새 호출이 성공함 |
| 메시지 의미 | Service 요청을 보냈지만 호출 또는 응답 처리에 실패함 |

## Alert에서 제외되는 상태

- Service server만 있고 client가 없는 상태는 정상 요청 대기이므로 Alert가 아닙니다.
- 아직 사용자가 Call하지 않은 상태는 Alert가 아닙니다.
- 요청이 서버로 전송되기 전 validation에 실패한 상태는 통신 Alert가 아닙니다.
- Active Check의 `timeout`, `failed`, `error`, `type_mismatch`는 현재 runtime 내부 점검 상태입니다.
  `build_service_alerts()`가 `service_active_check_*` Alert code를 생성하지 않으므로 실제 code 목록과 DB 저장
  대상 code 목록에 포함하지 않습니다.

목록과 상세의 최근 Request/Response, 응답 시간과 마지막 호출은 사용자가 Interface Lab에서 실행한 실제 Call
summary를 사용합니다. 호출 이력이 없는 활성 Service는 `서버 있음`으로 표시하며 validation 실패는 Graph 서버
장애로 재분류하지 않습니다.

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
