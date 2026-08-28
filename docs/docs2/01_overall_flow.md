# 전체 흐름

## 한 문장으로 보기

독립 ROS2 Monitor가 Graph와 사용자 통신을 수집해 localhost snapshot을 만들고, 순수 FastAPI Backend가 이를
polling·cache한 뒤 REST/WSS로 React Frontend에 전달한다.

```text
ROS2 Graph / data
→ Fast DDS observer(optional) + rclpy Monitor
→ Monitor GET /transport/snapshot (127.0.0.1:8765)
→ Backend MonitorEventConsumer / MonitorCache (127.0.0.1:8000)
→ REST + /ws/monitor
→ React
```

## Monitor 시작과 snapshot

| 단계 | 현재 코드 위치 | 역할 |
|---:|---|---|
| 1 | `transport/api.py lifespan()` L22-L30 | Monitor FastAPI 시작·종료에 `RosMonitor.start/stop` 연결 |
| 2 | `ros_monitor.py RosMonitor.start()` L145-L161 | rclpy Node, observer, 최초 Graph update, spin thread 시작 |
| 3 | `ros_monitor.py RosMonitor._update_graph()` L433-L443 | Node → Topic → Service → Action Runtime 갱신 후 Service/Action Client QoS cache refresh |
| 4 | `ros_monitor.py RosMonitor.snapshot()` L187-L203 | Topic runtime 결과에 topology·primary·Lab 상태 병합 |
| 5 | `service_snapshot.py assemble_service_snapshot()` L16-L114 | Service topology·Call·QoS 병합 |
| 6 | `action_snapshot.py assemble_action_snapshot()` L15-L136 | Action topology·Goal·채널 QoS 병합 |
| 7 | `node_snapshot.py assemble_node_snapshot()` L13-L65 | Node 목록과 리소스 snapshot 연결 |
| 8 | `transport/api.py transport_snapshot()` L66-L102 | 한 시점의 Topic/Service/Action/Node/Alert/WebSocket payload 조립 |

`timer`는 Graph cache를 갱신하고 Domain별 4-thread rclpy executor는 Topic, Action status/feedback과 Interface Lab
Service/Action Server 등 실제 callback을 처리한다. Action Server는 Result 대기 중 Cancel을 처리할 수 있도록
reentrant callback group을 사용하지만 기존 Domain Context와 Monitor Node를 그대로 공유한다.
Service/Action Client QoS는 이 Graph 갱신에서 상대 endpoint signature가 바뀔 때만 다시 계산하며 snapshot은 저장된
상태를 읽는다. Service 자동 호출은 `RosMonitor._update_graph()` L441-L443에서 의도적으로 수행하지 않는다.

## Backend 경계

Backend는 `rclpy`를 import하거나 ROS2 Node를 만들지 않는다.

| 단계 | 현재 코드 위치 | 역할 |
|---:|---|---|
| 1 | `backend/app/main.py lifespan()` L14-L22 | Alert DB service와 Monitor consumer 시작·종료 |
| 2 | `backend/app/app_state.py` L16-L41 | MonitorClient, cache, MariaDB repository, preference store 조립 |
| 3 | `backend/app/monitor_client/event_consumer.py` | Monitor snapshot polling, 마지막 정상 cache와 연결 오류 유지 |
| 4 | `backend/app/routers/monitoring.py` L23-L55 | cache의 Topic/Service/Action/Node 공개 |
| 5 | `backend/app/routers/alerts.py` L13-L47 | 현재 Alert, DB 이력, 확인·이력 초기화 |
| 6 | `backend/app/routers/monitor_proxy.py` L35-L54 | Interface Lab과 Camera 요청을 method/body/content-type 보존해 Monitor로 전달 |

Backend가 Monitor보다 먼저 시작해도 종료되지 않는다. Monitor가 끊기면 cache의 마지막 정상 snapshot과
`monitor_error`를 함께 유지하고 재연결 시 사용자 별표를 `PUT /transport/priority`로 다시 보낸다.

## Frontend 흐름

| 기능 | API | Hook | Page |
|---|---|---|---|
| Topic | `frontend/src/api/monitoring.js` | `useTopicDashboard.js` L23-L257 | `TopicsPage.jsx` L17-L196 |
| Service | `frontend/src/api/monitoring.js` | `useServiceDashboard.js` L10-L87 | `ServicesPage.jsx` L10-L135 |
| Action | `frontend/src/api/monitoring.js` | `useActionDashboard.js` L10-L83 | `ActionsPage.jsx` L23-L182 |
| Node | `frontend/src/api/monitoring.js` | `useNodeDashboard.js` L9-L69 | `NodesPage.jsx` L17-L179 |
| Alert | `frontend/src/api/monitoring.js` | 각 Dashboard Hook | `AlertsPage.jsx` L11-L277 |

`frontend/src/api/rosApi.js` L1-L7은 기능별 API 모듈을 다시 export하는 compatibility entry다.
Frontend는 Monitor 8765나 observer 8766에 직접 연결하지 않는다.

## 값의 구분

```text
Graph/Topology = 현재 Node와 endpoint의 역할
Observation    = latest, Hz, status, feedback 등 실제 수신
Activity       = 사용자가 Interface Lab에서 수행한 Publish/Call/Goal 이력
Server Activity= 사용자가 개설한 Service/Action의 Request/Goal/Cancel/Result 이력
```

기본 목록의 `*_node_count`는 내부 `/ros2_dashboard_topic_monitor`를 제외한 고유 Node 수다.
`publisher_count`, `subscriber_count`, `server_count`, `client_count`와 endpoint 상세는 Dashboard를 포함한
raw Graph 진단값을 유지한다. Interface Lab에서 사용자가 명시적으로 만든 entity는 실행 사실로 별도 표시한다.


Topology
어떤 Node가 이 Topic을 Publish하고
어떤 Node가 Subscribe하는지
즉 “누가 누구와 이 Topic으로 연결돼 있나”를 나타내는 관계 정보야.
Primary
여러 정보 중에서 화면에 대표로 보여줄 주 상태/대표 상태
예를 들면 정상, 발행자 없음, stale, disconnected 같은 것 중
현재 Topic을 대표하는 상태를 고르는 개념으로 보면 돼.
Lab 상태
Interface Lab에서 이 Topic을 실제로 Publish/Receive 실행했는지
어떤 QoS를 적용했는지
실행 중인지, 최근 실행 결과가 어떤지
이런 Dashboard 실행 상태를 말해.

그래서 예를 들어 /cmd_vel 하나를 최종 화면에 보여줄
