# Service Monitoring과 사용자 호출 흐름

## 1. 기능을 한 문장으로 설명

Service 화면은 ROS2 Graph에서 Server가 있는지 관찰하고, Interface Lab에서 사용자가 직접 호출한 최근 성공·실패·Timeout을 함께 보여준다.

Service는 Topic처럼 계속 메시지를 보내지 않는다. Client가 한 번 요청하면 Server가 한 번 응답하므로 Hz나 message stale을 측정하지 않는다.

## 2. 전체 흐름

```text
ROS2 Graph에서 Service 발견
→ Server/Client 수 계산
→ Graph 상태 저장
→ 사용자가 Interface Lab에서 Call 실행
→ request 검증
→ Service 준비 상태 확인
→ call_async()
→ 응답 또는 Timeout
→ history와 최근 호출 summary 저장
→ /ros/services에 Graph 상태와 호출 결과 병합
→ Service 목록/상세/Alert 표시
```

## 3. 단계별 쉬운 설명

### 1) Graph에서 Service를 발견한다

- 파일: `service/runtime.py L90~L152`
- 역할: 현재 Service 이름과 타입을 가져오고 Server/Client endpoint 수를 센다. 이전 cache와 비교해 사라진 Service도 찾는다.
- 파일: `service/discovery.py L17~L56`
- 역할: 화면에 필요한 한 Service item을 만든다.
- 다음 흐름: `service_status()`가 Graph 상태를 정한다.

### 2) Server 상태를 계산한다

- 파일: `service/models.py L28~L60`

| 조건 | Graph 상태 | 화면 의미 |
|---|---|---|
| Server 1개 이상 | `active` | 사용 가능 |
| Server 0, Client 1개 이상 | `waiting_server` | 서버 대기 |
| 둘 다 0 | `inactive` | 현재 endpoint 없음 |
| 타입 불명 | `unknown` | 판단 정보 부족 |
| 이전 발견 후 사라짐 | `disconnected` | 연결 끊김 |

이 상태는 “최근 요청이 성공했는가”와 다른 정보다.

### 3) 등록 srv와 Graph 타입을 연결한다

- 파일: `ros_monitor.py L173~L232`
- 역할: 활성 Node 관계를 역집계해 Server/Client Node 수를 추가하고, import 가능한 등록 srv 타입과 Graph `full_type`이 정확히 같으면 `allowlisted`, 실제 Server도 있으면 `callable`로 표시한다.
- 중요: 여기서 `allowlisted`는 등록 Interface 일치 신호다. 자동 호출 허가라는 뜻이 아니다.

### 4) 사용자가 Service Call을 실행한다

- 파일: `routers/service_execution.py L15~L67`
- 파일: `interface_lab/execution/service_call_runtime.py L85~L188`
- 역할: Interface Lab 요청을 받아 등록 타입, Graph 타입, Server 존재를 확인하고 실제 Call을 실행한다.
- 입력: `service_name`, `service_type`, request JSON, `timeout_sec`

### 5) request를 ROS 객체로 검증·변환한다

- 파일: `interface_lab/common/value_converter.py L37~L107`
- 역할: 숫자, 문자열, 배열, 중첩 custom message를 ROS request 객체로 바꾼다.
- 실패: `validation_error`, `sent_to_server=false`; Server에는 보내지 않는다.

### 6) 준비 상태를 확인하고 비동기로 호출한다

- 파일: `interface_lab/execution/service_call_runtime.py L120~L133`
- 실제 코드: `client.service_is_ready()` 확인 후 `client.call_async(request)`를 호출한다.
- 주의: 현재 구현은 별도의 `wait_for_service()`를 호출하지 않는다. 준비되지 않았으면 즉시 오류로 기록한다.

### 7) 응답과 Timeout을 구분한다

- 파일: `interface_lab/execution/service_call_runtime.py L132~L184`
- 응답 도착: 응답 JSON과 경과 시간을 저장한다.
- `response.success=false`: `response_failed`
- 제한 시간 초과: `error_type=timeout`
- 기타 실행 오류: `service_call_error`
- 다음 흐름: `_record_history()`와 `summary_by_service()`가 최근 결과를 만든다.

### 8) Graph 상태와 최근 호출 결과를 합친다

- 파일: `interface_lab/execution/service_call_runtime.py L189~L278`
- 파일: `interface_lab/execution/service_call_runtime.py L462~L478`
- 파일: `ros_monitor.py L173~L232`
- 파일: `ros_monitor.py L687~L705`

`status`는 Graph 상태를 유지한다. `call_status`는 최근 사용자 호출 결과다. `effective_status`는 목록 표시용 우선순위다.

```text
Server 없음 → waiting_server/disconnected 우선
Server 있음 + Timeout → timeout
Server 있음 + 호출 실패 → failed
Server 있음 + 성공 → active
호출 이력 없음 → Graph 상태
```

### 9) Alert를 만든다

- 파일: `service/alerts.py L10~L67`
- `service_call_timeout`: 최근 사용자 호출 Timeout, warning
- `service_disconnected`: 등록 주요 Service가 이전에 보였다가 사라짐, error
- 정상 호출이 새로 기록되면 Timeout Alert 조건이 사라지고 resolved로 전환된다.

### 10) Frontend가 두 상태를 나눠 보여준다

- 파일: `hooks/useServiceDashboard.js L7~L78`
- 파일: `components/ServiceTable.jsx L33~L136`
- 파일: `components/ServiceDetailPanel.jsx L6~L159`
- 목록: `effective_status`를 사용해 Timeout/호출 실패를 숨기지 않는다.
- 상세: `서버 상태`, `최근 호출 결과`, `마지막 호출`, 응답 시간, 오류를 따로 표시한다.
- 마지막 요청과 응답을 클릭하면 전체 JSON popup을 연다.

## 4. Active check 현재 정책

`service/active_check.py`와 `service/active_check_runtime.py` 같은 이전 호환 코드가 남아 있다. 그러나 현재 주기 실행 경로 `ros_monitor.py L677~L683`에서는 `update_active_checks()`를 호출하지 않는다.

따라서 문서와 화면에서 active check를 현재 사용 중인 자동 생존 확인 기능으로 설명하면 안 된다. 실제 Service 요청은 Interface Lab 사용자가 실행했을 때만 전송된다.

## 5. 입력 데이터

- Graph Service name/type
- Server/Client Node 수와 endpoint 수
- 등록 srv 정보
- 사용자 request JSON과 timeout

## 6. 처리 과정

Graph Monitoring과 사용자 Call history는 별도로 저장한 뒤 `/ros/services`에서 합친다. 이 분리 덕분에 “Server는 보이지만 최근 호출은 Timeout”인 상태를 표현할 수 있다.

## 7. 출력 데이터

- `status`: Graph 상태
- `call_status`: 최근 호출 결과
- `effective_status`: 목록 표시 상태
- `last_call_summary`: 요청, 응답, 시간, 오류
- `service_call_timeout`, `service_disconnected` Alert

## 8. 다음 단계와 연결

Alert의 active/resolved 처리는 [07_alert_flow.md](07_alert_flow.md), 등록과 Call 화면은 [12_interface_lab_flow.md](12_interface_lab_flow.md)로 이어진다.

## 9. 핵심 요약

1. Service Server 존재와 최근 사용자 호출 성공은 서로 다른 상태다.
2. 자동 active check는 현재 실행되지 않으며 사용자 Call만 실제 요청을 보낸다.
3. Timeout은 Service 목록과 Alert에 모두 표시되고 다음 정상 호출에서 해결된다.
