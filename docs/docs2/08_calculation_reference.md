# 계산 로직 코드 대조표

이 문서는 화면과 API에 표시되는 **집계·상태·Hz·경과 시간 계산만** 실제 코드와 대조해 정리한다.
줄 번호는 2026-07-31 현재 코드 기준이다.

## 1. 먼저 구분할 값

| 값 | 계산 단위 | 의미 | 실제 코드 |
|---|---|---|---|
| `publisher_count`, `subscriber_count` | DDS endpoint | rclpy Graph가 반환한 원본 Publisher·Subscriber endpoint 수 | `topic/runtime.py` L163-L172 |
| `server_count`, `client_count` | DDS endpoint | Service·Action Runtime이 Graph에서 센 원본 endpoint 수 | `service/models.py` L37-L58, `action/models.py` L63-L81 |
| `*_node_count` | 고유 Node | 같은 역할·리소스 이름·exact type에 연결된 Node를 중복 제거한 수 | `topology.py` L19-L54 |
| `total_*_node_count` | 고유 Node | Dashboard 내부 Node까지 포함한 전체 Node 수 | `ros_monitor.py` L173-L174, L261-L262, L385-L386 |
| `internal_*_node_count` | 고유 Node | 전체 Node 수에서 Dashboard 제외 Node 수를 뺀 값 | `ros_monitor.py` L175-L180, L263-L268, L387-L392 |

따라서 메인 목록의 `(Dashboard 제외)` 숫자와 원본 endpoint 숫자는 서로 같은 값일 필요가 없다.
한 Node가 여러 endpoint를 만들 수 있기 때문이다.

---

## 2. Dashboard 제외 Node 수

### 2.1 공통 고유 Node 집계

`topology.py` L19-L39에서 다음 key로 Node 이름을 `set`에 넣는다.

```text
(role, resource_name, exact full_type) → 고유 Node 이름 집합
```

계산:

```text
역할별 고유 Node 집합
= 현재 Graph에 존재하는 Node 중
  역할 + 리소스 이름 + exact type이 모두 같은 Node의 집합
```

`topology.py` L42-L54의 `related_nodes()`가 타입별 집합을 합치고 정렬한다.
`set`을 사용하므로 같은 Node 이름은 한 번만 센다.

### 2.2 Dashboard 내부 Node 제외

`ros_monitor.py` L797-L802:

```text
외부 Node 목록
= 전체 관련 Node 목록에서
   Node 이름이 Dashboard 내부 Node 이름과 다른 항목만 유지
```

### 2.3 Topic

코드: `ros_monitor.py` L142-L208

```text
publisher_node_count = len(Dashboard 내부 Node를 제외한 Publisher Node)
subscriber_node_count = len(Dashboard 내부 Node를 제외한 Subscriber Node)

total_publisher_node_count = len(Dashboard 포함 전체 Publisher Node)
total_subscriber_node_count = len(Dashboard 포함 전체 Subscriber Node)

internal_publisher_node_count
= total_publisher_node_count - publisher_node_count

internal_subscriber_node_count
= total_subscriber_node_count - subscriber_node_count
```

화면 사용 코드:

```text
frontend/src/components/TopicTable.jsx L103-L104
```

화면은 `publisher_node_count`, `subscriber_node_count`를 우선 사용하고,
구 API 응답에는 각각 `publisher_count`, `subscriber_count`를 fallback으로 사용한다.

### 2.4 Service

코드: `ros_monitor.py` L234-L271

```text
server_node_count = len(Dashboard 내부 Node를 제외한 Server Node)
client_node_count = len(Dashboard 내부 Node를 제외한 Client Node)

total_server_node_count = len(Dashboard 포함 전체 Server Node)
total_client_node_count = len(Dashboard 포함 전체 Client Node)

internal_server_node_count
= total_server_node_count - server_node_count

internal_client_node_count
= total_client_node_count - client_node_count
```

화면 사용 코드:

```text
frontend/src/components/ServiceTable.jsx L116-L117
```

### 2.5 Action

코드: `ros_monitor.py` L358-L395

```text
server_node_count = len(Dashboard 내부 Node를 제외한 Action Server Node)
client_node_count = len(Dashboard 내부 Node를 제외한 Action Client Node)

total_server_node_count = len(Dashboard 포함 전체 Server Node)
total_client_node_count = len(Dashboard 포함 전체 Client Node)

internal_server_node_count
= total_server_node_count - server_node_count

internal_client_node_count
= total_client_node_count - client_node_count
```

화면 사용 코드:

```text
frontend/src/components/ActionTable.jsx L123-L124
```

---

## 3. Topic 구독 endpoint 차감

코드: `topic/runtime.py` L163-L172

```text
raw_subscriber_count
= node.count_subscribers(topic_name)

external_subscriber_count
= max(0, raw_subscriber_count - monitor_subscriber_count)
```

`monitor_subscriber_count`는 Dashboard 자동 감시 subscription 수다.
`max(0, ...)`를 사용하므로 차감 결과가 음수가 되지 않는다.

Topic 상태를 만들 때는 원본 `raw_subscriber_count`가 아니라
`external_subscriber_count`를 사용한다.

코드:

```text
topic/discovery.py L24-L27
```

단, API 호환과 진단을 위해 다음 원본값은 유지한다.

```text
subscriber_count = raw_subscriber_count
raw_subscriber_count = raw_subscriber_count
monitor_subscriber_count = Dashboard 자동 감시 endpoint 수
external_subscriber_count = Dashboard 자동 감시를 차감한 endpoint 수
```

코드: `topic/discovery.py` L29-L42

---

## 4. Topic 상태 계산

코드: `topic/models.py` L45-L63

여기서 Subscriber 수는 `external_subscriber_count`다.

| 조건 | 상태 |
|---|---|
| `publisher_count > 0` 그리고 `external_subscriber_count > 0` | `active` |
| `publisher_count > 0` 그리고 `external_subscriber_count == 0` | `no_subscriber` |
| `publisher_count == 0` 그리고 `external_subscriber_count > 0` | `waiting_publisher` |
| 둘 다 0 | `inactive` |

Dashboard 자동 감시 subscription만 존재하면 외부 Subscriber로 보지 않는다.

---

## 5. Topic Hz·경과 시간·stale

### 5.1 계산 창에 남길 timestamp

코드: `topic/hz.py` L14-L22

```text
earliest = 현재 시각 - Hz 계산 창

최근 timestamp
= timestamp >= earliest 인 수신 시각만 유지
```

Runtime 적용 위치:

```text
topic/runtime.py L524-L546
```

### 5.2 Hz

코드: `topic/hz.py` L42-L55

```text
message_count = 최근 계산 창에 남은 timestamp 개수

message_count > 0:
    hz = round(message_count / window_sec, 2)

message_count == 0:
    hz = 0.0
```

현재 구현은 첫 timestamp와 마지막 timestamp의 간격을 사용하는 방식이 아니라,
**계산 창 안의 메시지 수를 설정된 전체 `window_sec`로 나누는 방식**이다.

### 5.3 마지막 수신 경과 시간

코드: `topic/hz.py` L25-L39

```text
last_received_at이 없음:
    age_sec = None
    status = never_received

last_received_at이 있음:
    age_sec = 현재 시각 - last_received_at
```

### 5.4 stale

코드: `topic/hz.py` L35-L39

```text
age_sec > stale_timeout_sec:
    is_stale = true
    status = stale

그 외:
    is_stale = false
    status = active
```

경계값이 같은 경우에는 stale이 아니다. 비교 연산자가 `>=`가 아니라 `>`이기 때문이다.

### 5.5 화면 Hz 배지 구분

코드: `frontend/src/components/TopicTable.jsx` L171-L202

| 조건 | 화면 상태 |
|---|---|
| `deep_monitoring == false` | `미지원` |
| Hz 응답 없음 또는 `never_received` | `아직 수신 없음` |
| 숫자가 아니거나 `hz <= 0` | `zero` |
| `0 < hz < 10` | `low` |
| `hz >= 10` | `normal` |

`10 Hz` 기준은 Backend 장애 판정이 아니라 Frontend 배지 색상 구분 기준이다.

---

## 6. Service 상태 계산

코드: `service/models.py` L37-L58

| 조건 | 상태 |
|---|---|
| 타입이 `package/srv/Type` 형식이 아님 | `unknown` |
| `server_count > 0` | `active` |
| `server_count == 0` 그리고 `client_count > 0` | `waiting_server` |
| Server와 Client가 모두 없음 | `inactive` |

최근 사용자 Call 결과까지 반영한 화면 상태는 `ros_monitor.py` L813-L831에서 계산한다.

```text
Graph disconnected 또는 server_count <= 0
→ Graph 상태 유지

Server가 있고 전송된 Call 이력이 없음
→ Graph 상태 유지

최근 Call timeout
→ timeout

최근 Call success
→ active

그 밖의 전송 결과
→ failed
```

---

## 7. Action 상태 계산

코드: `action/models.py` L63-L81

| 조건 | 상태 |
|---|---|
| 타입이 `package/action/Type` 형식이 아님 | `unknown` |
| `server_count > 0` | `active` |
| `server_count == 0` 그리고 `client_count > 0` | `waiting_server` |
| Server와 Client가 모두 없음 | `inactive` |

Action Goal status 숫자를 문자열로 바꾸는 위치:

```text
action/models.py L84-L86
```

실제 숫자별 label은 같은 파일의 `GOAL_STATUS_LABELS` 상수를 사용한다.

---

## 8. 실행 시간 계산

### 8.1 관찰 Action 실행 시간

코드: `action/subscriptions.py` L250-L280

terminal 상태가 처음 관찰된 시각을 `finished_at`으로 저장한다.

```text
started_at = accepted_at이 있으면 accepted_at
             없으면 executing_at

elapsed_time_ms
= (finished_at - started_at) × 1000
```

시작 시각이나 종료 시각이 없으면 `None`이다.

### 8.2 Interface Lab Service 응답 시간

- 성공 코드: `interface_lab/execution/service_call_runtime.py` L128-L147
- 실패 코드: `interface_lab/execution/service_call_runtime.py` L160-L179
- 검증 실패 코드: `interface_lab/execution/service_call_runtime.py` L425-L445

```text
elapsed_ms = (현재 시각 - Call 처리 시작 시각) × 1000
```

성공만 재는 값이 아니다. timeout, 호출 오류, 전송 전 validation 실패도
각 처리 시작부터 결과를 만든 시점까지의 경과 시간을 기록한다.

### 8.3 Interface Lab Action Goal 경과 시간

코드: `interface_lab/execution/action_goal_runtime.py` L570-L594

```text
elapsed_ms = (결과 payload 생성 시각 - Goal 처리 시작 시각) × 1000
```

이 값은 Goal 전송 함수 전체 처리 경과 시간이다.
위의 관찰 Action `elapsed_time_ms`처럼 accepted와 terminal status 사이만 재는 값과 범위가 다르다.

---

## 9. Alert 시간과 집계

### 9.1 Topic 미수신 Alert

코드: `topic/alerts.py` L228-L258

```text
마지막 수신이 없고
detected_at - first_observed_at > stale_timeout_sec
→ topic_message_missing
```

처음 관찰한 시각이 없거나 timeout 이하이면 아직 Alert를 만들지 않는다.

### 9.2 Topic stale Alert

코드: `topic/alerts.py` L260-L277

```text
age_sec = detected_at - last_received_at

age_sec > stale_timeout_sec
→ topic_stale
```

### 9.3 MonitorStatus 경과 시간

코드: `topic/alerts.py` L300-L337

```text
last_received_at이 있으면:
    age_sec = detected_at - last_received_at

없으면:
    age_sec = None
```

### 9.4 Service Call timeout 경과 시간

코드: `service/alerts.py` L24-L45

```text
age_sec = max(0.0, detected_at - last_called_at)
```

시계 차이 등으로 음수가 되지 않도록 0을 최솟값으로 둔다.

### 9.5 Alert 요약

코드: `topic/alerts.py` L130-L158

```text
active_alerts
= alert_state가 resolved가 아닌 Alert

count = 전달받은 전체 Alert 수
active_count = active_alerts 수
resolved_count = count - active_count

info_count / warning_count / error_count / critical_count
= active_alerts 중 각 level의 수
```

심각도별 수에는 해결된 Alert가 포함되지 않는다.

---

## 10. Graph 연결 종료 시 값

코드: `resource_state.py` L24-L44

이전에 발견된 리소스가 현재 Graph에서 사라지면:

```text
status = disconnected
graph_present = false
ever_discovered = true
disconnected_at = 기존 값이 있으면 유지, 없으면 현재 감지 시각
last_updated = 현재 감지 시각
지정된 count 필드 = 0
```

Topic count 초기화 호출:

```text
topic/runtime.py L187-L220
```

Service count 초기화 호출:

```text
service/runtime.py L138-L143
```

Action count 초기화 호출:

```text
action/runtime.py L143-L148
```

---

## 11. 목록 요약 건수

### Node

코드: `node/models.py` L56-L92

```text
count = Node 목록 길이
active_count = status가 active인 Node 수
warning_count = status가 stale인 Node 수
error_count = status가 disconnected인 Node 수

publisher_count 등 역할별 count
= 각 Node가 가진 해당 역할 count의 합
```

### Service

코드: `service/models.py` L66-L168

```text
count / visible_count = 현재 화면 Service 목록 길이
hidden_count = 전체 집계 대상 중 hidden_by_default가 true인 수
분류별 count = category가 해당 값인 Service 수
active / warning / error count = 상태 조건에 맞는 Service 수
```

Service `error_count`는 `disconnected`이면서 기본 숨김 Service가 아닌 항목만 센다.

### Action

코드: `action/models.py` L114-L158

```text
count = Action 목록 길이
active_count = active 수
warning_count = waiting_server 수
error_count = disconnected 수
server_count / client_count = 각 Action 원본 endpoint count의 합
observed_goal_count = 각 Action runtime의 관찰 Goal 수 합
```

여기서 meta의 `server_count`, `client_count`는 Dashboard 제외 고유 Node 수가 아니라
각 Action의 원본 endpoint 수를 합산한 값이다.
