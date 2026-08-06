# Alert 생명주기 (Lifecycle)

## 개요

이 문서는 Alert가 생성되고 해제되며, 이력으로 남고, 사용자에 의해 숨겨지는 전체 생명주기를 설명합니다.

---

## Alert 상태 전이 다이어그램

```text
[조건 감지] ──→ [Active] ◄──── 매 폴링 주기마다 조건 재확인
                  │
                  ├─ 조건 해제 ──→ [Resolved]
                  │                   │
                  │                   ├─ resolved_retention_sec (60초) 이내
                  │                   │  → 화면에 resolved 상태로 표시
                  │                   │
                  │                   └─ resolved_retention_sec 초과
                  │                      → 메모리에서 제거 (History에는 남음)
                  │
                  └─ 사용자 Dismiss ──→ [Dismissed]
                                         │
                                         ├─ 동일 조건 지속 중 → 화면에서 숨김
                                         │
                                         └─ 조건 해제 후 다시 발생 시
                                            → 새로운 Active Alert로 복귀
```

---

## 1단계: Alert 생성 (Detection)

매 Graph 폴링 주기(`poll_interval_sec`, 기본 `1.0초`)마다 Monitor는 모든 Runtime의 현재 상태를 조사하여 Alert를 생성합니다.

### Alert 생성 순서 (ros_monitor.py)

```text
1. Topic alerts     ← build_alerts()
2. Service alerts   ← build_service_alerts()
3. Action alerts    ← build_action_alerts()
4. Node alerts      ← build_node_alerts()
5. Dismiss 필터링   ← dismissed_alert_ids에서 제외
6. Retain 처리      ← retain_alerts()로 active/resolved 갱신
```

### Alert 생성 함수 원천

| 통신 | 함수 | 파일 |
|---|---|---|
| Topic | `build_alerts()` | `ros2_topic/alerts.py` |
| Service | `build_service_alerts()` | `ros2_service/alerts.py` |
| Action | `build_action_alerts()` | `ros2_action/alerts.py` |
| Node | `build_node_alerts()` | `ros2_node/alerts.py` |

---

## 2단계: 상태 보존 (Retention)

### Retained Alert 코드

아래 코드의 Alert는 **상태 보존(retain)** 대상입니다.
resolved 되어도 `ALERT_RESOLVED_RETENTION_SEC` (`60.0초`) 동안 화면에 유지됩니다:

```text
Topic:   topic_message_missing, topic_stale, topic_disconnected
Service: service_disconnected, service_call_failed, service_call_timeout
Action:  action_disconnected, action_goal_aborted, action_goal_canceled,
         action_goal_rejected, action_goal_send_failed,
         action_result_timeout, action_result_unavailable
Node:    node_stale
```

### Retain 로직

```text
current_alerts에 있고 retained_codes에 포함 → Active 유지
  → first_detected_at 보존 (최초 감지 시각)
  → last_detected_at 갱신 (매 폴링 시각)
  → resolved_at = null

retained에 있지만 current_alerts에 없음 → Resolved로 전환
  → alert_state = 'resolved'
  → resolved_at 기록
  → 60초 이내이면 화면에 resolved 상태로 표시
  → 60초 초과 시 메모리에서 제거
  → History에 해결 기록 추가 (최초 resolved 시에만)
```

---

## 3단계: Alert History (이력)

### Monitor 측 이력

- Alert가 **처음 resolved될 때** History에 1건 추가
- History 최대 보관: `50건` (코드 상수 `history_limit`)
- `reset_alert_history()` API로 이력 삭제 가능

### Backend 측 이력

- Backend의 `AlertHistoryService`가 Monitor snapshot에서 전달받은 Alert를 독립 관리
- `consume()` 메서드에서 이전 Active → 현재 미존재 시 자동 Resolved 기록
- Backend History 최대 보관: `50건` (`HISTORY_LIMIT`)
- 향후 MariaDB 영속 저장소로 이관 예정

### History 응답 데이터

```json
{
  "id": "topic:/scan:topic_stale:resolved:1722930000.0",
  "origin_id": "topic:/scan:topic_stale",
  "alert_state": "resolved",
  "first_detected_at": 1722929990.0,
  "last_detected_at": 1722929999.0,
  "resolved_at": 1722930000.0,
  "level": "warning",
  "source": "topic",
  "name": "/scan",
  "code": "topic_stale"
}
```

---

## 4단계: 사용자 조치 (Dismiss / Reset)

### Dismiss (현재 Alert 확인 처리)

| API | 동작 |
|---|---|
| `POST /ros/alerts/reset-current` (Monitor) | 현재 visible한 모든 active Alert를 `dismissed_alert_ids`에 추가하고 retained에서 제거. 해당 조건이 해제된 후 다시 발생하면 새 Alert로 복귀 |
| `POST /alerts/dismiss` (Backend) | Backend 측 active Alert를 dismissed 처리. Monitor와 독립적 |

### History Reset

| API | 동작 |
|---|---|
| `POST /ros/alerts/reset-history` (Monitor) | Monitor의 메모리 이력 전체 삭제 |
| `POST /alerts/history/reset` (Backend) | Backend의 이력 전체 삭제 |

---

## Alert Meta (요약 통계)

매 Alert 조회 시 아래 요약 통계가 함께 반환됩니다:

```json
{
  "count": 5,
  "active_count": 3,
  "resolved_count": 2,
  "info_count": 0,
  "warning_count": 2,
  "error_count": 1,
  "critical_count": 0
}
```

- `count`: active + resolved 전체 Alert 수
- `active_count`: 현재 활성 상태인 Alert 수
- `resolved_count`: 해결되었지만 retention 기간 내인 Alert 수
- `info_count` ~ `critical_count`: active Alert의 level별 건수

---

## 전체 Alert 코드 종합 표

| 코드 | Source | Level | Retained | 발생 조건 요약 |
|---|---|---|---|---|
| `waiting_publisher` | topic | warning | ❌ | Publisher 없이 감시 대상 Topic 존재 |
| `topic_message_missing` | topic | warning | ✅ | Publisher 있으나 메시지 한 번도 미수신 (stale_timeout 초과) |
| `topic_stale` | topic | warning | ✅ | 마지막 수신 후 stale_timeout 초과 |
| `topic_disconnected` | topic | error | ✅ | 이전 발견된 Topic이 Graph에서 사라짐 |
| `monitor_status_<level>` | monitor_status | warning~critical | ❌ | MonitorStatus 메시지의 level 필드 |
| `service_disconnected` | service | error | ✅ | 등록된 Service가 Graph에서 사라짐 |
| `service_call_timeout` | service | warning | ✅ | 사용자 Service Call 타임아웃 |
| `service_call_failed` | service | error | ✅ | 사용자 Service Call 실패 |
| `action_disconnected` | action | error | ✅ | 등록된 Action이 Graph에서 사라짐 |
| `action_goal_aborted` | action | error | ✅ | Goal이 서버에 의해 중단 |
| `action_goal_canceled` | action | warning | ✅ | Goal이 취소됨 |
| `action_goal_rejected` | action | warning | ✅ | Goal이 서버에 의해 거부 |
| `action_goal_send_failed` | action | error | ✅ | Goal 전송 또는 Accept 타임아웃 |
| `action_result_timeout` | action | warning | ✅ | Result 응답 대기 타임아웃 |
| `action_result_unavailable` | action | error | ✅ | Result 수신 또는 lookup 실패 |
| `node_stale` | node | error | ✅ | 이전 발견된 Node가 Graph에서 사라짐 |

---

## 관련 상수 및 설정

| 상수/설정 | 값 | 위치 | 역할 |
|---|---|---|---|
| `ALERT_RESOLVED_RETENTION_SEC` | `60.0초` | `ros2_topic/alerts.py:24` | Resolved Alert 화면 유지 시간 |
| `history_limit` (retain_alerts) | `50건` | `ros_monitor.py:876` | Monitor 이력 최대 보관 수 |
| `HISTORY_LIMIT` (Backend) | `50건` | `backend/app/alerts/policy.py:3` | Backend 이력 최대 보관 수 |
| `poll_interval_sec` | `1.0초` | `monitor.yaml` | Alert 재판정 주기 |
