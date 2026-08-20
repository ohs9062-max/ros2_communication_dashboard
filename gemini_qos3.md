# ROS2 Dashboard Service QoS `QoS 발견(observed)` 표시 원인 분석 보고서

## 1. 한 문장 결론

> **Fast DDS Observer 수집 단계에서 Client 엔드포인트를 의도적으로 필터링(무시)하고 Server만 수집하도록 되어 있으며, Interface Lab에서 Client를 생성할 때 호환 프로파일을 계산하더라도 `service_snapshot.py`에서 `qos_status`를 `compatible`로 승격하지 않고 `observed` 상태를 그대로 유지하기 때문입니다.**

---

## 2. 현재 `QoS 발견`이 나오는 실제 이유

Frontend에서 `QoS 발견` 배지가 출력되는 과정은 다음과 같습니다:

```text
FastDdsQosObserver.service_qos()
→ status='observed', source='fastdds_discovery' 반환
→ ServiceRuntime.update()에서 service['qos_status'] = 'observed' 저장
→ service_snapshot.py에서 client_created 시 local_qos만 넣고 qos_status는 미갱신
→ Backend /ros/services 응답의 qos_status = 'observed'
→ Frontend QosSummary.jsx: qosDisplayStatus() → 'observed'
→ QosStatusBadge: display['observed'] → ['QoS 발견', 'observed']
```

### 관련 코드 위치:
1. **Monitor QoS 상태 반환**:
   - 파일: [ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py:L115-125](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py#L115-L125)
   - `FastDdsQosObserver.service_qos()`는 Server 엔드포인트를 발견하면 **`status='observed'`를 고정 반환**합니다.
2. **Frontend 배지 렌더링**:
   - 파일: [frontend/src/components/QosSummary.jsx:L11-21, L64-73](file:///home/hs/rang/ros2_dashboard/frontend/src/components/QosSummary.jsx#L11-L21)
   - `qos.qos_status === 'observed'`일 때 `['QoS 발견', 'observed']` (정보색 파란 배지)로 렌더링됩니다.
3. **Frontend 상세 패널 문구**:
   - 파일: [frontend/src/components/QosDetails.jsx:L357-367](file:///home/hs/rang/ros2_dashboard/frontend/src/components/QosDetails.jsx#L357-L367)
   - `qos_detection_source === 'fastdds_discovery' && qos_status === 'observed'`일 때 **`"DDS Discovery 관찰됨"`** 으로 표시됩니다.

---

## 3. Dashboard Client 생성 후 실제 DDS endpoint 상태

### 1) C++ Observer 레벨 (`:8766`)
[fastdds_qos_observer.cpp:L198-201](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_dds_observer/src/fastdds_qos_observer.cpp#L198-L201)에서 DDS Discovery를 통해 다음 4개 엔드포인트를 모두 감지할 수 있습니다:
- Server Request Reader (`service_role = "server"`, `channel = "request"`)
- Server Response Writer (`service_role = "server"`, `channel = "response"`)
- Client Request Writer (`service_role = "client"`, `channel = "request"`)
- Client Response Reader (`service_role = "client"`, `channel = "response"`)

### 2) Monitor Python 레벨에서의 필터링 (핵심!)
[ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py:L155-164](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py#L155-L164):
```python
def _replace_snapshot(self, snapshot: dict[str, Any]) -> None:
    endpoints_by_service: dict[str, list[dict[str, Any]]] = {}
    for endpoint in snapshot.get('endpoints', []):
        service_name = endpoint.get('service_name')
        if not service_name or endpoint.get('service_role') != 'server':
            continue  # <-- service_role == 'client'는 여기서 전부 버려집니다!
        endpoints_by_service.setdefault(str(service_name), []).append(endpoint)
```
- **`dds_observer.py`가 `service_role != 'server'`인 엔드포인트(Dashboard Client 포함 모든 Client)를 명시적으로 무시하고 버립니다.**
- 따라서 Monitor 내부의 `_server_endpoints_by_service`에는 Server의 Request Reader와 Response Writer만 남게 됩니다.

---

## 4. Client가 있는데도 `compatible`이 안 되는 근본 원인 (A~H 판정)

제시해주신 가능성 중 **B, C, F, H가 결합된 코드상의 구조적 원인**입니다:

| 항목 | 판정 | 실제 코드 근거 |
|---|---|---|
| **A. 호환성 계산 부재** | ❌ (계산 함수는 있음) | `qos_profiles.py`의 `_compatible_service_profile()`이 양방향 호환 프로파일을 계산함 |
| **B. Client ↔ Server 짝 매칭 안 함** |  **원인 일치** | `dds_observer.py:L158`에서 Client 엔드포인트를 버려 DDS 레벨에서 Client ↔ Server를 짝지어 비교하는 로직이 없음 |
| **C. Observer가 Server만 수집해 `observed`에 머묾** |  **원인 일치** | `dds_observer.py:L115`의 `FastDdsQosObserver.service_qos()`가 `status='observed'`를 고정 반환함 |
| **D. 내부 self endpoint 제외** | ❌ (DDS 레벨 버림) | 내부 노드 제외 이전에 DDS Observer 단계에서 모든 Client가 필터링됨 |
| **E. Service ↔ DDS 이름 매핑 실패** | ❌ (정상 매핑됨) | `rq/...Request`, `rr/...Reply` 파싱은 정상 작동함 |
| **F. Snapshot 조립 시 호환성 갱신 누락** |  **결정적 원인** | `service_snapshot.py:L89`에서 `incompatible`일 때만 `qos_status`를 갱신하고, 정상 호환 시 `observed`를 그대로 방치함 |
| **G. Frontend 표시 버그** | ❌ (정상 동작) | Frontend는 Backend가 내려준 `qos_status: 'observed'`를 그대로 렌더링하고 있음 |

### 결정적 코드 증거 (`service_snapshot.py:L85-102`):
```python
client_created = dashboard_states.get(key, {}).get('interface_client_created') is True
if client_created:
    applied_qos = dashboard_states[key]
    service['local_qos'] = applied_qos.get('local_qos')  # local_qos만 복사됨!
    if applied_qos.get('qos_status') == 'incompatible':    # <-- incompatible일 때만 업데이트!
        service.update({
            field: applied_qos.get(field)
            for field in ('qos_status', 'qos_detection_source', ...)
        })
```
1. Interface Lab에서 Client가 생성되면 `service['local_qos']`에는 Client의 QoS 프로파일이 들어갑니다.
2. 하지만 `applied_qos`(`_execution_state`)에는 `qos_status: 'compatible'` 필드가 없으며, `service_snapshot.py`도 `incompatible`일 때만 분기하므로 `service['qos_status']`는 여전히 `observed`로 남습니다.

---

## 5. Service compatibility 계산 함수 존재 여부

Service에는 다음과 같은 compatibility 관련 로직이 존재합니다:

1. **Client 프로파일 자동 산출 함수**:
   - 파일: [ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/qos_profiles.py:L271-352](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/qos_profiles.py#L271-L352)
   - 함수: `_compatible_service_profile(remote)`
   - 입력: Server의 Request Reader QoS 목록, Response Writer QoS 목록
   - 동작:
     - `_select_service_policy()`: Request(요구)와 Response(제공)의 Reliability, Durability, Liveliness 교집합 계산.
     - `_select_service_duration()`: Deadline, Lease Duration 교집합 계산.
     - 양방향을 동시에 만족하는 단일 Client `QoSProfile`을 반환.
     - 양방향 만족 불가 시 fallback 반환 (`fallback_reason = "A single Client profile cannot satisfy..."`).
2. **Topic과의 차이점**:
   - Topic: Graph 상의 모든 Pub × Sub를 `qos_check_compatible()`로 상시 비교하여 `qos_status`를 `compatible / partial / incompatible`로 계산.
   - Service: Graph/DDS 상시 전수 비교 함수는 없으며, Interface Lab에서 Client를 생성할 때만 `_compatible_service_profile()`을 호출합니다.

---

## 6. Service snapshot 조립 흐름

```text
1. Fast DDS Observer (C++ :8766)
   └─ Discovery로 Server Request Reader, Response Writer 수집

2. Monitor dds_observer.py
   └─ _replace_snapshot(): service_role == 'server'만 저장 (Client 무시)
   └─ service_qos(): status='observed', source='fastdds_discovery' 고정 반환

3. Monitor ServiceRuntime.update()
   └─ service.update(self._service_qos(name)) → service['qos_status'] = 'observed'

4. service_snapshot.py (assemble_service_snapshot)
   └─ client_created == True 확인
   └─ service['local_qos']에 Client 프로파일 저장
   └─ qos_status는 incompatible 조건문 미충족으로 'observed' 유지 (고정되는 지점!)

5. Backend /ros/services API
   └─ qos_status: 'observed', local_qos: {...}, publisher_qos: [...], subscriber_qos: [...]

6. Frontend (ServiceTable.jsx & QosSummary.jsx)
   └─ stateOf(service) → 'observed'
   └─ QosStatusBadge → ['QoS 발견', 'observed'] 렌더링
```

---

## 7. Client 생성 전/후 비교

| 구분 | Server만 존재 (생성 전) | Dashboard Client 생성 후 |
|---|---|---|
| **DDS Observer (:8766)** | Server Request Reader, Response Writer | + Client Request Writer, Response Reader |
| **dds_observer.py 수집** | Server Request Reader, Response Writer | Server Request Reader, Response Writer (Client 버려짐) |
| **service.local_qos** | `None` | `{reliability: 'reliable', durability: 'volatile', ...}` |
| **service.publisher_qos** | `[Server Response Writer]` | `[Server Response Writer]` |
| **service.subscriber_qos** | `[Server Request Reader]` | `[Server Request Reader]` |
| **현재 qos_status** | `observed` | **`observed` (그대로 유지됨)** |
| **현재 화면 표시** | `QoS 발견` (파랑 배지) | **`QoS 발견` (파랑 배지)** |
| **기대 status/화면** | `observed` (`QoS 발견`) | **`compatible` (`QoS 호환` - 초록 배지)** |

---

## 8. 실제 호출(Service Call)이 필요한지

- **호출 여부와 무관합니다.**
- Client 생성 시점(`get_or_create`)과 실제 Service Call 호출 시점 모두 `resolve_split_service_execution_qos()`를 거쳐 동일한 Client 엔티티를 사용합니다.
- 실제 Service Call을 수행하더라도 `last_call_summary`와 응답 시간만 기록될 뿐, `service_snapshot.py`의 `qos_status` 갱신 로직은 동일하므로 화면은 여전히 `QoS 발견`으로 유지됩니다.

---

## 9. Fast DDS Observer 데이터 원본 확인 방법 (CLI)

현재 실행 중인 장비에서 코드 수정 없이 터미널 명령어로 실제 데이터를 확인할 수 있습니다:

### 1) Fast DDS Observer raw snapshot 조회 (`:8766`)
```bash
curl -s http://127.0.0.1:8766/snapshot | jq '.endpoints[] | select(.service_name == "/RobotControl" or .service_name == "/ScheduleCrud")'
```
*(여기서는 `service_role: "server"`와 `service_role: "client"`가 모두 출력되는지 확인 가능)*

### 2) Monitor가 조립한 Service snapshot 조회 (`:8000`)
```bash
curl -s http://127.0.0.1:8000/ros/services | jq '.services[] | select(.name == "/RobotControl" or .name == "/ScheduleCrud") | {name, qos_status, local_qos, publisher_qos, subscriber_qos}'
```
*(여기서는 `local_qos`가 채워져 있음에도 `qos_status`가 여전히 `"observed"`로 나오는 것을 확인 가능)*

---

## 10. 버그 여부 판정

### **판정: 구현 누락 및 불완전 연동 (Snapshot 조립 누락 버그)**

- **이유**:
  1. Dashboard가 Interface Lab을 통해 Service Client를 생성했고, Server의 Request/Response QoS에 호환되는 `local_qos` 프로파일을 정상 산출하여 적용했습니다.
  2. 상세 패널(`QosDetails`)을 열어보면 적용 Profile(`local_qos`)과 Server의 Response/Request QoS가 모두 정상 표시됩니다.
  3. 그럼에도 불구하고 목록 배지가 `QoS 호환`이 아닌 `QoS 발견`으로 남아있는 것은 **Interface Lab의 Client 호환 상태가 `service_snapshot.py`의 `qos_status`로 승격되지 않고 누락되었기 때문**입니다.

---

## 11. 최소 수정 방향 (코드 수정 없이 제안만)

불필요한 리팩터링 없이 단 2곳의 코드 보완으로 완벽히 해결 가능합니다:

1. **`qos_profiles.py`의 `_execution_state()`**:
   - 파일: [ros2_dashboard_monitor/interface_lab/execution/qos_profiles.py:L417-432](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/qos_profiles.py#L417-L432)
   - 호환 프로파일 산출 성공 시 `qos_status: 'compatible'`, fallback 실패 시 `qos_status: 'partial'` 또는 `'incompatible'` 필드를 `_execution_state` 반환 딕셔너리에 추가.
2. **`service_snapshot.py`의 상태 병합**:
   - 파일: [ros2_dashboard_monitor/service_snapshot.py:L89-102](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/service_snapshot.py#L89-L102)
   - `if client_created:` 블록에서 `applied_qos`의 `qos_status`가 존재하면 `service['qos_status'] = applied_qos['qos_status']`를 업데이트하도록 조건 보완.

---

## 해당 코드 작업에서 내가 알아야 할 것 3줄 요약

1. **현재 Service의 `QoS 발견(observed)`은 Fast DDS Observer가 Server 엔드포인트만 수집하고 `dds_observer.py`가 `status='observed'`를 고정 반환하기 때문이다.**
2. **Dashboard Client가 생성되어 호환되는 `local_qos` 프로파일이 적용되었음에도 `service_snapshot.py`에서 `qos_status`를 `compatible`로 갱신해주는 로직이 누락되어 있다.**
3. **실제 호환 상태(`compatible`)로 표시되게 하려면 Interface Lab의 Client 실행 상태(`applied_qos`)가 Snapshot 조립 시 `service['qos_status']`로 전달되도록 연동되어야 한다.**
