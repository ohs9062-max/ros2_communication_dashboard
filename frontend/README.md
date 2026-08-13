# ROS2 Dashboard Frontend

React와 Vite로 구성된 Dashboard 화면이다. ROS2, Monitor, Fast DDS observer 또는 MariaDB에 직접 연결하지 않고
FastAPI Backend의 REST API와 `/ws/monitor`만 사용한다.

주요 화면은 Overview, Topic, Service, Action, Node, Alert, Visualization, Interface Lab이다. 기본 목록은 빠른
상태 판단을, 선택 상세는 QoS·endpoint·payload·실행 결과의 원인 분석을 담당한다.

```bash
npm install
npm run dev
npm run test:unit
npm run lint
npm run build
```

`VITE_API_BASE_URL`이 비어 있으면 현재 page origin을 사용한다. HTTPS 화면에서는 WebSocket URL을 자동으로
`wss://`로 선택한다. polling 기본값은 `.env.example`을 따른다.
