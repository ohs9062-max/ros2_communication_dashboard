# Service Alert 정책

## 개요

Service Alert는 **사용자 분류(category: user)** Service를 대상으로 합니다.
시스템 Service(parameter, action_internal, ros_internal)는 Alert 대상에서 제외됩니다.
`hidden_by_default = true`인 Service도 Alert에서 제외됩니다.

---

## Alert 코드 목록

### 1. `service_disconnected`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `service:<service_name>:service_disconnected` |
| **Level** | 🔴 `error` |
| **대상 Kind** | Service |
| **발생 조건** | • `service.category == 'user'`<br>• `service.hidden_by_default != true`<br>• `service.status == 'disconnected'` (이전에 Graph에서 발견된 후 사라짐)<br>• `service.allowlisted == true` (Interface Registry에 등록됨) |
| **판정 데이터** | `service.status`, `service.allowlisted`, `service.last_seen_at` |
| **사용자 메시지** | `Service connection lost; it is no longer visible in the ROS2 graph.` |
| **해제 조건** | Service가 Graph에 다시 나타남 (`status != 'disconnected'`) |
| **설정 가능 여부** | Interface Registry 등록/해제로 `allowlisted` 결정 |
| **소스 코드** | [ros2_service/alerts.py:76-95](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/alerts.py#L76-L95) |

---

### 2. `service_call_timeout`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `service:<service_name>:service_call_timeout` |
| **Level** | ⚠️ `warning` |
| **대상 Kind** | Service |
| **발생 조건** | • `service.category == 'user'`<br>• `service.hidden_by_default != true`<br>• Interface Lab에서 **사용자가 명시적으로 Call 실행**<br>• Call이 서버에 전송됨 (`sent_to_server = true`)<br>• 최근 Call의 결과가 **타임아웃** (`last_call_status == 'timeout'`) |
| **판정 데이터** | `last_call_summary.sent_to_server`, `last_call_summary.last_call_status`, `last_call_summary.last_called_at` |
| **age_sec** | `detected_at - last_called_at` |
| **사용자 메시지** | `The latest user Service call timed out.` |
| **해제 조건** | 동일 Service에 대해 새로운 Call이 성공하거나 다른 상태로 변경 |
| **설정 가능 여부** | Call 타임아웃 기본값: `DEFAULT_TIMEOUT_SEC = 2.0초`, 최대: `MAX_TIMEOUT_SEC = 10.0초` (호출 시 지정 가능) |
| **소스 코드** | [ros2_service/alerts.py:24-45](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/alerts.py#L24-L45) |

---

### 3. `service_call_failed`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `service:<service_name>:service_call_failed` |
| **Level** | 🔴 `error` |
| **대상 Kind** | Service |
| **발생 조건** | • `service.category == 'user'`<br>• `service.hidden_by_default != true`<br>• Interface Lab에서 **사용자가 명시적으로 Call 실행**<br>• Call이 서버에 전송됨 (`sent_to_server = true`)<br>• 최근 Call 상태가 실패 계열:<br>&nbsp;&nbsp;`last_call_status ∈ {'failed', 'response_failed', 'service_call_error'}` |
| **판정 데이터** | `last_call_summary.sent_to_server`, `last_call_summary.last_call_status`, `last_call_summary.last_error` |
| **사용자 메시지** | `last_error` 값 (없으면 `The latest user Service call failed.`) |
| **해제 조건** | 동일 Service에 대해 새로운 Call이 성공 |
| **설정 가능 여부** | Call 대상은 Interface Registry 등록과 Graph 존재로 결정 |
| **소스 코드** | [ros2_service/alerts.py:47-74](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/alerts.py#L47-L74) |

---

## Service Active Check Alert (monitor.yaml에서 enabled: true 시)

> [!NOTE]
> Service Active Check는 현재 기본 설정 `enabled: false`입니다.
> 활성화할 경우 `monitor.yaml`의 `services.active_check.allowlist`에 등록된 Service만
> 주기적으로 자동 호출하여 상태를 확인합니다.

### 4. `service_active_check_timeout`

| 항목 | 내용 |
|---|---|
| **Alert ID** | (active_check 내부 상태로 관리) |
| **Level** | 상태값 `timeout` |
| **발생 조건** | • Active Check 대상 Service<br>• 요청 전송 후 `timeout_sec` 이내에 응답 미수신 |
| **판정 데이터** | `future.done()`, `now - started_at > timeout_sec` |
| **해제 조건** | 다음 주기적 Active Check에서 정상 응답 수신 |
| **설정 가능 여부** | `services.active_check.default_timeout_sec` (기본: `2.0초`), allowlist 항목별 `timeout_sec` |
| **소스 코드** | [ros2_service/active_check.py:136-149](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/active_check.py#L136-L149) |

### 5. `service_active_check_failed`

| 항목 | 내용 |
|---|---|
| **Level** | 상태값 `failed` |
| **발생 조건** | • 응답은 정상 수신<br>• `success_field`로 지정한 응답 필드가 `false` 또는 falsy |
| **판정 데이터** | `response_preview[success_field]` |
| **해제 조건** | 다음 Active Check에서 `success_field`가 `true` |
| **소스 코드** | [ros2_service/active_check.py:170-203](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/active_check.py#L170-L203) |

### 6. `service_active_check_error`

| 항목 | 내용 |
|---|---|
| **Level** | 상태값 `error` |
| **발생 조건** | • Active Check 실행 중 예외 발생<br>• Service class 로드 실패, request 빌드 실패, 네트워크 오류 등 |
| **판정 데이터** | 예외 메시지 |
| **해제 조건** | 다음 Active Check에서 정상 실행 |
| **소스 코드** | [ros2_service/active_check.py:152-167](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/active_check.py#L152-L167) |

### 7. `service_active_check_type_mismatch`

| 항목 | 내용 |
|---|---|
| **Level** | 상태값 `type_mismatch` |
| **발생 조건** | • allowlist에 등록된 `service_type`과 Graph에서 발견된 실제 Service type이 불일치 |
| **판정 데이터** | `allowlist_item.service_type != service.type` |
| **해제 조건** | Graph의 Service type이 allowlist와 일치하도록 변경 |
| **소스 코드** | [ros2_service/active_check.py:94-101](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/active_check.py#L94-L101) |

---

## Service Alert 판정 흐름도

```text
Service Alert 대상 필터링:
├─ category != 'user' → Alert 제외
├─ hidden_by_default == true → Alert 제외
│
├─ status == 'disconnected' AND allowlisted == true
│  → service_disconnected (ERROR)
│
├─ last_call_summary 존재 AND sent_to_server == true
│  ├─ last_call_status == 'timeout'
│  │  → service_call_timeout (WARNING)
│  │
│  └─ last_call_status ∈ {'failed', 'response_failed', 'service_call_error'}
│     → service_call_failed (ERROR)
│
└─ Active Check (enabled: true일 때만)
   ├─ 타임아웃 → service_active_check_timeout
   ├─ 성공 필드 falsy → service_active_check_failed
   ├─ 예외 → service_active_check_error
   └─ 타입 불일치 → service_active_check_type_mismatch
```

---

## 정상 대기 상태 (Alert 미발생)

| 상태 | 설명 | 근거 |
|---|---|---|
| Server만 존재, Client 없음 | 요청을 기다리는 정상 대기 상태 | AGENTS.md 정책: 기본 Alert 제외 |
| Call 미실행 | Interface Lab에서 아직 Call하지 않은 상태 | `last_call_summary`가 없으면 Alert 없음 |
| `sent_to_server = false` | Call이 서버 전송 전 실패 (validation 등) | 네트워크 문제가 아닌 입력 오류 |

---

## 관련 설정 키 (monitor.yaml)

| YAML 키 | 기본값 | 역할 |
|---|---|---|
| `services.active_check.enabled` | `false` | 주기적 Active Check 활성화 여부 |
| `services.active_check.interval_sec` | `10.0` | Active Check 실행 주기 (초) |
| `services.active_check.default_timeout_sec` | `2.0` | Active Check 응답 대기 기본 타임아웃 (초) |
| `services.active_check.allowlist` | `[]` | Active Check 대상 Service 목록 (name, type, request, success_field, timeout_sec) |
