# Node Alert 정책

## 개요

Node Alert는 **이전에 ROS2 Graph에서 발견되었던 Node가 현재 사라진 경우**에 생성됩니다.
처음부터 발견되지 않은 Node에 대해서는 Alert를 생성하지 않습니다.

---

## Alert 코드 목록

### 1. `node_stale`

| 항목 | 내용 |
|---|---|
| **Alert ID** | `node:<full_name>:node_stale` |
| **Level** | 🔴 `error` |
| **대상 Kind** | Node |
| **발생 조건** | • `node.status == 'disconnected'`<br>&nbsp;&nbsp;(이전 Graph 조회에서 발견됐으나 현재 조회에서 사라짐)<br>• Node가 `stale_timeout_sec` 이상 Graph에서 보이지 않을 때<br>&nbsp;&nbsp;`disconnected` 상태로 전환됨 |
| **판정 데이터** | `node.status`, `node.full_name`, `node.last_seen_at` |
| **사용자 메시지** | `Node connection lost; it is no longer visible in the ROS2 graph.` |
| **해제 조건** | Node가 Graph에 다시 나타남 (`status == 'active'`) |
| **설정 가능 여부** | `monitor.yaml` → `nodes.stale_timeout_sec` (기본값: `5.0초`) |
| **소스 코드** | [ros2_node/alerts.py:13-43](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_node/alerts.py#L13-L43) |

---

## Node 상태 전이 모델

```text
[미발견] ─── Graph 발견 ──→ [active]
                                │
                                │ Graph에서 사라짐
                                ▼
                            [stale] ←── stale_timeout_sec 이내
                                │
                                │ stale_timeout_sec 경과
                                ▼
                          [disconnected] ──→ node_stale Alert (ERROR)
                                │
                                │ Graph에 다시 나타남
                                ▼
                            [active] ──→ Alert 해제
```

### Node Status 값 정의

| 상태값 | 의미 | Alert |
|---|---|---|
| `active` | Graph에 현재 존재 | 없음 |
| `stale` | Graph에서 사라졌으나 `stale_timeout_sec` 이내 | 없음 (유예 구간) |
| `disconnected` | Graph에서 `stale_timeout_sec` 이상 보이지 않음 | `node_stale` (ERROR) |
| `inactive` | 비활성 상태 | 없음 |
| `unknown` | 상태 불명 | 없음 |

---

## Node Alert 판정 흐름도

```text
Node Alert 판정:
│
├─ Graph에서 처음부터 발견된 적 없음 → Alert 없음
│
├─ status == 'active' → Alert 없음 (정상)
│
├─ status == 'stale' → Alert 없음 (유예 구간)
│
└─ status == 'disconnected' → node_stale (ERROR)
```

---

## disconnected 판정 로직 상세

Node의 `disconnected` 상태는 `resource_state.py`의 `disconnected_resource()` 함수에서 설정됩니다:

1. **이전 Graph 조회**에서 Node가 발견되어 `ever_discovered = true`, `last_seen_at` 기록
2. **현재 Graph 조회**에서 Node가 보이지 않음
3. `node_runtime.py`에서 `stale_timeout_sec` 경과 확인 후 `status = 'disconnected'` 설정
4. `disconnected_at`에 최초 이탈 시각 기록 (이후 반복 조회에서도 유지)

```python
# resource_state.py
item['status'] = 'disconnected'
item['graph_present'] = False
item['ever_discovered'] = True
item['disconnected_at'] = cached.get('disconnected_at') or detected_at
```

---

## 관련 설정 키 (monitor.yaml)

| YAML 키 | 기본값 | 역할 |
|---|---|---|
| `nodes.stale_timeout_sec` | `5.0` | Node가 Graph에서 사라진 후 `disconnected`로 전환하기까지의 유예 시간 (초) |
| `nodes.include_names` | `[]` | 감시 대상 Node 포함 목록 |
| `nodes.exclude_names` | `[]` | 감시 대상 Node 제외 목록 |
| `nodes.exclude_prefixes` | `[]` | 접두사 기준 Node 제외 목록 |
| `nodes.primary_names` | `[]` | 주요 Node로 표시할 이름 목록 |
