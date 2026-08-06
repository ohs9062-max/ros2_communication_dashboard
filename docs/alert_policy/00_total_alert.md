# 전체 Alert 정책 요약

이 문서는 ROS2 Communication Monitor Dashboard의 모든 경고(Alert)를 정리 한 버전 입니다.

> 세부 기술 명세는 같은 폴더의 01~05 문서를 참고하세요.

---

## 경고 등급 안내

| 등급 | 아이콘 | 의미 |
|---|---|---|
| **주의** (warning) | ⚠️ | 당장 고장은 아니지만 확인이 필요한 상태 |
| **오류** (error) | 🔴 | 통신이 끊기거나 실패한 상태, 조치 필요 |
| **위험** (critical) | 🔥 | 장비가 직접 보고한 심각한 상태 |

---

## 1. Topic (토픽) 경고

Topic은 센서 데이터나 명령 메시지가 흐르는 **발행-구독 통신 채널**입니다.

| # | 코드명 | 등급 | 한줄 설명 | 언제 발생하나? | 언제 해제되나? | 설정 |
|---|---|---|---|---|---|---|
| 1 | `waiting_publisher` | ⚠️ 주의 | **발행자가 없음** | 감시 대상 Topic에 구독자는 있지만 메시지를 보내는 발행자(Publisher)가 하나도 없을 때 | 발행자가 나타나면 | `required_stream_names` 또는 Interface 등록 |
| 2 | `topic_message_missing` | ⚠️ 주의 | **메시지 미수신** | 발행자가 존재하고 Dashboard가 구독을 시작했지만, **3초**(기본) 이상 지나도 메시지를 **단 한 번도** 받지 못했을 때 | 첫 메시지를 수신하면 | `stale_timeout_sec` (기본 3초) |
| 3 | `topic_stale` | ⚠️ 주의 | **메시지 수신 지연** | 이전에 메시지를 받은 적 있지만, 마지막 수신 이후 **3초**(기본)가 지나도 새 메시지가 오지 않을 때 | 새 메시지를 수신하면 | `stale_timeout_sec` (기본 3초) |
| 4 | `topic_disconnected` | 🔴 오류 | **토픽 연결 끊김** | 전에 존재하던 감시 대상 Topic이 ROS2 시스템에서 완전히 사라졌을 때 | Topic이 다시 나타나면 | `required_stream_names` 또는 Interface 등록 |
| 5 | `monitor_status_<level>` | ⚠️~🔥 동적 | **장비 상태 보고** | `MonitorStatus` 타입 메시지를 통해 장비가 직접 주의/오류/위험 수준의 상태를 보고했을 때 | 해당 장비가 정상 상태를 보고하거나 메시지가 더 이상 오지 않으면 | `supported_types`에 MonitorStatus 포함 |

> **missing vs stale 차이점**
> - **missing** = 감시를 시작한 뒤 메시지를 **한 번도** 못 받은 상태
> - **stale** = 메시지를 받다가 **중단**된 상태 (마지막 수신 후 시간 초과)

### Topic 경고가 발생하지 않는 정상 상태

- `/cmd_vel` 같은 **명령 토픽**(`command_names`)은 경고 대상에서 제외됩니다
- 감시 목록(`required_stream_names`)이나 Interface 등록에 없는 일반 토픽은 경고하지 않습니다
- 구독 시작 직후 3초 이내에는 아직 대기 중이므로 미수신 경고를 내지 않습니다

---

## 2. Service (서비스) 경고

Service는 **요청-응답** 방식의 통신입니다 (클라이언트가 서버에 요청하고 결과를 받음).

| # | 코드명 | 등급 | 한줄 설명 | 언제 발생하나? | 언제 해제되나? | 설정 |
|---|---|---|---|---|---|---|
| 1 | `service_disconnected` | 🔴 오류 | **서비스 연결 끊김** | Interface에 등록된 서비스가 이전에 존재했는데 ROS2 시스템에서 사라졌을 때 | 서비스가 다시 나타나면 | Interface Registry 등록 |
| 2 | `service_call_timeout` | ⚠️ 주의 | **서비스 호출 시간 초과** | 사용자가 Interface Lab에서 서비스를 호출했는데, 서버가 **제한 시간**(기본 2초) 안에 응답하지 않았을 때 | 같은 서비스에 새 호출이 성공하면 | `DEFAULT_TIMEOUT_SEC` (2초), 최대 10초 |
| 3 | `service_call_failed` | 🔴 오류 | **서비스 호출 실패** | 사용자가 Interface Lab에서 서비스를 호출했는데, 서버 응답 수신 중 오류가 발생했을 때 | 같은 서비스에 새 호출이 성공하면 | - |

### Service Active Check 경고 (기본 비활성)

> Active Check는 등록된 서비스에 주기적으로 자동 요청을 보내 생존을 확인하는 기능입니다.
> 현재 기본 설정은 **꺼져 있습니다** (`enabled: false`).

| # | 코드명 | 등급 | 한줄 설명 | 언제 발생하나? | 언제 해제되나? |
|---|---|---|---|---|---|
| 4 | `service_active_check_timeout` | ⚠️ 주의 | **자동 점검 시간 초과** | 자동 점검 요청을 보냈는데 제한 시간(기본 2초) 안에 응답이 없을 때 | 다음 점검에서 정상 응답 |
| 5 | `service_active_check_failed` | ⚠️ 주의 | **자동 점검 실패** | 응답은 받았지만, 성공 판정 필드의 값이 실패(false)일 때 | 다음 점검에서 성공 판정 |
| 6 | `service_active_check_error` | 🔴 오류 | **자동 점검 오류** | 점검 실행 중 예외 발생 (서비스 타입 불러오기 실패, 요청 생성 실패 등) | 다음 점검에서 정상 실행 |
| 7 | `service_active_check_type_mismatch` | ⚠️ 주의 | **자동 점검 타입 불일치** | 설정에 등록한 서비스 타입과 실제 ROS2에서 발견된 서비스 타입이 다를 때 | 타입이 일치하도록 수정 |

### Service 경고가 발생하지 않는 정상 상태

- **서버만 있고 클라이언트가 없는 상태**는 정상입니다 (서비스는 요청을 기다리는 것이 본래 역할)
- 아직 **한 번도 호출하지 않은** 서비스는 경고하지 않습니다
- 호출이 **서버에 도달하기 전에 실패**한 경우 (입력값 검증 오류 등)는 네트워크 문제가 아니므로 경고하지 않습니다
- 시스템 서비스 (parameter, action 내부, ROS 내부)는 경고 대상이 아닙니다

---

## 3. Action (액션) 경고

Action은 **장시간 실행되는 작업**을 위한 통신입니다 (Goal 전송 → 진행 피드백 → 최종 결과).

| # | 코드명 | 등급 | 한줄 설명 | 언제 발생하나? | 언제 해제되나? | 설정 |
|---|---|---|---|---|---|---|
| 1 | `action_disconnected` | 🔴 오류 | **액션 연결 끊김** | Interface에 등록된 Action이 이전에 존재했는데 ROS2 시스템에서 사라졌을 때 | Action이 다시 나타나면 | Interface Registry 등록 |
| 2 | `action_goal_aborted` | 🔴 오류 | **Goal 서버 측 중단** | 서버가 Goal을 실행하다가 자체적으로 중단(abort)했을 때 | 같은 Action에 새 Goal이 성공하면 | - |
| 3 | `action_goal_canceled` | ⚠️ 주의 | **Goal 취소됨** | Goal이 취소 요청에 의해 중지되었을 때 | 같은 Action에 새 Goal이 성공하면 | - |
| 4 | `action_goal_rejected` | ⚠️ 주의 | **Goal 거부됨** | 서버가 Goal 수락을 거부했을 때 (예: 다른 Goal 실행 중이라 수용 불가) | 같은 Action에 새 Goal이 수락되면 | - |
| 5 | `action_goal_send_failed` | 🔴 오류 | **Goal 전송 실패** | Goal을 서버에 보내는 데 실패했거나, 보낸 후 서버의 수락 응답이 시간 내에 오지 않았을 때 | 같은 Action에 새 Goal이 정상 전송되면 | - |
| 6 | `action_result_timeout` | ⚠️ 주의 | **결과 수신 시간 초과** | Goal이 수락되어 실행 중이지만, 최종 결과(Result)가 제한 시간(기본 10초) 안에 오지 않았을 때 | 같은 Action에 새 Goal의 결과가 정상 수신되면 | `DEFAULT_TIMEOUT_SEC` (10초), 최대 60초 |
| 7 | `action_result_unavailable` | 🔴 오류 | **결과 수신 실패** | Goal의 최종 결과를 가져오는 중 오류가 발생했을 때 | 같은 Action에 새 Goal의 결과가 정상 수신되면 | - |

### Action 경고가 발생하지 않는 정상 상태

- **서버만 있고 클라이언트가 없는 상태**는 정상입니다 (Action 서버는 Goal 요청을 기다리는 것이 본래 역할)
- 아직 **Goal을 보낸 적 없는** Action은 경고하지 않습니다
- Goal이 **성공(succeeded)**하거나 **실행 중(executing)**인 상태는 정상이므로 경고하지 않습니다

---

## 4. Node (노드) 경고

Node는 ROS2 시스템을 구성하는 **프로그램 단위**입니다.

| # | 코드명 | 등급 | 한줄 설명 | 언제 발생하나? | 언제 해제되나? | 설정 |
|---|---|---|---|---|---|---|
| 1 | `node_stale` | 🔴 오류 | **노드 연결 끊김** | 이전에 ROS2 시스템에서 발견된 노드가 **5초**(기본) 이상 보이지 않을 때 | 노드가 다시 나타나면 | `nodes.stale_timeout_sec` (기본 5초) |

### Node 상태 변화 흐름

```
[처음 발견] → 정상(active)
                 ↓ 시스템에서 사라짐
             잠시 유예(stale) ← 5초 이내
                 ↓ 5초 경과
             연결 끊김(disconnected) → node_stale 경고 발생!
                 ↓ 다시 나타남
             정상(active) → 경고 해제
```

### Node 경고가 발생하지 않는 정상 상태

- **처음부터 발견된 적 없는** 노드에 대해서는 경고하지 않습니다
- 사라진 지 **5초 이내**이면 아직 유예 기간이므로 경고하지 않습니다

---

## 5. 경고 생명주기

모든 경고는 아래 흐름을 따릅니다:

```
1. 조건 감지 → [활성] 상태 (화면에 표시)
       ↓
2. 조건 해결 → [해결됨] 상태 (60초간 화면에 남음)
       ↓
3. 60초 경과 → 화면에서 사라짐 (이력에는 남음)
```

### 사용자 조작

| 조작 | 효과 |
|---|---|
| **확인 처리 (Dismiss)** | 현재 표시된 모든 경고를 숨김. 같은 조건이 해제됐다 다시 발생하면 새 경고로 표시 |
| **이력 삭제 (Reset History)** | 해결된 경고의 기록을 삭제 |

### 이력 보관

| 저장소 | 보관 수 | 영속성 |
|---|---|---|
| Monitor 메모리 | 최근 50건 | 프로세스 재시작 시 초기화 |
| Backend 메모리 | 최근 50건 | 프로세스 재시작 시 초기화 |
| MariaDB (향후) | 무제한 | 영구 보관 |

---

## 전체 경고 한눈에 보기 (20개)

### Topic 경고 (5개)

| 코드 | 등급 | 한줄 요약 |
|---|---|---|
| `waiting_publisher` | ⚠️ 주의 | 발행자가 없어서 메시지를 받을 수 없음 |
| `topic_message_missing` | ⚠️ 주의 | 발행자는 있지만 3초 넘게 메시지를 한 번도 못 받음 |
| `topic_stale` | ⚠️ 주의 | 메시지를 받다가 3초 넘게 끊김 |
| `topic_disconnected` | 🔴 오류 | 존재하던 토픽이 시스템에서 완전히 사라짐 |
| `monitor_status_<level>` | ⚠️~🔥 | 장비가 직접 비정상 상태를 보고함 |

### Service 경고 (3개 + Active Check 4개)

| 코드 | 등급 | 한줄 요약 |
|---|---|---|
| `service_disconnected` | 🔴 오류 | 등록된 서비스가 시스템에서 사라짐 |
| `service_call_timeout` | ⚠️ 주의 | 서비스 호출 후 2초 안에 응답 없음 |
| `service_call_failed` | 🔴 오류 | 서비스 호출이 실패함 |
| `service_active_check_timeout` | ⚠️ 주의 | 자동 점검 응답 시간 초과 (기본 비활성) |
| `service_active_check_failed` | ⚠️ 주의 | 자동 점검 성공 조건 미충족 (기본 비활성) |
| `service_active_check_error` | 🔴 오류 | 자동 점검 실행 중 오류 (기본 비활성) |
| `service_active_check_type_mismatch` | ⚠️ 주의 | 자동 점검 타입 불일치 (기본 비활성) |

### Action 경고 (7개)

| 코드 | 등급 | 한줄 요약 |
|---|---|---|
| `action_disconnected` | 🔴 오류 | 등록된 액션이 시스템에서 사라짐 |
| `action_goal_aborted` | 🔴 오류 | 서버가 Goal 실행을 자체 중단함 |
| `action_goal_canceled` | ⚠️ 주의 | Goal이 취소 요청으로 중지됨 |
| `action_goal_rejected` | ⚠️ 주의 | 서버가 Goal 수락을 거부함 |
| `action_goal_send_failed` | 🔴 오류 | Goal 전송 자체가 실패하거나 수락 응답이 시간 초과 |
| `action_result_timeout` | ⚠️ 주의 | 결과가 10초 안에 오지 않음 |
| `action_result_unavailable` | 🔴 오류 | 결과를 가져오는 중 오류 발생 |

### Node 경고 (1개)

| 코드 | 등급 | 한줄 요약 |
|---|---|---|
| `node_stale` | 🔴 오류 | 존재하던 노드가 5초 넘게 시스템에서 보이지 않음 |

---

## 관련 설정값 요약

| 설정 | 기본값 | 영향 범위 | 설명 |
|---|---|---|---|
| `monitor.stale_timeout_sec` | 3.0초 | Topic missing / stale | 메시지 미수신 또는 수신 지연으로 판단하는 기준 시간 |
| `monitor.poll_interval_sec` | 1.0초 | 전체 | 경고 재판정 주기 |
| `nodes.stale_timeout_sec` | 5.0초 | Node stale | 노드 이탈로 판단하는 유예 시간 |
| `services.active_check.enabled` | false | Service Active Check | 서비스 자동 점검 활성화 여부 |
| `services.active_check.default_timeout_sec` | 2.0초 | Service Active Check | 자동 점검 응답 대기 시간 |
| `topics.required_stream_names` | 설정별 | Topic 경고 대상 | 필수 감시 토픽 목록 |
| `topics.command_names` | 설정별 | Topic 경고 제외 | 경고를 내지 않을 명령 토픽 목록 |
