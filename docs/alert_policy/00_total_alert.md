# 현재 Alert 전체 목록

현재 Monitor가 생성하는 Alert code는 총 21종이다. 이 문서는 내부 수집 방식보다 사용자가 실제로 확인해야 할
현상을 중심으로 설명한다. 내부 `code`, `level`, `alert_key` 값은 아래 표기 그대로 유지한다.

## Warning과 Error 기준

| level | 사용자 의미 |
|---|---|
| `warning` | 통신 지연이나 일부 조건 불일치가 감지됐다. 통신이 완전히 불가능하다고 확정된 상태는 아니다. |
| `error` | 연결 끊김, 실행 실패 또는 실제 통신 불가가 확인됐다. 즉시 확인이 필요하다. |
| `critical` | 기기가 심각한 상태라고 직접 보고했다. 가장 먼저 확인해야 한다. |

짧게 구분하면 다음과 같다.

```text
warning  → 문제가 생길 가능성 또는 일시적 실패
error    → 연결·실행·통신 실패 확인
critical → 기기가 심각한 상태를 직접 보고

```

## Topic 5종

| code | 사용자 상태명 | level | 사용자에게 보이는 의미 |
|---|---|---|---|
| `waiting_publisher` | 발행자 없음 | `warning` | 구독자는 있지만 메시지를 보내는 발행자가 없다. |
| `topic_message_missing` | 메시지 미수신 | `warning` | 발행자는 있지만 메시지를 한 번도 받지 못했다. |
| `topic_stale` | 메시지 수신 지연 | `warning` | 이전에 받던 메시지가 기준 시간 동안 들어오지 않았다. |
| `topic_disconnected` | Topic 연결 끊김 | `error` | 이전에 보이던 Topic이 더 이상 확인되지 않는다. |
| `topic_qos_incompatible` | QoS 불일치 | `warning` 또는 `error` | QoS 불일치가 계속 감지된다. 일부 조건 불일치는 `warning`, 실제 통신 불가가 확인되면 `error`다. |

### Topic QoS level

```text
warning → QoS 조건 일부가 맞지 않아 통신 문제가 생길 가능성이 있음
error   → QoS 불일치로 실제 통신이 불가능한 것이 확인됨
```

## Monitor Status 3종

MonitorStatus는 기기가 보낸 상태를 그대로 Alert level로 사용한다.

| code | 사용자 상태명 | level | 사용자에게 보이는 의미 |
|---|---|---|---|
| `monitor_status_warning` | 기기 경고 | `warning` | 기기가 주의가 필요한 상태를 보고했다. |
| `monitor_status_error` | 기기 오류 | `error` | 기기가 오류 상태를 보고했다. |
| `monitor_status_critical` | 기기 심각 오류 | `critical` | 기기가 즉시 확인이 필요한 심각한 상태를 보고했다. |

## Service 4종

| code | 사용자 상태명 | level | 사용자에게 보이는 의미 |
|---|---|---|---|
| `service_call_timeout` | Service 응답 지연 | `warning` | 보낸 요청에 대한 응답이 제한 시간 안에 오지 않았다. |
| `service_call_failed` | Service 호출 실패 | `error` | Service 요청 또는 응답 처리가 실패했다. |
| `service_disconnected` | Service 연결 끊김 | `error` | 이전에 보이던 Service가 더 이상 확인되지 않는다. |
| `service_qos_incompatible` | QoS 불일치 | `warning` 또는 `error` | QoS 불일치가 계속 감지된다. 일부 조건 불일치는 `warning`, 실제 통신 불가가 확인되면 `error`다. |

Service가 요청을 기다리는 상태나 아직 호출하지 않은 상태는 Alert가 아니다.

## Action 8종

| code | 사용자 상태명 | level | 사용자에게 보이는 의미 |
|---|---|---|---|
| `action_disconnected` | Action 연결 끊김 | `error` | 이전에 보이던 Action이 더 이상 확인되지 않는다. |
| `action_goal_aborted` | Action 실행 중단 | `error` | Action Server가 실행 중인 작업을 중단했다. |
| `action_goal_canceled` | Action 취소 | `warning` | 실행 중인 Action이 취소됐다. |
| `action_goal_rejected` | Action 요청 거부 | `warning` | Action Server가 Goal 요청을 거부했다. |
| `action_goal_send_failed` | Action 요청 실패 | `error` | Goal 전달 또는 수락 확인에 실패했다. |
| `action_result_timeout` | Action 결과 지연 | `warning` | Action 결과가 제한 시간 안에 오지 않았다. |
| `action_result_unavailable` | Action 결과 수신 실패 | `error` | Action 결과를 조회하거나 받지 못했다. |
| `action_qos_incompatible` | QoS 불일치 | `warning` 또는 `error` | Goal, Result, Cancel, Feedback, Status 중 한 통신의 QoS 불일치가 계속 감지된다. 일부 조건 불일치는 `warning`, 실제 통신 불가가 확인되면 `error`다. |

Action QoS Alert는 문제가 발생한 통신을 Goal, Result, Cancel, Feedback, Status로 구분해 표시한다.

## Node 1종

| code | 사용자 상태명 | level | 사용자에게 보이는 의미 |
|---|---|---|---|
| `node_stale` | Node 연결 끊김 | `error` | 이전에 보이던 Node가 일정 시간 동안 계속 확인되지 않는다. |

`node_stale`은 기존 API와 DB 호환을 위해 유지하는 code다. 사용자에게는 `Node 연결 끊김`으로 설명한다.

## Warning Alert 목록

- `waiting_publisher` — 발행자 없음
- `topic_message_missing` — 메시지 미수신
- `topic_stale` — 메시지 수신 지연
- `monitor_status_warning` — 기기 경고
- `service_call_timeout` — Service 응답 지연
- `action_goal_canceled` — Action 취소
- `action_goal_rejected` — Action 요청 거부
- `action_result_timeout` — Action 결과 지연

## Error Alert 목록

- `topic_disconnected` — Topic 연결 끊김
- `monitor_status_error` — 기기 오류
- `service_call_failed` — Service 호출 실패
- `service_disconnected` — Service 연결 끊김
- `action_disconnected` — Action 연결 끊김
- `action_goal_aborted` — Action 실행 중단
- `action_goal_send_failed` — Action 요청 실패
- `action_result_unavailable` — Action 결과 수신 실패
- `node_stale` — Node 연결 끊김

`monitor_status_critical`은 `critical` 전용이다.

## Warning과 Error가 모두 가능한 Alert

다음 세 code만 현재 판정 결과에 따라 `warning` 또는 `error`가 될 수 있다.

- `topic_qos_incompatible`
- `service_qos_incompatible`
- `action_qos_incompatible`

공통 기준은 다음과 같다.

```text
일부 QoS 조건 불일치 → warning
실제 통신 불가 확인 → error
```

QoS 불일치가 일시적으로 한 번 보인 것만으로 Alert를 만들지 않는다. 설정된 확인 횟수만큼 계속 감지됐을 때
Alert로 표시한다. QoS 일부 호환, QoS 확인 불가와 QoS 정보 발견만으로는 Alert를 만들지 않는다.

## DB 저장 방식

```text
Alert 최초 발생 → 새 행 추가
문제 지속       → 기존 미해결 행 유지, 새 행을 계속 추가하지 않음
문제 해결       → 기존 행에 해결 시각 기록, 행은 삭제하지 않음
해결 후 재발    → 새로운 문제 발생으로 새 행 추가
```

따라서 해결된 Alert도 이력으로 남는다. 사용자가 이전 Alert의 전체 이력 초기화를 실행할 때만 해결된 행을
삭제한다. 자세한 저장·조회 정책은 [05_alert_lifecycle.md](./05_alert_lifecycle.md)를 따른다.

## Alert로 만들지 않는 정상·확인 불가 상태

다음 상태는 그 자체로 Alert가 아니다.

- Topic 발행자는 있지만 구독자가 없음
- Service Server는 있지만 Client가 없음
- Action Server는 있지만 Client가 없음
- 사용자가 Service Call이나 Action Goal을 아직 실행하지 않음
- QoS가 일부만 호환되거나 호환 여부를 확인할 수 없음
- QoS 보조 정보 수집 기능을 사용할 수 없음
- 기본 QoS를 사용했다는 사실 자체
- 처음부터 한 번도 발견되지 않은 리소스

새 Alert code를 추가하거나 level을 변경할 때는 실제 판정 코드, source별 정책 문서, DB와 UI 표시를 함께
갱신한다.
