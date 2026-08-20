# ROS2 Dashboard Service & Action QoS 진단 로직 조사 보고서

## 1. 한 문장 결론

> **Service와 Action Goal/Result/Cancel은 Fast DDS Observer(C++)를 통해 DDS Discovery 레벨에서 Request/Response QoS를 수집하고 단일 Client profile의 양방향 호환성을 계산하며, Action Feedback/Status는 Topic과 동일하게 rclpy Graph 비교 및 RMW incompatible event 콜백이 실제로 작동하고 채널별 Alert가 독립 생성됩니다.**

---

## 2. Service QoS 실제 구조

### 1) Fast DDS Observer 수집 메커니즘
- **Observer 소스 위치**: [ros2_ws/src/ros2_dashboard_dds_observer/src/fastdds_qos_observer.cpp](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_dds_observer/src/fastdds_qos_observer.cpp)
- **Monitor 수집 위치**: [ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py:L127-150](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py#L127-L150)
- **Fast DDS Discovery 사용 방식**:
  - `DomainParticipantFactory`를 통해 Discovery 전용 Participant(`ros2_dashboard_fastdds_qos_observer`)를 생성합니다 ([fastdds_qos_observer.cpp:L403-411](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_dds_observer/src/fastdds_qos_observer.cpp#L403-L411)).
  - `DomainParticipantListener`의 `on_subscriber_discovery` (Reader) 및 `on_publisher_discovery` (Writer) 콜백을 구현하여 DDS 엔드포인트를 수집합니다.
- **Request / Reply 구분 및 Service 이름 매핑** ([fastdds_qos_observer.cpp:L156-211](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_dds_observer/src/fastdds_qos_observer.cpp#L156-L211)):
  - `rq/<service_name>Request` DDS Topic:
    - Reader 발견 → **Server Request Reader** (`service_role = "server"`, `endpoint_kind = "reader"`, `service_channel = "request"`)
    - Writer 발견 → **Client Request Writer** (`service_role = "client"`, `endpoint_kind = "writer"`)
  - `rr/<service_name>Reply` DDS Topic:
    - Writer 발견 → **Server Response Writer** (`service_role = "server"`, `endpoint_kind = "writer"`, `service_channel = "response"`)
    - Reader 발견 → **Client Response Reader** (`service_role = "client"`, `endpoint_kind = "reader"`)
- **수집 항목 및 제약**:
  - `reliability`, `durability`, `liveliness`, `deadline`, `lifespan` (Writer), `liveliness_lease_duration`을 수집합니다.
  - DDS Discovery(EDP) 프로토콜 특성상 `history`와 `depth`는 패킷에 포함되지 않으므로 `history = "unknown"`, `depth = null`로 직렬화됩니다.
- **Monitor 조회 API**:
  - Observer는 내장 HTTP 서버(`127.0.0.1:8766`)를 실행하고, Monitor의 `FastDdsQosObserver`가 `GET /snapshot`을 0.5초 주기로 Polling합니다.

---

## 3. Service compatibility / Alert 흐름

### 1) Service 호환성 계산의 실체
- **패시브 모니터링 (Service Call 이전)**:
  - [dds_observer.py:L101-126](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py#L101-L126)의 `service_qos()`는 발견된 Server 엔드포인트들을 `status = 'observed'`, `source = 'fastdds_discovery'`로 반환합니다.
  - 패시브 상태에서는 Dashboard가 아직 Client를 생성하지 않았으므로 비교할 로컬 Client 프로파일이 없어 "상대 Server QoS가 관찰됨" 상태를 유지합니다.
- **Interface Lab 실행 시 (Client 생성 및 Service Call 시)**:
  - [interface_lab/execution/qos_profiles.py:L271-352](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/qos_profiles.py#L271-L352)의 `_compatible_service_profile()`이 실행됩니다.
  - **양방향 호환성 계산 로직**: ROS2의 Service Client는 Request와 Response에 대해 단 1개의 `QoSProfile`만 가질 수 있습니다. 따라서 `_select_service_policy`와 `_select_service_duration`이 다음을 계산합니다:
    - Request Reader(서버의 요구조건)와 Response Writer(서버의 제공조건)를 동시에 만족하는 Client 프로파일 교집합 산출.
    - 교집합이 없으면 fallback 처리 (`"A single Client profile cannot satisfy the remote Request and Response QoS. The default ROS2 QoS is used."`).
  - 사용자가 Request와 Response의 Manual QoS를 다르게 지정하면 `ExecutionQosError`를 발생시킵니다 ([qos_profiles.py:L210-215](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/qos_profiles.py#L210-L215)).

### 2) Service RMW Incompatible Event 존재 여부
- **Service에는 rclpy / RMW 차원의 `incompatible_qos` event callback이 존재하지 않습니다.**  
  (ROS2 rclpy의 `node.create_client()` 및 `node.create_service()` API는 `SubscriptionEventCallbacks` 같은 이벤트 콜백 인자를 지원하지 않습니다.)
- 따라서 Service의 실제 통신 불가는 **A (Fast DDS Discovery 정보 비교 추정)** 와 **B (Service Call 실제 실패/Timeout)** 의 조합으로 확인됩니다.

### 3) Service Alert 발생 및 Warning / Error 기준
- **`service_call_timeout`** ([ros2_service/alerts.py:L24-45](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/alerts.py#L24-L45)):  
  사용자 Service Call 전송 후 timeout 발생 시 → **`warning`**
- **`service_call_failed`** ([ros2_service/alerts.py:L47-74](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/alerts.py#L47-L74)):  
  Service Call 실패(오류 응답, 전송 실패) 시 → **`error`**
- **`service_disconnected`** ([ros2_service/alerts.py:L76-95](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/alerts.py#L76-L95)):  
  Graph에서 Server가 사라졌을 때 → **`error`**
- **`service_qos_incompatible`** ([qos_alerts.py:L40-52](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos_alerts.py#L40-L52)):  
  Interface Lab Client의 QoS 불일치가 3회 연속 확인된 경우:
  - 모든 상대 endpoint와 불일치 시 → **`error`**
  - 일부 endpoint만 불일치 시 → **`warning`**
- **주의**: Service에는 Topic의 `reception_diagnosis()` 같은 "미응답 원인 = QoS 불일치" 자동 진단 연계 로직은 없으며, Call 실패 Alert와 QoS Alert가 독립적으로 발생합니다.

---

## 4. Service 실제 불일치 화면

| 화면 영역 | 실제 UI 컴포넌트 및 표시 문구 |
|---|---|
| **Services 목록** | • **상태 배지**: `호출 실패 (failed)` (빨강) 또는 `타임아웃 (timeout)` (노랑)<br>• **QoS 배지 (`QosStatusBadge`)**: 패시브 관찰 시 `QoS 발견` (파랑), 불일치 발생 시 `QoS 불일치` (빨강), 호환 시 `QoS 호환` (초록), Observer 미작동 시 `QoS 확인 불가` (회색)<br>• **Server / Client Node 수**: `Server Node 수 (Dashboard 제외)` 및 `Client Node 수`<br>• **마지막 Request / Response**: JSON 미리보기 버튼<br>• **마지막 응답 시간**: `--- ms` 또는 실행 시간 |
| **Service 상세 패널** | • **QoS 경고 (`QosSummaryNotice`)**: `QoS 불일치가 감지되었습니다.` (빨간 박스)<br>• **Service QoS (`QosDetails`)**:<br>  - 호환 상태: `DDS Discovery 관찰됨` (패시브) 또는 `불일치`<br>  - 판정 근거: `Fast DDS Discovery` 또는 `안전 fallback`<br>  - 사유: *"Fast DDS를 통해 상대 Service endpoint QoS를 발견했습니다. Discovery에서는 History와 Depth를 확인할 수 없습니다."* 또는 *"하나의 Client profile로 상대 Request와 Response QoS를 모두 만족할 수 없어 ROS2 기본 QoS를 사용합니다."*<br>  - **엔드포인트 그룹**:<br>    • `Response 통신 (Server Response Writer)`: Reliability, Durability 등<br>    • `Request 통신 (Server Request Reader)`: Reliability, Durability 등 |
| **Alerts 목록** | • `service_call_timeout` (Warning) 또는 `service_call_failed` (Error) 발생<br>• 불일치 확정 시 `service_qos_incompatible` (Warning 또는 Error) 발생 |

---

## 5. Action 5채널 QoS 구조

Action은 단일 통신이 아니라 **5개의 독립 통신 채널**로 구성되며, Dashboard는 이를 실제로 분리 수집 및 진단합니다 ([ros2_action/subscription_lifecycle.py:L73-86](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/subscription_lifecycle.py#L73-L86)).

```text
Action (<name>)
├─ Goal Service     (<name>/_action/send_goal)   → Fast DDS Observer (Service)
├─ Result Service   (<name>/_action/get_result)  → Fast DDS Observer (Service)
├─ Cancel Service   (<name>/_action/cancel_goal) → Fast DDS Observer (Service)
├─ Feedback Topic   (<name>/_action/feedback)    → rclpy Graph (Topic) + RMW Event
└─ Status Topic     (<name>/_action/status)      → rclpy Graph (Topic) + RMW Event
```

---

## 6. Action compatibility / Alert 흐름

### 1) 채널별 수집 및 RMW 이벤트 매핑표

| Action 채널 | 통신 형태 | QoS 수집 방식 | compatibility 계산 | 실제 RMW incompatible event |
|---|---|---|---|---|
| **Goal** | Service | Fast DDS Observer | `resolve_service_execution_qos` (Call 시) | ❌ 없음 (Service Client) |
| **Result** | Service | Fast DDS Observer | `resolve_service_execution_qos` (Call 시) | ❌ 없음 (Service Client) |
| **Cancel** | Service | Fast DDS Observer | `resolve_service_execution_qos` (Call 시) | ❌ 없음 (Service Client) |
| **Feedback** | Topic | rclpy Graph | `choose_topic_qos()` + `observe_topic_qos()` |  **`SubscriptionEventCallbacks` 구현됨** |
| **Status** | Topic | rclpy Graph | `choose_topic_qos()` + `observe_topic_qos()` |  **`SubscriptionEventCallbacks` 구현됨** |

### 2) Action Feedback / Status의 RMW Event 흐름
1. **Subscription 생성**: [ros2_action/subscription_lifecycle.py:L147-155, L198-206](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/subscription_lifecycle.py#L147-L206)에서 `node.create_subscription()` 호출 시 `event_callbacks=subscription_events(qos, 'action_feedback_qos_incompatible')` 등록.
2. **이벤트 발생**: RMW 불일치 시 `incompatible_qos_callback()`이 `qos['feedback']`의 `qos_status = 'incompatible'`, `qos_detection_source = 'incompatible_qos_event'`로 즉시 변경.
3. **Snapshot 병합**: [ros2_action/subscription_lifecycle.py:L89-119](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/subscription_lifecycle.py#L89-L119)의 `merge_action_topic_local_qos()`가 Action snapshot에 반영.
4. **Alert 분리 발송**: [qos_alerts.py:L54-70](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos_alerts.py#L54-L70)에서 **`action:<name>:action_qos_incompatible:feedback`** 형태로 채널을 명시한 독립 Alert 생성 (3회 연속 확인 시 `error` 레벨 승격).

### 3) Action 전체 QoS 상태 합성 규칙 (`QosSummary.jsx:L49-62`)
- 5개 채널 중 **1개라도 `incompatible`이면 전체 상태는 `incompatible` (빨강)**
- 5개 채널 중 `incompatible`이 없고 1개라도 `partial`이면 `partial` (노랑)
- 5개 채널 모두 `compatible`이면 `compatible` (초록)
- 모두 `observed` 또는 `compatible`이면 `observed` (파랑)
- 그 외 `unknown` (회색)

---

## 7. Action 실제 불일치 화면

> **시나리오**: Goal/Result/Cancel/Status는 정상(`compatible`), **Feedback Topic만 불일치(`incompatible`)** 인 경우

| 화면 영역 | 실제 UI 컴포넌트 및 표시 문구 |
|---|---|
| **Actions 목록** | • **상태 배지**: `정상 (active)`<br>• **QoS 배지 (`QosStatusBadge`)**: 합성 규칙에 따라 **`QoS 불일치` (빨강 배지)** 표시<br>• **마지막 Goal 상태**: `정상` / `성공` / `대기` |
| **Action 상세 패널** | • **QoS 경고 (`QosSummaryNotice`)**: 빨간 박스<br>  - *"Action Feedback Topic의 QoS가 호환되지 않습니다."*<br>  - *"Feedback Topic: 신뢰성(Reliability)"*<br>• **Action 내부 통신 QoS (`QosDetails`)**:<br>  - **Service 통신 (Goal · Result · Cancel)**: `정상` (초록 Pill)<br>  - **Topic 통신 (Feedback · Status)**: `불일치` (빨강 Pill)<br>    • `Feedback Topic`: **`불일치`** (빨강) / 판정 근거: `RMW QoS 불일치 이벤트` / 사유: *"BEST_EFFORT Publisher와 RELIABLE Subscription은 호환되지 않습니다."*<br>    • `Status Topic`: **`호환`** (초록) |
| **Alerts 목록** | • Alert ID: **`action:/navigate_to_pose:action_qos_incompatible:feedback`**<br>• Level: `error` (RMW 이벤트 발생 시) 또는 `warning` (Graph 일부 불일치 시)<br>• 메시지: *"Action Feedback Topic QoS is incompatible. Policies: reliability."*<br>• **Alert 클릭 시**: Action 상세 패널이 열리면서 Feedback Topic의 QoS 영역으로 자동 스크롤 및 펼침 (`data-qos-part="feedback"` 포커스) |

---

## 8. Fast DDS Observer 장애 시 fallback

Fast DDS Observer 프로세스(`:8766`)가 실행되지 않았거나 비정상 종료된 경우:

1. **Service QoS**: `qos_status = 'unknown'`, `qos_detection_source = 'graph_unavailable'` (또는 `fastdds_unavailable`)로 설정됩니다 ([dds_observer.py:L206-213](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py#L206-L213)).
2. **Action Goal / Result / Cancel**: `qos_status = 'unknown'`, `qos_detection_source = 'graph_unavailable'`로 설정됩니다.
3. **Action Feedback / Status**: **rclpy Graph API를 직접 사용하므로 Fast DDS Observer 유무와 전혀 무관하게 100% 정상 수집 및 호환성 비교, RMW 이벤트 감지가 동작합니다.**
4. **QoS Alert 영향**: `unknown`, `observed`, `graph_unavailable`, `fastdds_unavailable`은 [qos_alerts.py:L102-114](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos_alerts.py#L102-L114)에 의해 **QoS Alert 후보에서 완전히 제외되므로 오경보 Alert가 발생하지 않는 안전 fallback**입니다.
5. **일반 모니터링 영향**: Graph 상의 Service/Action 노드 목록, Server/Client 수, Interface Lab 호출 등 **모니터링 기능은 전혀 중단되지 않고 정상 작동**합니다.

---

## 9. Topic / Service / Action 비교표

| 구분 | Topic | Service | Action Goal / Result / Cancel | Action Feedback / Status |
|---|---|---|---|---|
| **QoS 수집 원천** | rclpy Graph API | Fast DDS Observer (C++ `:8766`) | Fast DDS Observer (C++ `:8766`) | rclpy Graph API |
| **호환성 계산 시점** | 상시 (Graph 갱신 시) & 구독 시 | Interface Lab Client 생성/호출 시 | Interface Lab Client 생성/호출 시 | 상시 (Graph 갱신 시) & 구독 시 |
| **ROS2 Graph 사용** |  예 | ❌ (Client/Server 수만 확인) | ❌ (Client/Server 수만 확인) |  예 |
| **Fast DDS Observer 사용** | ❌ 아니오 |  **예 (필수)** |  **예 (필수)** | ❌ 아니오 |
| **RMW Incompatible Event** |  **지원 (`SubscriptionEventCallbacks`)** | ❌ **미지원 (ROS2 Client 한계)** | ❌ **미지원 (ROS2 Client 한계)** |  **지원 (`SubscriptionEventCallbacks`)** |
| **QoS Alert Warning 가능** |  예 (일부 불일치) |  예 (일부 불일치) |  예 (일부 불일치) |  예 (일부 불일치) |
| **QoS Alert Error 가능** |  예 (RMW 이벤트/전체 불일치) |  예 (전체 불일치) |  예 (전체 불일치) |  예 (RMW 이벤트/전체 불일치) |
| **Alert ID 형식** | `topic:<name>:topic_qos_incompatible` | `service:<name>:service_qos_incompatible` | `action:<name>:action_qos_incompatible:<channel>` | `action:<name>:action_qos_incompatible:<channel>` |
| **Observer 장애 시 동작** | 정상 작동 (영향 없음) | `unknown` (오경보 없음, 안전 fallback) | `unknown` (오경보 없음, 안전 fallback) | **정상 작동 (영향 없음)** |

---

## 10. 현재 PPT 설명의 정확성

현재 PPT 카드 내용:
```text
TOPIC: rclpy Graph QoS (Publisher / Subscription endpoint QoS 관찰)
SERVICE / ACTION: Fast DDS discovery (DDS Request/Reply 및 Action channel endpoint 관찰)
INTERFACE LAB: Auto / Manual QoS (실행 대상 QoS 자동 선택 또는 직접 지정)
RUNTIME: RMW incompatible event (실제 middleware 호환 불가 확인)
```

###  검증 결과 및 오해 소지:
1. **`SERVICE / ACTION` 카드**:
   - "Action channel endpoint 전체를 Fast DDS로 본다"고 오해하기 쉽습니다.
   - 실제로는 **Action Goal/Result/Cancel(Service 3개)만 Fast DDS**를 쓰고, **Feedback/Status(Topic 2개)는 rclpy Graph**를 씁니다.
2. **`RUNTIME / RMW incompatible event` 카드**:
   - 마치 Service나 Action Goal/Result/Cancel에서도 RMW incompatible event가 발생하는 것처럼 오해될 수 있습니다.
   - 실제로는 **Topic 및 Action Feedback/Status(Topic 채널)** 에만 RMW event callback이 존재합니다. (Service Client에는 ROS2 구조상 RMW event가 없음).

---

## 11. 추천 PPT 최종 문구

실제 코드 구조와 100% 일치하는 권장 PPT 4개 카드 구성입니다:

```text
[TOPIC & ACTION FEEDBACK/STATUS]
• rclpy Graph 8대 QoS 정책 상시 수집 및 전수 호환성 비교
• Auto QoS 자동 프로파일 선택 및 다자간 통신 불일치 감지

[SERVICE & ACTION GOAL/RESULT/CANCEL]
• Fast DDS Discovery C++ Observer (127.0.0.1:8766) 연동
• DDS Request/Reply 양방향 엔드포인트 관찰 및 단일 Client Profile 호환성 판정

[INTERFACE LAB (AUTO / MANUAL)]
• 실행 대상 노드의 QoS를 자동 매칭(Auto)하거나 직접 지정(Manual)
• Request/Response 단일 프로파일 제약 검증 및 안전 Fallback

[RUNTIME EVENT & DIAGNOSIS]
• Middleware(RMW) incompatible QoS 이벤트 콜백 실시간 수신
• 3회 연속 관찰 시 Warning/Error Alert 승격 및 미수신 원인 자동 진단 연계
```

---

## 12. 최종 10개 질문 직답

1. **Service에도 QoS compatibility 계산이 실제로 존재하는가?**  
   👉 **예, 존재합니다.** Interface Lab Client 생성 시 Request Reader와 Response Writer를 단일 Client 프로파일로 양방향 만족시킬 수 있는지 `_compatible_service_profile()`에서 계산합니다.
2. **Service QoS는 어디까지가 “관찰”이고 어디부터 “불일치 판정”인가?**  
   👉 패시브 모니터링 중에는 Fast DDS Discovery로 Server 엔드포인트를 수집하는 **`observed` (관찰)** 단계이며, Interface Lab에서 Client 프로파일을 매칭하거나 사용자가 수동 설정할 때 **`compatible / incompatible` (불일치 판정)** 으로 전환됩니다.
3. **Service에는 Topic 같은 RMW incompatible event가 존재하는가?**  
   👉 **아닙니다, 존재하지 않습니다.** ROS2 rclpy의 Service Client/Server API에는 incompatible event callback이 없습니다.
4. **Service가 실제 QoS 때문에 통신 불가하면 Dashboard는 어떻게 알게 되는가?**  
   👉 Fast DDS Discovery 프로파일 비교 불일치와, 실제 Service Call 전송 시 발생하는 **`service_call_timeout` (Warning)** 및 **`service_call_failed` (Error)** 실행 결과를 통해 감지합니다.
5. **Action 5개 채널은 각각 어떤 방식으로 QoS를 확인하는가?**  
   👉 **Goal/Result/Cancel (Service 3개)** 은 Fast DDS Observer(`:8766`)를 통해 확인하고, **Feedback/Status (Topic 2개)** 는 rclpy Graph API를 통해 확인합니다.
6. **Action Feedback/Status에 RMW incompatible event가 실제 존재하는가?**  
   👉 **예, 실제로 완벽히 구현되어 있습니다.** `subscription_events(qos, 'action_feedback_qos_incompatible')`가 등록되어 RMW 이벤트 발생 시 즉시 감지합니다.
7. **Goal/Result/Cancel에는 실제 incompatible event가 존재하는가?**  
   👉 **없습니다.** Service와 마찬가지로 rclpy ActionClient의 Service 채널에는 RMW event callback이 지원되지 않습니다.
8. **`service_qos_incompatible`, `action_qos_incompatible` warning/error는 정확히 어떤 근거로 결정되는가?**  
   👉 `incompatible_qos_event`가 발생했거나 모든 상대 엔드포인트와 통신 불가능하면 **`error`**, 일부 엔드포인트만 불일치하면 **`warning`** 으로 결정됩니다 (3회 연속 확인 필수).
9. **실제 장비에서 Service/Action QoS가 안 맞으면 사용자 화면에 무엇이 보이는가?**  
   👉 Service는 `QoS 불일치` 배지와 `service_call_failed/timeout` Alert가 보이며, Action은 목록에 빨간 `QoS 불일치` 배지가 뜨고 상세 패널에서 **문제 채널(Feedback 등)만 빨간색으로 펼쳐지며** `action:<name>:action_qos_incompatible:<channel>` Alert가 표시됩니다.
10. **현재 PPT의 QoS 설명을 어떻게 바꾸는 것이 가장 정확한가?**  
    👉 Action을 단일 DDS로 설명하지 말고 **"Service 채널(Fast DDS) + Topic 채널(rclpy Graph & RMW Event)"** 로 분리 명시하고, RMW Event는 Topic 및 Action Feedback/Status에 해당함을 명확히 구분하는 것이 가장 정확합니다.

---

### 해당 코드 작업에서 내가 알아야 할 것 3줄 요약

1. **Service 및 Action Goal/Result/Cancel은 Fast DDS Observer(C++ `:8766`)를 통해 Request/Response DDS QoS를 관찰하고 단일 Client profile의 양방향 호환성을 계산한다.**
2. **Action Feedback/Status는 Topic과 동일하게 rclpy Graph 및 RMW incompatible event 콜백이 완전히 구현되어 있어 채널별 독립 Alert(`:feedback`, `:status`)가 발송된다.**
3. **Fast DDS Observer가 꺼져도 Action Feedback/Status를 포함한 일반 모니터링은 100% 정상 작동하며, Service QoS만 안전하게 `unknown`으로 처리되어 오경보가 방지된다.**
