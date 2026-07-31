# Node 흐름

## 한 문장으로 보기

Node Runtime은 각 Node가 가진 Topic·Service·Action 역할 목록을 Graph API로 모으고, 리소스 탭은 이 Node 관계를 반대 방향으로 집계해 “이 Topic을 구독하는 Node 수” 같은 값을 만든다.

## 쉬운 용어

| 용어 | 뜻 |
|---|---|
| Node 전체 이름 | namespace와 name을 합친 이름; 예: `/demo/worker` |
| 관계 | Node가 특정 Resource에서 publisher/server/client 등의 역할을 가진 연결 |
| 역집계 | Node → 리소스 목록을 반대로 읽어 리소스 → Node 목록을 만드는 것 |
| disconnected | 이전에는 Graph에 있었지만 현재 조회에서 사라진 상태 |
| internal Node | Dashboard 자체가 감시나 Interface Lab 통신을 위해 만든 Node |

## Node 관계 수집

```text
get_node_names_and_namespaces()
→ 각 Node별 publisher/subscriber/service/action API
→ Node 관계 배열
→ Node Cache
→ 사라진 Node 보존
→ GET /ros/nodes
```

1. **Node 목록 발견:** `get_node_names_and_namespaces()`로 현재 Graph의 Node 이름과 namespace를 가져온다.

2. **Node별 역할 조회:** 각 Node가 발행·구독하는 Topic과 Service·Action의 Server·Client 역할을 조회한다.

3. **관계 배열 생성:** 조회 결과를 Node별 Publisher, Subscriber, Service, Action 연결 목록으로 정리한다.

4. **Node Cache:** 정리한 Node와 관계를 Cache에 저장해 API 요청마다 Graph를 다시 조사하지 않게 한다.

5. **사라진 Node 보존:** 이전 Cache에는 있지만 현재 Graph에서 보이지 않는 Node를 `disconnected`로 남긴다.

6. **Node API:** `/ros/nodes`가 현재 Node와 `disconnected` Node를 포함한 최신 Cache를 반환한다.

| 단계 | 파일·함수 | 함수 전체 L | 핵심 L | 먼저 볼 내용 |
|---:|---|---:|---:|---|
| 1 | `node/runtime.py` `update()` | `node/runtime.py` L72-L159 | `node/runtime.py` L78-L90 | Node 목록과 include/exclude 적용 |
| 2 | `node/runtime.py` `update()` | `node/runtime.py` L72-L159 | `node/runtime.py` L92-L130 | 여섯 역할의 Graph 관계를 `build_node_item()`에 전달 |
| 3 | `node/runtime.py` `update()` | `node/runtime.py` L72-L159 | `node/runtime.py` L136-L152 | 이번 Graph에서 사라진 기존 Node를 disconnected로 보존 |
| 4 | `node/runtime.py` `_graph_by_node()` | `node/runtime.py` L170-L186 | `node/runtime.py` L176-L186 | Topic/Service별 Node Graph API 공통 호출 |
| 5 | `node/runtime.py` `_action_servers_by_node()` | `node/runtime.py` L189-L207 | `node/runtime.py` L194-L199 | Node별 Action Server 조회 |
| 6 | `node/runtime.py` `_action_clients_by_node()` | `node/runtime.py` L210-L228 | `node/runtime.py` L215-L220 | Node별 Action Client 조회 |
| 7 | `ros_monitor.py` `node_snapshot()` | `ros_monitor.py` L546-L552 | `ros_monitor.py` L548-L552 | Dashboard Node에 `is_internal` 표시 |
| 8 | `monitoring.py` `get_ros_nodes()` | `monitoring.py` L73-L83 | `monitoring.py` L76-L82 | Node API 반환 |
| 9 | `useNodeDashboard.js` → `NodesPage.jsx` | `useNodeDashboard.js` L6-L66 → `NodesPage.jsx` L16-L168 | `useNodeDashboard.js` L10-L18, `NodesPage.jsx` L35-L60 | Node API를 polling하고 주요·전체·실행 중·종료 감지·숨김 포함 필터로 최종 목록을 표시한다. |

1~6은 Node별 통신 관계 수집, 7~9는 내부 Node 표시·API·화면 필터 단계다.

`Node 발행 Topic 수`는 메시지 발행 횟수가 아니라 `topic_publishers` 관계 배열의 고유 Topic 수다. Service Server 수와 Action Client 수도 같은 원리다.

## 공통 Topology 역집계

```text
Node Cache
→ build_role_node_index()
→ (역할, 리소스 전체 이름, 전체 타입)별 고유 Node 집합
→ related_nodes()
→ Topic/Service/Action API의 Node 수
```

1. **활성 관계 읽기:** Node Cache에서 현재 Graph에 존재하는 Node의 여섯 통신 관계를 읽는다.

2. **역할별 인덱스:** 역할, 리소스 이름, exact 타입을 key로 연결된 Node 이름을 고유 집합에 넣는다.

3. **리소스별 조회:** Topic·Service·Action snapshot이 필요한 역할과 이름·타입으로 인덱스를 조회한다.

4. **내부 Node 제외:** 기본 Node 수와 목록에서는 Dashboard 자체 Node를 제거한다.

5. **리소스 탭 반영:** 남은 목록 길이를 Publisher, Subscriber, Server, Client Node 수로 표시한다.

| 파일·함수 | 함수 전체 L | 핵심 L | 의미 |
|---|---:|---:|---|
| `topology.py` `build_role_node_index()` | `topology.py` L19-L39 | `topology.py` L24-L38 | 활성 Node의 여섯 관계 배열을 고유 Node 집합으로 변환 |
| `topology.py` `related_nodes()` | `topology.py` L42-L54 | `topology.py` L50-L54 | 역할·이름·타입이 맞는 Node 이름 정렬 |
| `ros_monitor.py` `_role_node_index()` | `ros_monitor.py` L554-L555 | `ros_monitor.py` L555 | Node snapshot을 공통 인덱스로 변환 |

따라서 리소스 탭과 Node 탭은 같은 관계 데이터를 반대 방향에서 보여준다. 단, Topic·Service·Action 탭은 `ros_monitor.py` `_without_internal_node()` L797-L802로 Dashboard 내부 Node를 제외한 수와 목록을 기본값으로 사용하고 `Dashboard 통신` 배지로 내부 목적을 별도 표시한다. Node 탭은 내부 Node에 `is_internal`을 표시한 뒤 화면 필터 정책에 따라 숨기거나 보여준다.

## 주요/전체/숨김 필터

1. **주요 Node:** 등록·지원 Topic, Service, Action 타입과 관계가 있거나 연결 종료가 감지된 Node를 고른다.

2. **보조 Node 제외:** transform listener, launch helper, Action Client 보조 Node와 Dashboard 내부 Node를 제외한다.

3. **전체 범위:** 전체는 Dashboard 내부 Node와 `ros2cli_daemon`을 제외한 나머지 Node를 표시한다.

4. **숨김 포함:** 숨김 포함은 Dashboard 내부 Node까지 확인하도록 범위를 넓힌다.

- 주요: 숨김 대상이 아니고, 등록·지원 Topic/Service/Action 타입 관계가 있거나 disconnected인 Node.
- 전체: Dashboard 내부 Node와 `ros2cli_daemon`을 제외한 모든 Node.
- 숨김 포함: 내부 Dashboard Node까지 포함한 모든 Node.
- 주요 숨김 대상: transform listener, launch helper, `_rclcpp_node`, `_action_client`, Dashboard 내부 Node.

`nodeFilters.js isPrimaryNode()` 함수 전체는 `nodeFilters.js` L11-L25, 실제 조건은 `nodeFilters.js` L17-L24, 관계 타입 비교는 `nodeFilters.js` L27-L56, 숨김 판정은 `nodeFilters.js` L59-L66이다. 화면 적용은 `NodesPage.jsx` L35-L60이다.
