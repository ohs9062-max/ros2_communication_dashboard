# Action Alert 정책

## 개요

Action Alert는 **Interface Lab에서 사용자가 명시적으로 Goal을 전송**한 결과와
**Graph 연결 이탈**을 기반으로 생성됩니다.

자동 감시로 관찰된 Goal Status/Feedback/Result 정보와 사용자 실행 이력(`last_goal_summary`)
양쪽 모두에서 Alert를 판정합니다.

---

## Alert 코드 목록

### `action_qos_incompatible`

주요 Action의 Goal Service, Result Service, Cancel Service, Feedback Topic, Status Topic을 각각 판정합니다.
확정 incompatible 채널만 설정 횟수 연속 확인 후 생성하고 ID는
`action:<name>:action_qos_incompatible:<goal|result|cancel|feedback|status>`입니다. 여러 채널이 문제면
동시에 별도 Alert로 표시·해결되며 partial/unknown/graph_unavailable은 Alert가 아닙니다.

### 1. `action_disconnected`

Graph에서 처음 누락된 시점에는 기존 상태를 유지한 confirmation 후보이며 Alert를 만들지 않습니다.
`actions.graph_missing_timeout_sec`(기본 5초) 동안 계속 보이지 않을 때만 `disconnected`로 확정하며,
재등장하면 즉시 정상 상태로 복귀합니다.

| 항목 | 내용 |
|---|---|
| **Alert ID** | `action:<action_name>:action_disconnected` |
| **Level** | 🔴 `error` |
| **대상 Kind** | Action |
| **발생 조건** | • `action.status == 'disconnected'` (이전에 Graph에 존재했다가 사라짐)<br>• `action.allowlisted == true` (Interface Registry에 등록됨) |
| **판정 데이터** | `action.status`, `action.allowlisted`, `action.last_seen_at` |
| **사용자 메시지** | `Action connection lost; it is no longer visible in the ROS2 graph.` |
| **해제 조건** | Action이 Graph에 다시 나타남 |
| **소스 코드** | [ros2_action/alerts.py:29-46](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py#L29-L46) |

---

### 2. `action_goal_aborted`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `action:<action_name>:action_goal_aborted` |
| **Level** | 🔴 `error` |
| **대상 Kind** | Action |
| **발생 조건** | • 최근 Goal 상태가 `aborted` (ROS2 Goal Status 코드 `6`)<br>&nbsp;&nbsp;(`last_goal_status == 'aborted'`) |
| **판정 데이터** | `last_goal_summary.last_goal_status` 또는 `action.runtime.last_goal_status` |
| **사용자 메시지** | `Action goal aborted.` |
| **해제 조건** | 동일 Action에 대해 새로운 Goal이 성공(`succeeded`) 또는 다른 상태로 변경 |
| **소스 코드** | [ros2_action/alerts.py:61-72](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py#L61-L72) |

> [!NOTE]
> `aborted`는 Action Server가 Goal 실행 중 **서버 측 판단으로 중단**한 것입니다.
> Client 측의 Cancel 요청과는 다릅니다.

---

### 3. `action_goal_canceled`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `action:<action_name>:action_goal_canceled` |
| **Level** | ⚠️ `warning` |
| **대상 Kind** | Action |
| **발생 조건** | • 최근 Goal 상태가 `canceled` (ROS2 Goal Status 코드 `5`)<br>&nbsp;&nbsp;(`last_goal_status == 'canceled'`) |
| **판정 데이터** | `last_goal_summary.last_goal_status` 또는 `action.runtime.last_goal_status` |
| **사용자 메시지** | `Action goal canceled.` |
| **해제 조건** | 동일 Action에 대해 새로운 Goal이 성공 또는 다른 상태로 변경 |
| **소스 코드** | [ros2_action/alerts.py:73-84](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py#L73-L84) |

---

### 4. `action_goal_rejected`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `action:<action_name>:action_goal_rejected` |
| **Level** | ⚠️ `warning` |
| **대상 Kind** | Action |
| **발생 조건** | • 최근 Goal 상태가 `goal_rejected`<br>&nbsp;&nbsp;(Action Server가 Goal Accept를 거부) |
| **판정 데이터** | `last_goal_status == 'goal_rejected'` |
| **사용자 메시지** | `Action goal was rejected.` |
| **해제 조건** | 동일 Action에 대해 새로운 Goal이 수락(`accepted`) 또는 성공 |
| **소스 코드** | [ros2_action/alerts.py:85-96](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py#L85-L96) |

---

### 5. `action_goal_send_failed`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `action:<action_name>:action_goal_send_failed` |
| **Level** | 🔴 `error` |
| **대상 Kind** | Action |
| **발생 조건** | • 최근 Goal 상태가 다음 중 하나:<br>&nbsp;&nbsp;- `goal_send_failed`: Goal 전송 자체가 실패<br>&nbsp;&nbsp;- `goal_accept_timeout`: Goal Accept 응답 대기 시간 초과 |
| **판정 데이터** | `last_goal_status ∈ {'goal_send_failed', 'goal_accept_timeout'}` |
| **사용자 메시지** | • `goal_accept_timeout`: `Action goal acceptance timed out.`<br>• `goal_send_failed`: `Action goal transmission failed.` |
| **해제 조건** | 동일 Action에 대해 새로운 Goal이 정상 전송·수락 |
| **소스 코드** | [ros2_action/alerts.py:97-112](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py#L97-L112) |

---

### 6. `action_result_timeout`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `action:<action_name>:action_result_timeout` |
| **Level** | ⚠️ `warning` |
| **대상 Kind** | Action |
| **발생 조건** | • Goal이 수락(accepted)된 후<br>• Result 응답 대기 시간 초과 (`last_goal_status == 'result_timeout'`) |
| **판정 데이터** | `last_goal_status == 'result_timeout'` |
| **사용자 메시지** | `Action result timed out.` |
| **해제 조건** | 동일 Action에 대해 새로운 Goal의 Result가 정상 수신 |
| **설정 가능 여부** | Interface Lab Action Goal의 `DEFAULT_TIMEOUT_SEC = 10.0초`, `MAX_TIMEOUT_SEC = 60.0초` |
| **소스 코드** | [ros2_action/alerts.py:113-124](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py#L113-L124) |

---

### 7. `action_result_unavailable`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `action:<action_name>:action_result_unavailable` |
| **Level** | 🔴 `error` |
| **대상 Kind** | Action |
| **발생 조건** | 다음 중 하나:<br>• 사용자 Goal의 Result 수신 중 예외 발생 (`last_goal_status == 'result_receive_failed'`)<br>• 자동 감시에서 Result lookup 실패 (`runtime.result_error` 존재, `last_goal_summary` 없음) |
| **판정 데이터** | `last_goal_status == 'result_receive_failed'` 또는 `runtime.result_error` |
| **사용자 메시지** | `Action result reception failed.` 또는 `Action result lookup failed.` |
| **해제 조건** | 동일 Action에 대해 새로운 Goal의 Result가 정상 수신 |
| **소스 코드** | [ros2_action/alerts.py:125-149](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py#L125-L149) |

---

## ROS2 Goal Status 코드 참조

| 코드 | 이름 | 의미 | Alert |
|---|---|---|---|
| `0` | `unknown` | 상태 불명 | 없음 |
| `1` | `accepted` | Goal 수락됨 | 없음 |
| `2` | `executing` | 실행 중 | 없음 |
| `3` | `canceling` | 취소 진행 중 | 없음 |
| `4` | `succeeded` | 성공 완료 | 없음 |
| `5` | `canceled` | 취소 완료 | `action_goal_canceled` (WARNING) |
| `6` | `aborted` | 서버 측 중단 | `action_goal_aborted` (ERROR) |

---

## Action Alert 판정 흐름도

```text
Action Alert 판정:
│
├─ status == 'disconnected' AND allowlisted == true
│  → action_disconnected (ERROR)
│
├─ last_goal_status 확인 (summary 또는 runtime)
│  ├─ 'aborted'           → action_goal_aborted (ERROR)
│  ├─ 'canceled'          → action_goal_canceled (WARNING)
│  ├─ 'goal_rejected'     → action_goal_rejected (WARNING)
│  ├─ 'goal_send_failed'  → action_goal_send_failed (ERROR)
│  ├─ 'goal_accept_timeout' → action_goal_send_failed (ERROR)
│  ├─ 'result_timeout'    → action_result_timeout (WARNING)
│  ├─ 'result_receive_failed' → action_result_unavailable (ERROR)
│  ├─ 'succeeded'         → Alert 없음 (정상)
│  ├─ 'executing'         → Alert 없음 (진행 중)
│  └─ 'unknown'           → Alert 없음
│
└─ runtime.result_error 존재 AND summary 없음
   → action_result_unavailable (ERROR)
```

---

## 정상 대기 상태 (Alert 미발생)

| 상태 | 설명 | 근거 |
|---|---|---|
| Server만 존재, Client 없음 | Goal 대기 상태 | AGENTS.md 정책: 기본 Alert 제외 |
| Goal 미실행 | Interface Lab에서 Goal을 보내지 않은 상태 | `last_goal_summary`와 `runtime` 모두 초기 상태 |
| `succeeded` | Goal 정상 완료 | 성공은 Alert 대상 아님 |
| `executing` | Goal 실행 진행 중 | 아직 완료되지 않은 정상 상태 |

---

## 관련 설정 키

| 설정 위치 | 키/상수 | 기본값 | 역할 |
|---|---|---|---|
| `monitor.yaml` | `actions.auto_monitor_status` | `true` | Goal Status Topic 자동 구독 |
| `monitor.yaml` | `actions.auto_monitor_feedback` | `true` | Feedback Topic 자동 구독 |
| `monitor.yaml` | `actions.auto_fetch_result_for_observed_goals` | `true` | 관찰된 Goal의 Result 자동 조회 |
| 코드 상수 | `DEFAULT_TIMEOUT_SEC` | `10.0초` | Interface Lab Action Goal 기본 타임아웃 |
| 코드 상수 | `MAX_TIMEOUT_SEC` | `60.0초` | Interface Lab Action Goal 최대 타임아웃 |
