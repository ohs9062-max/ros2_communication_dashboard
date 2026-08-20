# ROS2 Dashboard QoS 진단 로직 조사 보고서

## 1. 한 문장 결론

> **Graph QoS 비교를 통한 통신 불일치 추정/진단 로직과 RMW incompatible event 콜백이 모두 코드에 실제로 완벽히 구현되어 작동하고 있습니다.**  
> 다만, Dashboard가 Topic을 자동 구독할 때 상대 Publisher의 QoS에 맞춰 Subscription을 자동 생성(Auto QoS)하므로 일반적인 1:1 상황에서는 불일치가 사전에 해소되어 화면에 잘 드러나지 않았던 것이며, 서로 다른 QoS를 가진 복수 Publisher가 존재하거나 Auto QoS로도 해결할 수 없는 불일치가 생기면 **QoS 배지(빨강/노랑), 원인 진단 패널, 3회 확인 후 발송되는 Alert(Warning/Error)** 로 명확히 표시됩니다.

---

## 2. Graph QoS 진단 로직 존재 여부

### 1) 로직 존재 확인: **실제로 존재함**
Graph 상의 Publisher와 Subscriber endpoint QoS를 수집하고, `rclpy.qos.qos_check_compatible()`을 실행하여 불일치 여부를 판정하는 로직이 2가지 계층으로 구현되어 있습니다.

1. **Graph 전체 양방향 관찰 (`observe_topic_qos`)**:
   - 파일: [ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos.py:L60-105](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos.py#L60-L105)
   - Graph 상의 모든 Publisher × 모든 Subscriber 조합을 전수 비교하여 불일치가 있는지 판정합니다.
2. **Dashboard 자체 구독 프로파일 선택 및 비교 (`choose_topic_qos`)**:
   - 파일: [ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos.py:L107-169](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos.py#L107-L169)
   - 원격 Publisher 후보들을 대상으로 Dashboard Subscription이 가장 많은 endpoint와 호환되는 profile을 자동 선택하고, 전체/일부/불일치 상태를 판정합니다.

### 2) 수집 및 비교 대상 8개 정책
[qos.py:L11-29](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos.py#L11-L29) `qos_profile_dict()`에서 다음 8개 정책을 추출하여 직렬화 및 비교합니다:
1. `reliability` (BEST_EFFORT / RELIABLE)
2. `durability` (VOLATILE / TRANSIENT_LOCAL)
3. `history` (KEEP_LAST / KEEP_ALL)
4. `depth` (int)
5. `deadline_ns` (int, nanoseconds)
6. `lifespan_ns` (int, nanoseconds)
7. `liveliness` (AUTOMATIC / MANUAL_BY_TOPIC)
8. `liveliness_lease_duration_ns` (int, nanoseconds)

### 3) 상태별 판정 기준 (실제 코드 기준)
- **`compatible`**: 모든 원격 endpoint 또는 Graph 내 모든 (Pub, Sub) 조합이 호환됨 (`QoSCompatibility.OK`).
- **`partial`**: Dashboard가 선택한 profile이 일부 원격 endpoint와만 호환됨 (`compatible_count > 0` and `compatible_count < total`).
- **`incompatible`**: `qos_check_compatible()`에서 `QoSCompatibility.ERROR`가 발생하거나, 모든 원격 endpoint와 통신 불가능함 (`compatible_count == 0`).
- **`observed`**: 한쪽(Publisher만 또는 Subscriber만) endpoint의 QoS는 발견했으나, 상대방이 없어 호환성 판정 전인 상태.
- **`unknown`**: Graph에서 endpoint QoS 정보를 전혀 확인할 수 없는 상태 (`publishers`와 `subscriptions` 모두 비어있음).

---

## 3. 실제 compatibility 계산 흐름

```text
[1. ROS2 Graph Endpoint QoS 수집]
Node.get_publishers_info_by_topic() / get_subscriptions_info_by_topic()
  ↓ (qos.py: endpoint_qos())
Reliability, Durability, Deadline, Lifespan, Liveliness, GID, Participant ID 추출

─────────────────────────────────────────────────────────────────────────────

[2. Graph 호환성 비교 및 자동 프로파일 선택]
• 전체 Graph 조합 비교: qos.py observe_topic_qos()
• Dashboard Subscription 프로파일 계산: qos.py choose_topic_qos()
  ↓
rclpy.qos.qos_check_compatible(pub_profile, sub_profile) 실행
  ↓
• OK → compatible
• 일부 OK / 일부 ERROR → partial (mismatch_policies 추출)
• 전체 ERROR → incompatible (mismatch_policies 추출, mismatch_reason 생성)

─────────────────────────────────────────────────────────────────────────────

[3. 수신 진단 (Reception Diagnosis) 결합]
ros2_topic/diagnostics.py: reception_diagnosis()
  ↓
미수신(never_received) 또는 수신중단(stale) 발생 시
• RMW 이벤트 확인됨 → cause: "qos_incompatible", certainty: "confirmed"
• Graph 불일치 확인됨 → cause: "qos_incompatible", certainty: "candidate"
• QoS 호환됨 → cause: "non_qos_receive_path", certainty: "candidate"

─────────────────────────────────────────────────────────────────────────────

[4. Snapshot 조립 및 Backend 전달]
ros2_topic/snapshot.py: build_topic_snapshot()
  ↓
FastAPI Backend (app/routers/monitoring.py, monitor_cache.py)
  ↓ /ws/monitor 및 REST API (/ros/topics)
Frontend 전달

─────────────────────────────────────────────────────────────────────────────

[5. Frontend 화면 렌더링 및 Alert 발송]
• 목록/상세: StatusBadge, QosStatusBadge, QosSummaryNotice, QosDetails (한글 번역)
• Alert 판정: qos_alerts.py: confirm_qos_alerts() (3회 연속 관찰 시 topic_qos_incompatible 발송)
```

---

## 4. RMW Incompatible Event 흐름

실제 ROS2 rclpy / RMW incompatible event 콜백이 구현되어 연결되어 있습니다.

1. **이벤트 콜백 생성**:
   - 파일: [qos.py:L188-212](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos.py#L188-L212)
   - `SubscriptionEventCallbacks(incompatible_qos=incompatible_qos_callback(state, 'topic_qos_incompatible'))`
2. **Subscription 생성 시 바인딩**:
   - 파일: [ros2_topic/subscription_lifecycle.py:L44-53](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/subscription_lifecycle.py#L44-L53)
   - `node.create_subscription(..., event_callbacks=subscription_events(qos, 'topic_qos_incompatible'))`
3. **이벤트 발생 시 동작**:
   - RMW 계층에서 QoS 불일치가 감지되면 `incompatible_qos_callback()`이 호출되어 `state` 딕셔너리에 즉시 반영됩니다:
     ```python
     state['qos_status'] = 'incompatible'
     state['qos_detection_source'] = 'incompatible_qos_event'
     state['mismatch_policies'] = [policy]
     state['mismatch_reason'] = f'RMW incompatible QoS event (policy={policy})'
     ```
4. **Alert 승격**:
   - [qos_alerts.py:L171-179](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos_alerts.py#L171-L179)의 `_alert_level()`에서 `qos_detection_source == 'incompatible_qos_event'`인 경우 즉시 **`error` 레벨**로 승격됩니다.

---

## 5. 실제 기기 QoS 불일치 시 화면 변화

> **시나리오**: 기기 Publisher는 `BEST_EFFORT`인데 Dashboard Subscriber가 `RELIABLE`로 설정되어 통신이 불가능한 경우

| 화면 | 실제 표시 내용 및 UI 문구 |
|---|---|
| **Overview** | • 상단 Alert 카운트: `경고(Warning)` 또는 `오류(Error)` 1건 증가<br>• 상태 분포 그래프(Topic): `red` 또는 `yellow` 상태 카운트 증가<br>• Alert 미리보기 카드에 해당 Topic Alert 노출 |
| **Topics 목록** | • **대표 상태 (`StatusBadge`)**: `미수신 (never_received)` (빨강)<br>• **QoS 보조 배지**: `QoS 불일치 확인` (RMW 이벤트 발생 시, 빨강) 또는 `QoS 불일치 가능` (Graph 비교 시, 노랑) ([topicTablePresentation.js:L75-78](file:///home/hs/rang/ros2_dashboard/frontend/src/features/topics/topicTablePresentation.js#L75-L78))<br>• **최근 데이터 (`latest`)**: `-`<br>• **Hz 배지**: `아직 수신 없음` (회색 배지) |
| **Topic 상세 패널** | • **상단 QoS 경고 (`QosSummaryNotice`)**: 빨간 박스<br>  - *"일부 Topic endpoint의 QoS가 호환되지 않습니다. (불일치 1/1 endpoint 조합)"*<br>  - *"불일치 정책: 신뢰성(Reliability)"*<br>• **수신 원인 진단 (`ReceptionDiagnosis`)**: 빨간/노란 박스<br>  - 확정 시: *"원인 확인 - Message reception failed because of a confirmed QoS incompatibility."*<br>  - 추정 시: *"원인 후보 - The publisher and Dashboard subscription have incompatible QoS settings. This is a likely cause of the missing messages."*<br>• **Topic QoS 접이식 영역 (`QosDetails`)**:<br>  - 호환 상태: `불일치`<br>  - 판정 근거: `RMW QoS 불일치 이벤트` 또는 `Graph QoS 호환성 비교`<br>  - 사유: *"BEST_EFFORT Publisher와 RELIABLE Subscription은 호환되지 않습니다."* 또는 *"RMW에서 QoS 불일치 이벤트가 확인되었습니다. (정책: 신뢰성(Reliability))"*<br>  - 하단 엔드포인트 목록에 Publisher와 Subscriber의 8대 QoS 값 대조표 표시 |
| **Alerts 목록** | • `topic_qos_incompatible` Alert 등록 (3회 연속 확인 후)<br>• Level: `error` (RMW 이벤트 또는 전체 불일치) / `warning` (일부 불일치)<br>• 메시지: *"Some Topic endpoints have incompatible QoS settings. (incompatible endpoint pairs: 1/1) Policies: reliability."*<br>• `topic_message_missing` Alert도 함께 표시되며, 원인 진단에 `topic_qos_incompatible` 링크 포함 |

---

## 6. warning / error 실제 판정표

[qos_alerts.py:L171-179](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos_alerts.py#L171-L179) 및 [alert_assembler.py](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/alert_assembler.py) 기준:

| 발생 조건 | 판정 근거 (`qos_detection_source`) | 최종 Alert Level | 화면 표시 배지 |
|---|---|---|---|
| **실제 RMW incompatible event 발생** | `incompatible_qos_event` | **`error`** | `QoS 불일치 확인` (빨강) |
| **Dashboard QoS와 모든 상대 endpoint가 incompatible** | `graph_profile_comparison` (`compatible_count == 0`) | **`error`** | `QoS 불일치` (빨강) |
| **Graph endpoint 중 일부만 incompatible** | `graph_endpoint_info` / `graph_profile_comparison` | **`warning`** | `QoS 불일치 가능` (노랑) |
| **일부 endpoint만 호환 (`partial`)** | `graph_profile_comparison` | **Alert 없음** (정상 필터) | `QoS 일부 호환` (노랑) |
| **한쪽 endpoint만 발견 (`observed`)** | `graph_endpoint_info` / `fastdds_discovery` | **Alert 없음** | `QoS 발견` (파랑) |
| **QoS 정보 부족 (`unknown`)** | `graph_unavailable` / `unavailable` | **Alert 없음** | `QoS 확인 불가` (회색) |
| **Fast DDS observer unavailable** | `fastdds_unavailable` | **Alert 없음** (모니터링 유지) | `QoS 확인 불가` (회색) |

---

## 7. missing / stale과 QoS 관계

- **동시 발생 여부**: **`topic_message_missing`과 `topic_qos_incompatible`는 동시에 발생할 수 있습니다.**
- **원인 연결 메커니즘**:
  - [ros2_topic/diagnostics.py:L8-116](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/diagnostics.py#L8-L116)의 `reception_diagnosis()`가 `topic_message_missing` (또는 `topic_stale`) Alert에 진단 정보(`diagnosis`)와 연관 Alert ID(`related_alert_ids: ['topic:<name>:topic_qos_incompatible']`)를 연결합니다.
  - 이를 통해 프론트엔드는 단순 미수신 오류가 아니라 **"QoS 불일치로 인한 미수신"** 임을 사용자에게 일원화하여 설명합니다.

---

## 8. Service / Action QoS 차이

1. **Service QoS**:
   - rclpy Graph API만으로는 Service Request/Response의 상세 DDS QoS를 알 수 없기 때문에, C++ 보조 프로세스인 **Fast DDS observer (`ros2_dashboard_dds_observer`)** 가 DDS Discovery 상의 Reader/Writer QoS를 읽어 `observed` 상태로 제공합니다.
   - Fast DDS observer가 없거나 다른 RMW 사용 시 `graph_unavailable` / `unknown`으로 표시되며, 오류 Alert를 발생시키지 않고 안전 fallback 합니다.
2. **Action QoS**:
   - Action을 단일 QoS로 뭉뚱그리지 않고 **5개 내부 채널(Goal Service, Result Service, Cancel Service, Feedback Topic, Status Topic)** 로 완전히 분리하여 진단합니다.
   - Feedback / Status Topic은 Topic과 동일하게 rclpy Graph 및 `subscription_events`를 사용하여 RMW incompatible event를 감지합니다.
   - Goal / Result / Cancel Service는 Fast DDS observer를 사용합니다.
   - Alert 발생 시에도 [qos_alerts.py:L54-70](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos_alerts.py#L54-L70)과 같이 `action:<name>:action_qos_incompatible:goal`, `action:<name>:action_qos_incompatible:feedback` 등 **채널별로 ID와 메시지가 분리되어 발송**됩니다.

---

## 9. 재현 명령 (CLI를 통한 최소 테스트 방법)

코드 수정 없이 터미널에서 ROS 2 표준 CLI를 사용해 의도적인 QoS 불일치를 발생시킬 수 있습니다.

### 단계 1: Publisher를 `BEST_EFFORT`로 실행
```bash
# 터미널 1: BEST_EFFORT 및 VOLATILE로 10Hz 발행
ros2 topic pub /demo_qos_test std_msgs/msg/String "data: 'qos test'" \
  --qos-reliability best_effort \
  --qos-durability volatile -r 10
```

### 단계 2: 상대 Subscriber를 `RELIABLE`로 실행 (Graph 상의 불일치 발생)
```bash
# 터미널 2: RELIABLE 및 TRANSIENT_LOCAL로 구독 시도 (호환 불가)
ros2 topic echo /demo_qos_test std_msgs/msg/String \
  --qos-reliability reliable \
  --qos-durability transient_local
```

### 단계 3: Dashboard 확인
1. **Topics 화면**: `/demo_qos_test`의 상태 열에 노란색 `QoS 불일치 가능` 또는 빨간색 `QoS 불일치` 배지 확인.
2. **Topic 상세 패널**:
   - `QoSSummaryNotice`에 `불일치 1/1 endpoint 조합`, `불일치 정책: 신뢰성(Reliability)` 노출 확인.
   - `Topic QoS` 영역을 열어 Publisher(`best_effort`)와 Subscriber(`reliable`) 간 사유 확인.
3. **Alerts 화면**: 3초(3회 Graph 갱신) 후 `topic_qos_incompatible` Alert(Warning 또는 Error) 발생 확인.
4. **해제 확인**: 터미널 2의 `ros2 topic echo`를 종료하면 불일치 원인이 사라져 Alert가 `resolved`로 자동 전환됨.

---

## 10. PPT에서 그대로 써도 되는 표현

-  **`Graph QoS 비교를 통해 일부 조건 불일치 시 Warning, RMW incompatible event 또는 전체 통신 불가 확인 시 Error 분류`**  
  (실제 코드 [qos_alerts.py:L171-179](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos_alerts.py#L171-L179)와 100% 일치)
-  **`Topic, Service, Action(5개 채널)의 QoS를 개별 엔드포인트 단위로 정밀 진단`**
-  **`순간적인 Discovery 누락 오경보를 방지하기 위해 3회 연속 관찰 후 Alert 승격`**
-  **`RMW incompatible event = 실제 middleware 호환 불가 확인`** (실제 `incompatible_qos` 콜백 구현됨)

---

## 11. PPT에서 수정/보완해야 하는 표현

- ⚠️ **"Graph 상에 Publisher가 존재하면 무조건 통신된다"는 식의 오해 소지 표현 수정**:
  - *수정안*: *"Publisher 존재 여부와 무관하게 Graph endpoint의 8대 QoS 정책을 상시 비교하고, 미수신 발생 시 단순 누락인지 QoS 불일치인지 원인을 자동 판별"*
- ⚠️ **"QoS가 안 맞으면 무조건 데이터가 끊긴다"는 식의 단순화 수정**:
  - *수정안*: *"Dashboard는 Auto QoS를 통해 상대 Publisher의 프로파일(BEST_EFFORT 등)을 자동 감지해 구독하므로 단일 노드 통신 단절을 사전 예방하며, Graph 상의 다자간 불일치는 즉시 진단하여 시각화"*

---

## 해당 코드 작업에서 내가 알아야 할 것 3줄 요약

1. **Dashboard에는 Graph endpoint의 8대 정책을 전수 비교하는 로직과 rclpy RMW incompatible event 콜백이 모두 실제로 존재하며, Warning/Error Alert 및 한국어 진단 패널로 연결되어 있다.**
2. **평소에 불일치를 잘 보지 못했던 이유는 Dashboard가 상대 노드의 QoS에 맞춰 Subscription 프로파일을 실시간 자동 변경(Auto QoS)하여 스스로 호환성을 맞추기 때문이다.**
3. **실제 불일치 발생 시 단순 미수신(missing)과 QoS 불일치(incompatible)가 분리되지 않고 원인 진단(reception_diagnosis)을 통해 "QoS 불일치로 인한 미수신"으로 통합 안내된다.**
