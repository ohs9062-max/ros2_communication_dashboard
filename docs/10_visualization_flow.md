# Visualization 흐름

## 1. 기능을 한 문장으로 설명

Visualization은 네 REST API의 리소스와 Node 관계를 조합해 “누가 무엇과 통신하는지” 연결 그림으로 보여준다.

React Flow는 관계를 분석하는 도구가 아니라 Frontend가 만든 `nodes`와 `edges`를 화면에 그리는 라이브러리다.

## 2. 전체 흐름

```text
/ros/topics + /ros/services + /ros/actions + /ros/nodes
→ useVisualizationGraph
→ 주요 항목과 관계 대상 선택
→ graphTransform
→ nodes/edges 생성
→ React Flow 렌더링
→ 검색, 전체 Graph, 1-hop 표시
```

## 3. 단계별 쉬운 설명

### 1) 네 API를 함께 요청한다

- 파일: `hooks/useVisualizationGraph.js L17~L214`
- 주기: 5초
- 입력: Topic, Service, Action, Node REST 응답
- 왜 네 개가 필요한가: Node 관계만으로는 각 리소스의 현재 상태와 주요 항목 여부를 모두 알 수 없기 때문이다.

### 2) 관계 참여자를 묶는다

- 파일: `utils/participants.js L1~L88`
- 역할: Node의 여섯 관계 배열을 리소스 이름별 Server/Client 또는 Publisher/Subscriber 목록으로 바꾼다.

### 3) 주요 항목을 고른다

- 파일: `utils/primaryFilters.js L17~L79`
- 파일: `utils/nodeFilters.js L22~L101`
- 등록 msg/srv/action 타입과 Graph 타입이 exact match한 리소스, 그리고 실제로 그 통신에 참여한 Node를 포함한다.
- 관계없는 모든 Node를 등록 타입만 보고 포함하지 않는다.

### 4) 화면용 node와 edge를 만든다

- 파일: `utils/graphTransform.js L18~L176`
- 역할:
  - ROS Node, Topic, Service, Action을 화면 node로 변환
  - publisher/subscriber/server/client 관계를 edge로 변환
  - 상태와 검색용 정보를 붙임

관계 예:

```text
Node → Topic       Publisher
Topic → Node       Subscriber
Node ↔ Service     Server / Client
Node ↔ Action      Server / Client
```

### 5) 레이아웃과 필터를 적용한다

- 파일: `utils/graphTransform.js L356~L689`
- 역할: node 위치, 연결 수, 검색, 숨김, 주요 항목, active 상태 필터를 적용한다.

### 6) React Flow가 그린다

- 파일: `pages/VisualizationPage.jsx L11~L364`
- 역할: 만들어진 nodes/edges를 렌더링하고 선택, 확대/축소, 표시 mode를 관리한다.

### 7) 1-hop을 표시한다

- 파일: `utils/graphTransform.js L185~L355`
- 1-hop은 선택한 항목과 직접 연결된 이웃만 남기는 화면 필터다.
- Backend Graph 조회 방식이나 원본 관계를 변경하지 않는다.

### 8) 한 번의 polling 차이를 완화한다

- 파일: `hooks/useVisualizationGraph.js L238~L275`
- 역할: 네 API의 도착 시각이 잠깐 다를 때 이전 안정적인 graph를 보조적으로 유지해 과도한 깜빡임을 줄인다.

## 4. 실제 코드 위치

| 기능 | 코드 위치 |
|---|---|
| API 요청과 graph state | `useVisualizationGraph.js L17~L275` |
| 참여자 map | `participants.js L1~L88` |
| graph 생성 | `graphTransform.js L18~L176` |
| Node 중심 graph | `graphTransform.js L185~L355` |
| filter/layout | `graphTransform.js L356~L689` |
| 화면 렌더링 | `VisualizationPage.jsx L11~L385` |

## 5. 입력 데이터

- 네 `/ros/*` REST 목록
- Node 관계 배열
- 주요 항목 filter 결과
- 사용자의 검색과 선택

## 6. 처리 과정

Frontend는 REST item을 이름과 타입으로 연결한다. 타입 정보가 있는 관계는 full type exact match를 사용한다. `disconnected`와 `unknown` 상태도 REST 값을 그대로 보존한다.

## 7. 출력 데이터

- React Flow `nodes`
- React Flow `edges`
- 선택 항목 상세
- 전체 Graph 또는 1-hop view

## 8. 다음 단계와 연결

Node 관계 생성은 [06_node_flow.md](06_node_flow.md), Frontend 공통 polling과 상태 표시는 [09_frontend_flow.md](09_frontend_flow.md)로 이어진다.

## 9. 핵심 요약

1. 관계의 원본은 Backend `/ros/nodes`와 각 리소스 REST 응답이다.
2. React Flow는 완성된 nodes/edges를 그릴 뿐 관계를 추론하지 않는다.
3. 주요 항목 목록과 Visualization은 같은 타입 기반 helper를 사용한다.
