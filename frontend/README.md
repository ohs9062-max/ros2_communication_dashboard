# ROS2 Dashboard Frontend

React와 Vite로 구성된 Dashboard 화면이다. ROS2, Monitor, Fast DDS observer 또는 MariaDB에 직접 연결하지 않고
FastAPI Backend의 REST API와 `/ws/monitor`만 사용한다.

주요 화면은 Overview, Topic, Service, Action, Node, Alert, Domains, Visualization, Interface Lab이다. 기본 목록은 빠른
상태 판단을, 선택 상세는 QoS·endpoint·payload·실행 결과의 원인 분석을 담당한다.

- Topic은 `effective_status`, Service는 `servicePresentation`, Action은 `actionPresentation`의 Goal·Feedback·Result
  selector를 사용해 목록·필터·상세의 표시값을 일치시킨다. Action의 Graph 대표 상태는 Backend `status`를 사용한다.
- 목록의 마지막 값·Request/Response·Feedback/Result는 compact preview이며 클릭하면 pretty JSON 전체 payload를
  표시한다.
- `QosDetails`는 동일 role/scope/QoS fingerprint endpoint를 그룹화하고 GUID/GID·participant identity는 접힌
  endpoint 상세에 모두 유지한다.
- Camera Preview는 상세에서만 요청하며 확대창은 맞춤, 원본, 25~400% 확대·축소와 중앙 정렬을 제공한다.
- Interface Lab의 Topic/Service/Action schema 기반 object/array 입력은 공통 JSON field를 사용하며 필드별
  크게 보기/줄이기와 validation 상태를 유지한다.
- Interface Lab 상단은 `통신 실행`의 Topic 발행/Service 호출/Action Goal과 `서버 개설`의 Service/Action 개설로
  구분한다. Topic 수신은 기존 우측 수신 영역을 사용하며 Topic Server UI는 없다. Server 화면의 실행 상태와
  Request/Goal/Cancel/Result 이력은 Monitor API 응답만 표시한다.
- Alert 상세는 Cloud와 Local AI 분석을 분리해 요청한다. Local 모델이 아직 없으면 모델명·실제 다운로드 진행률을
  표시하는 Modal에서 사용자의 승인을 받은 뒤 Backend background download가 끝났을 때 원래 분석을 한 번 재개한다.

```bash
npm install
npm run dev
npm run test:unit
npm run lint
npm run build
```

`VITE_API_BASE_URL`이 비어 있으면 현재 page origin을 사용한다. HTTPS 화면에서는 WebSocket URL을 자동으로
`wss://`로 선택한다. polling 기본값은 `.env.example`을 따른다.
