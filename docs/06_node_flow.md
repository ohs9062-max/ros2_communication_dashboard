# Node Monitoring 흐름

## 1. 기능을 한 문장으로 설명

Node Monitoring은 현재 Node를 발견하고 각 Node가 어떤 Topic, Service, Action에 참여하는지 관계를 묶어 목록과 Visualization에 제공한다.

## 2. 전체 흐름

```text
ROS2 Graph에서 Node 발견
→ Node별 Topic/Service/Action 관계 조회
→ 이름과 full_type을 관계 배열로 저장
→ 이전 cache와 비교
→ last_seen_at 갱신 또는 disconnected 판정
→ /ros/nodes 응답
→ Nodes/Overview/Visualization 표시
```

## 3. 단계별 쉬운 설명

### 1) Node 목록을 가져온다

- 파일: `node/runtime.py L72~L161`
- 역할: `get_node_names_and_namespaces()`로 현재 Node를 가져온다. 내부 monitor Node도 Backend 관계 집계에는 포함하고 Frontend 주요 항목에서 숨길 수 있다.
- 입력: Node name과 namespace
- 다음 흐름: 각 Node의 통신 관계를 조회한다.

### 2) 여섯 종류 관계를 모은다

- 파일: `node/runtime.py L162~L227`
- 파일: `node/discovery.py L14~L57`
- 출력 관계:
  - `topic_publishers`
  - `topic_subscribers`
  - `service_servers`
  - `service_clients`
  - `action_servers`
  - `action_clients`
- 왜 타입도 저장하는가: 같은 이름이라도 다른 Interface 타입일 수 있으므로 주요 Node 판정은 `full_type` exact match가 필요하다.

### 3) 현재 발견 시각을 기억한다

- 파일: `resource_state.py L11~L23`
- 현재 보이면:
  - `graph_present=true`
  - `ever_discovered=true`
  - `last_seen_at` 갱신

### 4) 이전에 보였던 Node가 사라졌는지 판단한다

- 파일: `node/runtime.py L72~L161`
- 파일: `resource_state.py L24~L44`
- 이전 cache에는 있지만 현재 Graph에 없으면 `disconnected`로 만든다.
- 마지막 관계를 남기는 이유: 어떤 통신에 참여하던 Node가 사라졌는지 화면에서 설명하기 위해서다.
- Backend 시작 후 한 번도 발견하지 않은 선택 항목은 빨간 종료 오류로 만들지 않는다.

### 5) Node Alert를 만든다

- 파일: `node/alerts.py L13~L42`
- 조건: 이전에 발견한 Node가 현재 `disconnected`
- level: error
- code: API 호환을 위해 `node_stale`
- 의미: 시간 지연 stale이 아니라 Graph 연결 끊김이다.

### 6) API와 Frontend로 전달한다

- 파일: `routers/monitoring.py L73~L83`
- 파일: `hooks/useNodeDashboard.js L6~L66`
- 파일: `pages/NodesPage.jsx L16~L169`
- 역할: `/ros/nodes`를 3초마다 읽고 목록, 필터, 상세에 전달한다.

### 7) 주요 Node를 판정한다

- 파일: `utils/nodeFilters.js L1~L77`
- 파일: `utils/primaryFilters.js L1~L78`

```text
주요 Topic을 publish/subscribe
또는 주요 Service의 Server/Client
또는 주요 Action의 Server/Client
→ 주요 Node
```

등록 Interface가 있다는 이유만으로 관계없는 Node를 주요 항목에 넣지 않는다. Nav2/TurtleBot 이름 fallback은 사용하지 않으며, Dashboard Node는 Backend가 추가한 `is_internal`로 숨긴다.

### 8) Visualization 연결선으로 바꾼다

- 파일: `utils/participants.js L1~L90`
- 파일: `utils/graphTransform.js L18~L176`
- 역할: Node 관계 배열을 화면용 node와 edge로 바꾼다.
- 다음 흐름: `VisualizationPage.jsx`가 React Flow로 그린다.

## 4. 실제 코드 위치

| 기능 | 코드 위치 |
|---|---|
| Node cache/snapshot | `node/runtime.py L28~L71` |
| Graph와 관계 갱신 | `node/runtime.py L72~L161` |
| 관계 item 생성 | `node/discovery.py L14~L57` |
| 발견/종료 상태 | `resource_state.py L11~L44` |
| Alert | `node/alerts.py L13~L42` |
| Frontend 주요 Node | `nodeFilters.js L1~L77` |

## 5. 입력 데이터

- Node name/namespace
- Node별 Publisher/Subscriber
- Service Server/Client
- Action Server/Client

## 6. 처리 과정

Backend는 현재 관계를 하나의 Node item으로 만들고 이전 item과 비교한다. Frontend는 이 관계 타입을 주요 리소스 타입과 비교한다.

통신 탭은 같은 관계를 리소스 방향으로 역집계해 연결된 고유 Node 수를 표시한다. 공통 키는 `(역할, 리소스 전체 이름, full_type)`이고 값은 활성 Node 전체 이름의 집합이다. 구현은 `topology.py L19~L54`, snapshot 병합은 `ros_monitor.py L126~L232`, `L274~L318`이다.

## 7. 출력 데이터

- Node 상태와 발견 시각
- Dashboard 내부 Node 여부 `is_internal`
- 여섯 관계 배열
- 연결 수
- `node_stale` disconnected Alert

## 8. 다음 단계와 연결

관계가 그래프로 바뀌는 과정은 [10_visualization_flow.md](10_visualization_flow.md), Alert 유지 과정은 [07_alert_flow.md](07_alert_flow.md)로 이어진다.

## 9. 핵심 요약

1. Node는 이름만이 아니라 실제 통신 관계까지 수집한다.
2. 한 번 발견된 Node가 사라질 때만 disconnected가 된다.
3. 관계 배열이 주요 Node와 Visualization 연결선의 공통 근거다.
