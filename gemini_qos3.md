# Topic / Service / Action QoS Incompatibility Alert 복구 후 해제(Resolve) 생명주기 보고서

## 1. 개요 및 목적
`/home/hs/rang/ros2_dashboard` 코드베이스를 기준으로 Topic, Service, Action 3개 통신에서 QoS 불일치(`*_qos_incompatible`) 발생 후 정상 QoS로 복구되었을 때, 기존 active Alert가 현재 Alert 목록에서 정상적으로 해제(resolve)되고 DB의 `resolved_at`이 갱신되며, 재발 시 새 row가 생성되는지 생명주기를 전수 조사하고 최소 수정을 적용한 보고서입니다.

---

## 2. 조사 및 수정 10개 핵심 항목

### 1) Topic 문제 원인
- **Subscription 캐시 조기 반환으로 인한 QoS 미갱신**:
  - `ros2_topic/subscription_lifecycle.py`의 `ensure_subscription`에서 이미 동일 type의 subscription이 존재할 때(`has_subscription`이 참) 즉시 `return` 처리되었습니다.
  - 이로 인해 외부 Publisher의 QoS가 변경·복구되거나 RMW incompatible event가 발생한 이후, Graph 상으로 호환 상태로 복구되었음에도 `entry['qos']`와 Subscription의 QoS 프로파일이 갱신되지 않았습니다.
- **RMW Event Callback의 Incompatible Latch**:
  - RMW incompatible event가 한 번 발생하면 `incompatible_qos_callback`이 `entry['qos']`를 `{qos_status: 'incompatible', qos_detection_source: 'incompatible_qos_event'}`로 설정한 뒤 영구 유지(latch)되었습니다.
  - `build_topic_snapshot`에서 `topic.update(latest['qos'])`를 수행하면서 stale한 `incompatible` 상태가 계속 덮어써져 snapshot의 `topic.qos_status`가 `incompatible`로 고정되었습니다.
- **Alert Candidate 지속 생성**:
  - `build_qos_alert_candidates`가 매 주기마다 `topic_qos_incompatible` candidate를 생성하여 Alert가 절대 resolve되지 않았습니다.

### 2) Service 조사 결과
- **ServiceClientPool의 캐시 고정**:
  - `ServiceClientPool.dashboard_state()`가 초기 생성 시점의 `_last_state`를 캐싱하고 있어, 원격 Service Server의 Fast DDS discovery QoS가 변경되거나 정상 호환 상태로 복구되었을 때 최신 `dds_qos_getter` 결과를 재평가하지 않았습니다.
- **Observation Token 누락 취약점**:
  - `qos_alerts.py`의 `_alert()`에서 확인 횟수(confirmation count) 토큰으로 Topic 전용인 `last_updated`만 참조하여 Service의 `updated_at`이 누락되던 취약점이 있었습니다.

### 3) Action 조사 결과
- **Feedback / Status Subscription 조기 반환**:
  - `ActionSubscriptionFacade._ensure_subscriptions`에서 동일 type entry가 존재하면 조기 반환되어 `feedback` 및 `status` subscription의 QoS 갱신이 누락되었습니다.
  - RMW incompatible event나 초기 불일치가 발생하면 `entry['qos']['feedback']` / `status`가 `incompatible`로 고정되었고, `merge_action_topic_local_qos`가 이 stale한 불일치 정보를 `action['qos'][channel]`에 계속 덮어써 `action_qos_incompatible:{channel}`이 영구 유지되었습니다.
- **ActionClientPool의 캐시 고정**:
  - `ActionClientPool.dashboard_state()` 역시 최신 Fast DDS discovery 및 Topic QoS를 재평가하지 않고 초기 생성 시점의 `_qos_by_key`를 반환하고 있었습니다.

### 4) stale/latch 상태 여부
- **네, 3개 통신 영역 모두에서 stale/latch 상태가 확인되었습니다.**
  - **Topic**: `entry['qos']`가 RMW event callback에 의해 `incompatible`로 latch된 후 Graph 복구 시 갱신되지 않음.
  - **Action**: `feedback`/`status` subscription의 `entry['qos']` 및 `ActionClientPool`의 `_qos_by_key`가 불일치 상태로 latch됨.
  - **Service**: `ServiceClientPool`의 `_last_state`가 원격 서버 QoS 복구 시 갱신되지 않고 초기 불일치 상태로 유지됨.

### 5) alert_key 및 레벨(warning/error) 조사 결과
- **`alert_key` 자체는 발생 시와 해제 시 완전히 동일하여 문제가 없었습니다.**
  - Topic: `topic:{name}:topic_qos_incompatible`
  - Service: `service:{name}:service_qos_incompatible`
  - Action: `action:{name}:action_qos_incompatible:{channel}`
- **warning / error level 변화**:
  - level 변화는 `alert_key`에 영향을 주지 않으므로 level 변화로 인해 resolve가 막히는 문제는 없었습니다.
- **Backend 및 DB 동기화**:
  - Backend `AlertHistoryService` 및 MariaDB Repository는 snapshot의 candidate에서 빠지면 즉시 `resolved_at`을 기록하도록 정상 구현되어 있었으며, 근본 원인은 Monitor의 snapshot에서 불일치 상태가 제거되지 않았던 것이었습니다.

### 6) 수정한 파일
1. `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/subscriptions.py`:
   - `build_subscription_entry`에 `qos_profile` 보존 필드 추가.
2. `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/subscription_lifecycle.py`:
   - `ensure_subscription`에서 QoS 프로파일 변경 시 subscription 재생성 및 동일 프로파일에서 호환 복구 시 `entry['qos']` in-place 갱신.
3. `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/subscription_lifecycle.py`:
   - `update_action_topic_subscriptions` 추가로 feedback/status subscription QoS 갱신 및 재생성 지원.
4. `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/subscription_facade.py`:
   - `_ensure_subscriptions`에서 기존 entry가 매칭될 때 `update_action_topic_subscriptions` 호출.
5. `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/service_client_pool.py`:
   - `dashboard_state()`에서 최신 Fast DDS discovery를 재평가하여 `_last_state` 갱신.
6. `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/service_call_runtime.py`:
   - `ServiceClientPool`에 `dds_qos_getter` 연결 및 `selection` 전달.
7. `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/action_client_pool.py`:
   - `dashboard_state()`에서 최신 5채널 QoS를 재평가하여 `_qos_by_key` 갱신.
8. `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos_alerts.py`:
   - `_qos_observation_token`에 `updated_at` 및 `detected_at` fallback 추가.
9. `ros2_ws/src/ros2_dashboard_monitor/test/test_topic_subscription_lifecycle.py`:
   - `ensure_subscription` 프로파일 변경 시 재생성 및 호환 복구 in-place 갱신 단위 테스트 추가.
10. `ros2_ws/src/ros2_dashboard_monitor/test/test_action_subscription_lifecycle.py`:
    - `update_action_topic_subscriptions` 프로파일 변경 시 재생성 및 호환 복구 단위 테스트 추가.
11. `ros2_ws/src/ros2_dashboard_monitor/test/test_qos_alerts.py`:
    - Service QoS alert recovery lifecycle 테스트 추가.
    - Action 5개 채널 독립 recovery lifecycle 테스트 추가.
    - Action 다중 채널 부분 복구 및 전체 복구 lifecycle 테스트 추가.
12. `.codex/WORK_LOG.md` & `.codex/CURRENT_STATUS.md`:
    - 작업 이력 및 검증 상태 갱신.

### 7) Topic 검증 결과
- `incompatible` 발생 시 3회 연속 확인 후 `topic_qos_incompatible` Alert 정상 생성 (active).
- 외부 Publisher가 호환 QoS로 변경되면 Subscription이 안전하게 교체되고, `entry['qos']`가 `compatible`로 갱신됨.
- 후보 목록에서 제외되어 기존 active Alert가 `resolved` 상태로 전이되고 DB `resolved_at` 기록 및 현재 Alert 목록에서 정상 제거됨을 검증.

### 8) Service 검증 결과
- Fast DDS Discovery 상 불일치 발생 시 3회 연속 확인 후 `service_qos_incompatible` Alert 정상 생성 (active).
- 원격 Service Server가 호환 QoS로 변경되거나 호환 Client 프로파일 적용 시 `dashboard_state()`가 최신 상태를 반영해 `compatible`로 복귀.
- `service_qos_incompatible` Alert가 정상 `resolved`로 전이되고 현재 Alert 목록에서 제거됨을 검증.

### 9) Action 5채널 검증 결과
- 5개 개별 채널(`goal`, `result`, `cancel`, `feedback`, `status`) 각각에 대해 독립적으로 `action_qos_incompatible:{channel}` Alert 생성 및 개별 resolve 검증 완료.
- **다중 채널 부분 복구 시나리오 검증**:
  - `goal`과 `feedback`이 동시 불일치 상태에서 `feedback`만 먼저 정상 복구된 경우: `action_qos_incompatible:feedback`은 즉시 `resolved` 처리되고, `action_qos_incompatible:goal`은 `active` 상태를 유지.
  - 이후 `goal`까지 정상 복구되면 남은 `goal` Alert도 `resolved` 처리됨.

### 10) 재발 시 새 row 생성 검증
- Alert가 `resolved` 처리되어 DB에 `resolved_at` 타임스탬프가 기록된 후, 다시 QoS 불일치가 발생하면 `AlertHistoryService` 및 MariaDB Repository가 기존 해결된 행을 보존하면서 새로운 `resolved_at = NULL`인 미해결 행(`INSERT`)을 생성함을 검증 완료.

---

## 3. 전체 테스트 검증 결과

```text
Monitor pytest: 258 passed (7개 신규 테스트 추가, 0 failure)
Backend pytest: 16 passed, 2 skipped (실시간 MariaDB 미연결 시 자동 skip)
Frontend build: pass (Vite production build 정상 완료)
```

---

## 4. 해당 코드 작업에서 내가 알아야 할 것 3줄 요약

1. Topic 및 Action의 내부 Subscription이 생성된 후에도 매 주기마다 외부 엔드포인트의 최신 QoS를 재평가하여, 호환 복구 시 이전 불일치 증거(stale latch)를 즉시 제거하고 Subscription을 안전하게 갱신하도록 수정했습니다.
2. Service 및 Action의 Client Pool이 Fast DDS discovery의 최신 상태를 매 주기 다시 확인하므로, 원격 서버의 QoS가 복구되면 대시보드 snapshot도 즉시 `compatible`로 전환됩니다.
3. QoS 불일치 해제 시 기존 Alert는 DB의 `resolved_at`을 갱신하며 현재 Alert 목록에서 사라지고, Action 5개 채널은 서로 간섭 없이 독립적으로 생성·유지·해제됩니다.
