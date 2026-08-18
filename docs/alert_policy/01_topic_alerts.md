# Topic Alert 정책

## 개요

Topic Alert는 **자동 감시 대상 Topic**의 메시지 수신 상태를 기반으로 생성됩니다.
Alert 대상이 되려면 아래 조건 중 하나를 만족해야 합니다:

1. `monitor.yaml`의 `topics.required_stream_names`에 등록된 필수 스트림
2. Interface Lab Registry에 등록되어 `registered_interface_type = true`인 Topic

목록과 Alert의 resource 원천은 실제 ROS2 Graph다. 설정에 이름만 있고 Graph endpoint가 한 번도 발견되지 않은
Topic은 목록이나 Alert용 placeholder로 만들지 않는다. `required_stream_names`는 발견된 Topic을 필수 스트림으로
분류하며, 해당 Topic은 Graph에 Subscriber 등으로 남아 있지만 Publisher가 없을 때 `waiting_publisher`가 된다.

`monitor.yaml`의 `topics.command_names`에 포함된 Topic (예: `/cmd_vel`)은 명령 채널로 분류되어 **Alert 대상에서 제외**됩니다.
command Topic은 메시지를 한 번도 받지 않았더라도 목록 대표 `effective_status`를 `never_received` 오류로 올리지
않고 Graph 상태인 `waiting_publisher` 또는 현재 연결 상태로 표시합니다. latest/Hz/수신 진단 데이터는 유지합니다.

---

## Alert 코드 목록

### `topic_qos_incompatible`

주요/등록/감시 Topic에서 이미 계산된 QoS가 `incompatible`로 서로 다른 Graph 갱신 3회(설정 가능)
연속 확인될 때 생성합니다. 일부 endpoint 조합 불일치는 `warning`, RMW incompatible 이벤트 또는 Dashboard
적용 QoS가 모든 상대 endpoint와 불가능하면 `error`입니다. `partial`, `unknown`, 미수신 추정은 제외하며
compatible 복귀나 endpoint 소멸 시 해결됩니다. ID는 `topic:<name>:topic_qos_incompatible`입니다.

### 1. `waiting_publisher`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `topic:<topic_name>:waiting_publisher` |
| **Level** | ⚠️ `warning` |
| **대상 Kind** | Topic |
| **발생 조건** | • 감시 대상 Topic이면서<br>• `publisher_count == 0` (Graph에 Publisher가 없음) |
| **판정 데이터** | `topic.publisher_count`, `topic.name` |
| **사용자 메시지** | `Subscriber exists but no publisher is available.` |
| **해제 조건** | Publisher가 Graph에 다시 나타남 (`publisher_count > 0`) |
| **설정 가능 여부** | `required_stream_names` 또는 Interface Registry 등록으로 대상 결정 |
| **소스 코드** | [`ros2_topic/alerts.py`](../../ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py) |

---

### 2. `topic_message_missing`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `topic:<topic_name>:topic_message_missing` |
| **Level** | ⚠️ `warning` |
| **대상 Kind** | Topic |
| **발생 조건** | • Publisher가 존재 (`publisher_count > 0`)<br>• Dashboard 감시 Subscription이 생성되었음<br>• **한 번도 메시지를 수신한 적 없음** (`last_received_at == None`)<br>• Subscription 생성 후 `stale_timeout_sec` 이상 경과<br>&nbsp;&nbsp;(`detected_at - first_observed_at > stale_timeout_sec`) |
| **판정 데이터** | `subscription.last_received_at`, `subscription.created_at`, `config.stale_timeout_sec` |
| **사용자 메시지** | `Topic publisher exists but no message has been received.` |
| **Hz 상태** | `never_received` |
| **해제 조건** | 첫 메시지 수신 (`last_received_at`에 값이 기록됨) |
| **정상 예외** | Subscription 생성 직후 `stale_timeout_sec` 이내이면 아직 Alert를 생성하지 않음 (유예 구간) |
| **설정 가능 여부** | `monitor.yaml` → `monitor.stale_timeout_sec` (기본값: `3.0초`) |
| **소스 코드** | [`ros2_topic/alerts.py`](../../ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py) |

> [!IMPORTANT]
> `missing`과 `stale`의 핵심 차이:
> - **missing**: 감시 Subscription이 생성됐지만 **한 번도 수신하지 못한** 상태
> - **stale**: 이전에 수신한 적 있으나 기준 시간을 **초과**한 상태

목록과 Topic 상세의 `reception_diagnosis`는 새 Alert를 만들지 않고 기존 근거를 연결합니다.
Subscription 생성 실패를 최우선으로 표시하고, RMW incompatible event는 확정 원인, Graph QoS
incompatible는 원인 후보로 구분합니다. QoS compatible이면 실제 Publisher 발행과 callback/type 경로를
확인하도록 안내하며, unknown/observed는 원인 확인 불가로 표시합니다. Alert payload에는 관련
`topic_qos_incompatible` ID를 함께 넣을 수 있지만 MariaDB 스키마와 Alert key는 바꾸지 않습니다.

---

### 3. `topic_stale`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `topic:<topic_name>:topic_stale` |
| **Level** | ⚠️ `warning` |
| **대상 Kind** | Topic |
| **발생 조건** | • Publisher가 존재 (`publisher_count > 0`)<br>• Dashboard 감시 Subscription이 생성되었음<br>• 이전에 메시지를 수신한 적 있음 (`last_received_at != None`)<br>• 마지막 수신 이후 `stale_timeout_sec` 초과<br>&nbsp;&nbsp;(`detected_at - last_received_at > stale_timeout_sec`) |
| **판정 데이터** | `subscription.last_received_at`, `config.stale_timeout_sec`, 현재 시각 |
| **사용자 메시지** | `Topic message has not been received within stale timeout.` |
| **Hz 상태** | `stale` |
| **age_sec** | `detected_at - last_received_at` (경과 시간을 함께 기록) |
| **해제 조건** | 새 메시지 수신 (`age_sec ≤ stale_timeout_sec`) |
| **설정 가능 여부** | `monitor.yaml` → `monitor.stale_timeout_sec` (기본값: `3.0초`) |
| **소스 코드** | [`ros2_topic/alerts.py`](../../ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py) |

상세 진단에서는 Publisher가 계속 Graph에 있으면 `데이터 중단`, Publisher가 없으면 `Publisher 이탈/중단
가능성`으로 구분합니다. 기존 required/등록 대상 Alert 조건과 command 예외는 그대로입니다.

---

### 4. `topic_disconnected`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `topic:<topic_name>:topic_disconnected` |
| **Level** | 🔴 `error` |
| **대상 Kind** | Topic |
| **발생 조건** | • 감시 대상 Topic이면서<br>• `topic.status == 'disconnected'`<br>&nbsp;&nbsp;(이전에 Graph에 존재했으나 현재 사라진 상태) |
| **판정 데이터** | `topic.status`, `topic.last_seen_at` |
| **사용자 메시지** | `Topic connection lost; it is no longer visible in the ROS2 graph.` |
| **해제 조건** | Topic이 Graph에 다시 나타남 (`graph_present = true`) |
| **설정 가능 여부** | 대상 Topic 결정은 `required_stream_names` 또는 Interface Registry |
| **소스 코드** | [`ros2_topic/alerts.py`](../../ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py) |

---

### 5. MonitorStatus 3종 (MonitorStatus 메시지 기반)

실제 code는 level에 따라 `monitor_status_warning`, `monitor_status_error`,
`monitor_status_critical` 중 하나입니다. 따라서 현재 전체 21종을 셀 때 3개 code로 계산합니다.

| 항목 | 내용 |
|---|---|
| **Alert ID** | `monitor_status:<topic_name>:<device_name>:<level>[:<status>]` |
| **Level / code** | `warning` / `monitor_status_warning`<br>`error` / `monitor_status_error`<br>`critical` / `monitor_status_critical` |
| **대상 Kind** | Topic (타입이 `ros2_dashboard_interfaces/msg/MonitorStatus`인 Topic) |
| **발생 조건** | • Topic 타입이 `ros2_dashboard_interfaces/msg/MonitorStatus`<br>• 수신한 메시지의 `level` 필드가 `warning`, `error`, `critical` 중 하나<br>• `info` 수준은 Alert 생성하지 않음 |
| **판정 데이터** | `message_preview.level`, `message_preview.device_name`, `message_preview.status`, `message_preview.message`, `message_preview.values` |
| **사용자 메시지** | 메시지의 `message` 필드 값 (없으면 `MonitorStatus reported <level>.`) |
| **해제 조건** | 해당 Topic에서 더 낮은 level의 메시지 수신 또는 메시지 미수신 |
| **설정 가능 여부** | `topics.supported_types`에 MonitorStatus 포함 필요 |
| **소스 코드** | [`ros2_topic/monitor_status_alerts.py`](../../ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/monitor_status_alerts.py) |

---

## Topic Alert 판정 흐름도

```text
Topic 감시 대상인가?
├─ command_names에 포함 → Alert 없음
├─ required_stream_names에도 없고 registered_interface_type도 아님 → Alert 없음
│
├─ status == 'disconnected' → topic_disconnected (ERROR)
│
├─ publisher_count == 0 → waiting_publisher (WARNING)
│
├─ publisher_count > 0 AND subscription 존재
│  ├─ last_received_at == None
│  │  ├─ stale_timeout_sec 이내 → 아직 대기 (Alert 없음)
│  │  └─ stale_timeout_sec 초과 → topic_message_missing (WARNING)
│  │
│  └─ last_received_at != None
│     ├─ age_sec ≤ stale_timeout_sec → 정상 (Alert 없음)
│     └─ age_sec > stale_timeout_sec → topic_stale (WARNING)
│
└─ MonitorStatus 타입 Topic
   ├─ level == info → Alert 없음
   └─ level in (warning, error, critical) → monitor_status_<level>
```

---

## 관련 설정 키 (monitor.yaml)

| YAML 키 | 기본값 | 역할 |
|---|---|---|
| `monitor.stale_timeout_sec` | `3.0` | missing/stale 판정 기준 시간 (초) |
| `monitor.hz_window_sec` | `5.0` | Hz 계산 시 사용하는 타임스탬프 윈도우 (초) |
| `topics.required_stream_names` | `[]` | 필수 감시 스트림 Topic 목록 |
| `topics.command_names` | `[]` | Alert 제외 대상 명령 Topic 목록 |
| `topics.supported_types` | (기본 9개 타입) | 딥 모니터링 대상 메시지 타입 |
