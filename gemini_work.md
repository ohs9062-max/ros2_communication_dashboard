# Service 및 Action QoS `compatible(호환)` 상태 반영 작업 보고서

## 1. 수정한 파일

| 파일 경로 | 수정 내용 |
|---|---|
| [`ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/qos_profiles.py`](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/qos_profiles.py) | • `_is_service_profile_compatible()` 헬퍼 추가 (Manual/Auto QoS 제약 검증)<br>• `_execution_state()` 및 `_split_service_state()`에 `qos_status` 및 `qos_detection_source` 산출 로직 추가 |
| [`ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/service_snapshot.py`](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/service_snapshot.py) | • `assemble_service_snapshot()`에서 Client 생성 시 `compatible`/`partial`/`incompatible` 상태를 Service snapshot에 반영하도록 조건 분기 보완 |
| [`ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/action_snapshot.py`](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/action_snapshot.py) | • `assemble_action_snapshot()`에서 Client 생성 시 5개 채널의 `compatible`/`partial`/`incompatible` 상태를 Action 채널 snapshot에 반영하도록 조건 분기 보완 |
| [`ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/subscription_lifecycle.py`](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/subscription_lifecycle.py) | • `merge_action_topic_local_qos()`에서 Feedback/Status 채널의 `compatible` 상태가 관찰 결과에 정상 병합되도록 조건 보완 |
| [`ros2_ws/src/ros2_dashboard_monitor/test/test_interface_execution_qos.py`](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/test/test_interface_execution_qos.py) | • Service Auto/Manual 호환/불일치 상태 검증 테스트 추가<br>• Service 및 Action Snapshot의 `compatible` 갱신 통합 검증 테스트 추가 |

---

## 2. compatible 상태를 어떤 조건에서 반영하도록 변경했는지

1. **Auto Mode**:
   - Fast DDS Discovery로 발견된 Server Request Reader와 Response Writer를 만족하는 단일 Client `QoSProfile`이 정상 산출되고 fallback이 발생하지 않은 경우(`fallback_reason is None`), `qos_status: 'compatible'`, `qos_detection_source: 'fastdds_discovery'`로 설정합니다.
2. **Manual Mode**:
   - 사용자가 지정한 수동 `QoSProfile`이 원격 Server Request Reader(Reliability, Durability, Liveliness, Deadline, Lease Duration 요구조건) 및 Response Writer(제공조건)의 상·하한 호환 제약을 모두 충족하면 `qos_status: 'compatible'`을 부여하고, 제약을 위반하면 `qos_status: 'incompatible'`을 부여합니다.
3. **Snapshot 조립 시점 (`service_snapshot.py`, `action_snapshot.py`)**:
   - Dashboard Client가 생성된 상태(`client_created == True`)에서 산출된 `applied_qos`의 `qos_status`가 `{'compatible', 'partial', 'incompatible'}` 중 하나이면 snapshot의 `qos_status`를 해당 값으로 승격시킵니다.
   - **Client가 아직 생성되지 않은 상태**에서는 기존과 동일하게 Passive Discovery 관찰 상태인 `observed`(`QoS 발견` 파란 배지)를 안전하게 유지합니다.

---

## 3. 기존 배지를 그대로 재사용했는지

- **네, 기존 배지 및 스타일을 100% 그대로 재사용했습니다.**
- Frontend [`frontend/src/components/QosSummary.jsx`](file:///home/hs/rang/ros2_dashboard/frontend/src/components/QosSummary.jsx)의 `QosStatusBadge`에 이미 `compatible: ['QoS 호환', 'good']` (초록색 배지) 렌더링이 구현되어 있었으므로, 별도의 Frontend UI/CSS 수정 없이 백엔드 Snapshot 데이터의 `qos_status`가 `'compatible'`로 전달되면서 즉시 `QoS 호환(초록색)`으로 표출됩니다.

---

## 4. Service 검증 결과

- **Auto Mode**: Server 발견 시 양방향 호환 프로파일 선택 및 `qos_status: 'compatible'` 정상 반환 확인.
- **Manual Mode (호환)**: Server QoS 제약 범위 내 수동 설정 시 `qos_status: 'compatible'` 정상 반환 확인.
- **Manual Mode (불일치)**: Server QoS 제약을 벗어난 수동 설정 시(예: Server Writer는 Best Effort인데 Client Reader를 Reliable로 지정) `qos_status: 'incompatible'` 정상 반환 확인.
- **Snapshot 반영**: Interface Lab에서 Service Client 생성 시 `service['qos_status'] == 'compatible'` 및 `service['local_qos']` 정상 반영 확인.

---

## 5. Action 5채널 검증 결과

- **5개 채널 독립 검증**:
  - `goal` (Service): Fast DDS Discovery 기반 호환성 판정 → `compatible`
  - `result` (Service): Fast DDS Discovery 기반 호환성 판정 → `compatible`
  - `cancel` (Service): Fast DDS Discovery 기반 호환성 판정 → `compatible`
  - `feedback` (Topic): rclpy Graph QoS 기반 호환성 판정 → `compatible`
  - `status` (Topic): rclpy Graph QoS 기반 호환성 판정 → `compatible`
- **Action Snapshot 반영**: Client 생성 시 5개 채널 모두 `qos_status: 'compatible'`로 갱신되며, Frontend 집계 로직(`qosDisplayStatus`)에 따라 5개 채널이 모두 호환되면 Action 목록의 대표 배지도 `QoS 호환(초록색)`으로 정상 집계됨을 확인.

---

## 6. 기존 incompatible / Alert 로직 회귀 여부

- **회귀 없음 (정상 동작 유지)**:
  - Client 생성이 없거나 단방향만 발견된 미판정 상태에서는 기존 `observed`(`QoS 발견`)가 유지되어 불필요한 Alert를 유발하지 않습니다.
  - 실제로 호환되지 않는 QoS 설정 시 `incompatible` 상태가 정상 생성되어 기존 `service_qos_incompatible` 및 `action_qos_incompatible` Alert 생성·해제 파이프라인이 그대로 작동합니다.
  - Monitor 단위/통합 테스트 **251개 전체 Pass (0 Failure)** 및 Frontend 단위 테스트, lint, production build 모두 정상 통과했습니다.

---

## 해당 코드 작업에서 내가 알아야 할 것 3줄 요약

1. **Dashboard Client가 생성되었을 때 Fast DDS/Graph 관찰값과 비교해 호환성이 확인되면 `qos_status`가 `compatible`로 정상 승격되도록 Snapshot 조립 조건을 수정했다.**
2. **Action의 경우 5개 채널(Goal/Result/Cancel/Feedback/Status) 각각에 대해 호환성이 계산되어 Snapshot에 반영되며, 5개 모두 호환 시 전체 대표 배지가 `QoS 호환`이 된다.**
3. **기존 Frontend의 초록색 `QoS 호환` 배지를 그대로 재사용하므로 UI 변경 없이 즉시 화면에 반영되며, 불일치 시의 `incompatible` Alert 로직도 기존대로 완벽히 유지된다.**
