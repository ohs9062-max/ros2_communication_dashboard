# 현재 Alert 전체 목록

실제 Monitor Alert builder가 생성하는 Alert code는 총 21종입니다.

## Topic 5종

| code | level | 발생 조건 요약 |
|---|---|---|
| `waiting_publisher` | warning | 필수 또는 등록 감시 Topic에 Publisher가 없음 |
| `topic_message_missing` | warning | Publisher와 감시 subscription은 있으나 제한 시간 동안 한 번도 메시지를 받지 못함 |
| `topic_stale` | warning | 이전 수신 후 새 메시지 없이 stale 기준 시간을 초과함 |
| `topic_disconnected` | error | 이전에 발견된 감시 대상 Topic이 Graph에서 사라짐 |
| `topic_qos_incompatible` | warning/error | 주요 감시 Topic의 확정 incompatible이 설정 횟수 연속 유지됨. 일부 Graph endpoint 조합 불일치는 warning, 실제 RMW 이벤트 또는 Dashboard 적용 QoS가 모든 상대 endpoint와 불가능하면 error |

## Monitor Status 3종

| code | level | 발생 조건 요약 |
|---|---|---|
| `monitor_status_warning` | warning | MonitorStatus 메시지가 warning 상태를 보고함 |
| `monitor_status_error` | error | MonitorStatus 메시지가 error 상태를 보고함 |
| `monitor_status_critical` | critical | MonitorStatus 메시지가 critical 상태를 보고함 |

## Service 4종

| code | level | 발생 조건 요약 |
|---|---|---|
| `service_call_timeout` | warning | 서버로 전송된 최근 사용자 Service Call이 제한 시간 안에 응답하지 않음 |
| `service_call_failed` | error | 서버로 전송된 최근 사용자 Service Call이 실패 상태로 끝남 |
| `service_disconnected` | error | 이전에 발견된 등록 주요 Service가 Graph에서 사라짐 |
| `service_qos_incompatible` | warning/error | 숨김이 아닌 주요 Service의 확정 incompatible이 설정 횟수 연속 유지됨. 관찰 불가·fallback·timeout만으로는 생성하지 않음 |

## Action 8종

| code | level | 발생 조건 요약 |
|---|---|---|
| `action_disconnected` | error | 이전에 발견된 등록 주요 Action이 Graph에서 사라짐 |
| `action_goal_aborted` | error | 최근 사용자 Goal이 서버에서 aborted로 끝남 |
| `action_goal_canceled` | warning | 최근 사용자 Goal이 canceled로 끝남 |
| `action_goal_rejected` | warning | 최근 사용자 Goal이 서버에서 거부됨 |
| `action_goal_send_failed` | error | Goal 전송 또는 accept 대기가 실패함 |
| `action_result_timeout` | warning | 수락된 Goal의 Result 대기가 제한 시간을 초과함 |
| `action_result_unavailable` | error | Result 조회 또는 수신이 실패함 |
| `action_qos_incompatible` | warning/error | 주요 Action의 Goal/Result/Cancel/Feedback/Status 중 확정 incompatible 채널이 설정 횟수 연속 유지됨. Alert key 끝에 채널명을 포함 |

## Node 1종

| code | level | 발생 조건 요약 |
|---|---|---|
| `node_stale` | error | Backend 실행 이후 발견됐던 Node가 현재 Graph에서 사라짐 |

## 목록에서 제외한 상태

다음은 현재 Alert builder가 실제 Alert code로 생성하지 않으므로 DB Alert 종류에 포함하지 않습니다.

- QoS `partial`, `unknown`, `observed`, `graph_unavailable`, observer 미사용 또는 fallback 사용 자체
- `service_waiting_server`, `action_waiting_server`
- `service_active_check_timeout`, `service_active_check_failed`, `service_active_check_error`,
  `service_active_check_type_mismatch`
- 일반 Topic의 Subscriber 없음, Service server만 존재, Action server만 존재하는 정상 대기 상태

Service Active Check의 값은 현재 점검 runtime의 내부 상태이며 `build_service_alerts()` 출력이 아닙니다.
새 Alert code를 추가할 때는 builder, 이 문서, source별 문서와 DB/UI 정책을 함께 갱신합니다.

QoS Alert는 `alerts.qos.incompatible_confirmation_count`(기본 3)의 서로 다른 Graph 갱신에서 연속 확인된
`incompatible`만 생성합니다. 정상 `compatible` 또는 endpoint 소멸로 비교 불가가 되면 기존 Alert를 해결합니다.
