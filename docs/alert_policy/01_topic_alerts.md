# Topic Alert 정책

## 개요

Topic Alert는 **자동 감시 대상 Topic**의 메시지 수신 상태를 기반으로 생성됩니다.
Alert 대상이 되려면 아래 조건 중 하나를 만족해야 합니다:

1. `monitor.yaml`의 `topics.required_stream_names`에 등록된 필수 스트림
2. Interface Lab Registry에 등록되어 `registered_interface_type = true`인 Topic

`monitor.yaml`의 `topics.command_names`에 포함된 Topic (예: `/cmd_vel`)은 명령 채널로 분류되어 **Alert 대상에서 제외**됩니다.

---

## Alert 코드 목록

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
| **소스 코드** | [ros2_topic/alerts.py:210-223](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py#L210-L223) |

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
| **소스 코드** | [ros2_topic/alerts.py:228-258](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py#L228-L258) |

> [!IMPORTANT]
> `missing`과 `stale`의 핵심 차이:
> - **missing**: 감시 Subscription이 생성됐지만 **한 번도 수신하지 못한** 상태
> - **stale**: 이전에 수신한 적 있으나 기준 시간을 **초과**한 상태

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
| **소스 코드** | [ros2_topic/alerts.py:260-278](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py#L260-L278) |

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
| **소스 코드** | [ros2_topic/alerts.py:183-199](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py#L183-L199) |

---

### 5. `monitor_status_<level>` (MonitorStatus 메시지 기반)

| 항목 | 내용 |
|---|---|
| **Alert ID** | `monitor_status:<topic_name>:<device_name>:<level>[:<status>]` |
| **Level** | ⚠️ `warning` / 🔴 `error` / 🔥 `critical` (메시지 내용에 따라 동적) |
| **대상 Kind** | Topic (타입이 `ros2_dashboard_interfaces/msg/MonitorStatus`인 Topic) |
| **발생 조건** | • Topic 타입이 `ros2_dashboard_interfaces/msg/MonitorStatus`<br>• 수신한 메시지의 `level` 필드가 `warning`, `error`, `critical` 중 하나<br>• `info` 수준은 Alert 생성하지 않음 |
| **판정 데이터** | `message_preview.level`, `message_preview.device_name`, `message_preview.status`, `message_preview.message`, `message_preview.values` |
| **사용자 메시지** | 메시지의 `message` 필드 값 (없으면 `MonitorStatus reported <level>.`) |
| **해제 조건** | 해당 Topic에서 더 낮은 level의 메시지 수신 또는 메시지 미수신 |
| **설정 가능 여부** | `topics.supported_types`에 MonitorStatus 포함 필요 |
| **소스 코드** | [ros2_topic/alerts.py:282-359](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py#L282-L359) |

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
| `topics.supported_types` | (기본 7개 타입) | 딥 모니터링 대상 메시지 타입 |
