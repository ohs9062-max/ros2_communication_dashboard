# WebSocket 흐름

## 1. 기능을 한 문장으로 설명

WebSocket은 Backend와 브라우저의 연결 상태, 리소스 요약, Alert를 1초마다 전달하는 보조 통신 경로다.

WebSocket은 한 번 연결한 뒤 양방향 연결을 유지하는 통신이다. 이 프로젝트에서는 Backend가 snapshot을 반복 전송한다.

## 2. 전체 흐름

```text
Frontend가 /ws/monitor 연결
→ Backend가 연결 등록
→ RosMonitor.websocket_snapshot()
→ 리소스 meta와 Alert 조립
→ 1초마다 JSON 전송
→ useMonitorWebSocket이 snapshot 저장
→ Header 연결 상태와 일부 화면 갱신
```

## 3. 단계별 쉬운 설명

### 1) Frontend가 WebSocket 주소를 만든다

- 파일: `api/rosApi.js L1~L22`
- 역할: REST base URL을 WebSocket URL로 바꾼다.
- 다음 흐름: `useMonitorWebSocket()`이 연결한다.

### 2) 연결과 재연결을 관리한다

- 파일: `hooks/useMonitorWebSocket.js L4~L74`
- 상태: `connecting`, `connected`, `error`, `disconnected`
- 연결이 닫히면 2.5초 뒤 다시 연결한다.
- cleanup 때 기존 socket과 timer를 정리해 이전 연결의 `onclose`가 새 상태를 덮지 않게 한다.

### 3) Backend가 연결을 받는다

- 파일: `routers/monitoring.py L92~L109`
- 역할: socket을 등록하고 1초마다 `ros_monitor.websocket_snapshot()`을 보낸다.

### 4) snapshot을 만든다

- 파일: `ros_monitor.py L355~L385`
- 파일: `ros_monitor.py L464~L560`
- 포함 데이터:
  - Topic 수와 상태 요약, 수신한 Topic의 latest preview/시각
  - Service 수와 callable/최근 Call 수
  - Action 수와 관찰 Goal 요약
  - Node 수와 상태 요약
  - 현재/최근 Alert 배열

Service와 Action의 전체 item, Node 관계 배열은 WebSocket에 넣지 않는다.

### 5) Frontend가 snapshot을 저장한다

- 파일: `hooks/useMonitorWebSocket.js L6~L74`
- 출력: `snapshot`, `lastUpdatedAt`, 연결 상태
- 다음 흐름: `App.jsx L20~L85`가 Header, Visualization, Interface Lab에 필요한 WebSocket 상태를 전달한다.

## 4. REST와 역할 차이

| 방식 | 실제 역할 | 코드 위치 |
|---|---|---|
| REST | 목록, 상세, 관계, selected latest/Hz | `routers/monitoring.py L16~L89` |
| WebSocket | 연결 상태와 가벼운 통합 snapshot | `routers/monitoring.py L92~L109` |

Action 목록과 상세 실패 상태는 `/ros/actions` polling으로 가져온다. WebSocket의 `actions`는 집계다. Alert 배열은 WebSocket에도 포함된다.

## 5. 입력 데이터

- 각 Runtime snapshot
- `RosMonitor.alerts()` 결과
- WebSocket 연결 상태

## 6. 처리 과정

Backend는 매 전송 시 기존 Runtime cache를 읽는다. WebSocket 때문에 ROS2 Graph를 별도로 다시 조회하지 않는다.

## 7. 출력 데이터

```text
type: monitor_snapshot
timestamp
data.topics
data.services
data.actions
data.nodes
data.alerts
```

## 8. reload와 다음 단계 연결

```text
기존 Uvicorn worker 종료
→ WebSocket close
→ Frontend disconnected
→ 새 worker와 ROS Runtime 시작
→ 2.5초 재연결
→ connected
```

Backend startup/shutdown 위치는 `main.py L20~L27`, `ros_monitor.py L80~L120`이다. 전체 Frontend 흐름은 [09_frontend_flow.md](09_frontend_flow.md)로 이어진다.

## 9. 핵심 요약

1. 상세 화면 데이터의 기준은 REST이고 WebSocket은 보조 요약이다.
2. WebSocket은 1초마다 전송하고 Frontend는 끊기면 2.5초 뒤 재연결한다.
3. REST가 정상인데 WebSocket만 끊겼는지 반드시 분리해 확인한다.
