# 전체 흐름

## 한 문장으로 보기

React 화면이 FastAPI Router에 요청하면 `RosMonitor`가 ROS2 Runtime의 Cache를 읽고 필요한 공통 관계를 합쳐 JSON으로 반환하며, 실제 Graph 수집은 별도 timer가 반복 실행한다.

```text
ROS2 장비
→ rclpy Graph API와 subscription callback
→ Topic/Service/Action/Node Runtime Cache
→ RosMonitor 병합
→ FastAPI Router
→ REST API
→ React Hook
→ Page/Table
```

## 전체 왕복 9단계

| 단계 | 파일·함수 | 함수 전체 L | 핵심 L | 먼저 볼 내용 |
|---:|---|---:|---:|---|
| 1 | `main.py` `lifespan()` | `main.py` L21-L27 | `main.py` L22-L27 | FastAPI 시작과 종료를 `RosMonitor.start()`·`stop()`에 연결한다. |
| 2 | `ros_monitor.py` `start()` | `ros_monitor.py` L84-L98 | `ros_monitor.py` L89-L98 | rclpy Node, Graph timer, 최초 update, spin thread를 시작한다. |
| 3 | `ros_monitor.py` `_update_graph()` | `ros_monitor.py` L733-L739 | `ros_monitor.py` L734-L737 | timer가 만료될 때 Node → Topic → Service → Action Runtime 순서로 Graph Cache를 갱신한다. |
| 4 | 각 Runtime `update()` | 기능별 문서 참고 | 각 `update()` 핵심 L | ROS2 Graph API 결과를 필터링하고 각 기능의 Runtime Cache로 저장한다. |
| 5 | rclpy subscription callback | 기능별 문서 참고 | Topic·Action callback 핵심 L | 실제 메시지·status·feedback이 도착하면 timer와 별개로 관찰 Cache를 갱신한다. |
| 6 | `ros_monitor.py` 각 `*_snapshot()` | `ros_monitor.py` L126-L498의 기능별 함수 | `ros_monitor.py`의 각 snapshot 핵심 L | Runtime Cache에 Dashboard 내부 Node를 차감한 관계 수, Registry 판정, 사용자 실행 요약을 병합한다. |
| 7 | `routers/monitoring.py` | `routers/monitoring.py` L16-L89 | `routers/monitoring.py`의 각 endpoint 반환 L | FastAPI가 snapshot을 기존 REST 응답 구조로 포장한다. |
| 8 | `rosApi.js` → `use*Dashboard.js` | `rosApi.js` L45-L72 | 각 `use*Dashboard.js`의 `usePolling()` L | Frontend가 REST API를 주기적으로 요청해 응답을 React state로 저장한다. |
| 9 | 각 `*Page.jsx` | 기능별 Page 전체 L | 주요/전체·상태 필터 L | state에 검색·필터를 적용하고 Table과 상세 Panel을 렌더링한다. |

이 표는 프로그램 시작부터 화면까지의 지도다. 실제 계산은 각 기능 문서의 7~9단계 표에서 이어서 본다.

## 프로그램 시작

| 순서 | 파일·함수 | 함수 전체 L | 핵심 L | 핵심 줄에서 하는 일 |
|---:|---|---:|---:|---|
| 1 | `main.py` `lifespan()` | `main.py` L21-L27 | `main.py` L22-L27 | FastAPI 시작 때 `ros_monitor.start()`, 종료 때 `stop()` |
| 2 | `ros_monitor.py` `start()` | `ros_monitor.py` L84-L98 | `ros_monitor.py` L89-L98 | rclpy Node, timer, 최초 Graph update, spin thread 생성 |
| 3 | `ros_monitor.py` `_update_graph()` | `ros_monitor.py` L733-L739 | `ros_monitor.py` L734-L737 | Node → Topic → Service → Action 순으로 Runtime 갱신 |
| 4 | `ros_monitor.py` `_spin()` | `ros_monitor.py` L721-L731 | `ros_monitor.py` L725-L727 | 실제 subscription callback이 실행되도록 ROS2 spin |

`timer`는 정해진 간격으로 Graph 목록을 다시 읽는 시계이고, `spin`은 실제 메시지·feedback 같은 통신 callback을 처리하는 반복 실행기다.

## 목록 API 공통 흐름

| 화면 | Router 전체 L | Router 핵심 L | RosMonitor 전체 L | RosMonitor 핵심 L |
|---|---:|---:|---:|---:|
| Topic | `monitoring.py` L16-L28 | `monitoring.py` L19-L27 | `ros_monitor.py` `snapshot()` L126-L189 | `ros_monitor.py` L128-L188 |
| Service | `monitoring.py` L43-L57 | `monitoring.py` L48-L56 | `ros_monitor.py` `service_snapshot()` L191-L267 | `ros_monitor.py` L197-L266 |
| Action | `monitoring.py` L60-L70 | `monitoring.py` L63-L69 | `ros_monitor.py` `action_snapshot()` L309-L370 | `ros_monitor.py` L311-L369 |
| Node | `monitoring.py` L73-L83 | `monitoring.py` L76-L82 | `ros_monitor.py` `node_snapshot()` L492-L498 | `ros_monitor.py` L494-L498 |
| Alert | `monitoring.py` L86-L89 | `monitoring.py` L89 | `ros_monitor.py` `alerts()` L552-L621 | `ros_monitor.py` L555-L619 |

`RosMonitor`의 병합은 원본 Graph를 새로 발견하는 단계가 아니다. 각 Runtime Cache를 읽어 Node 수, 실행 요약, 등록 여부 같은 API용 필드를 더하는 단계다.

## 화면까지 오는 흐름

```text
Router JSON
→ frontend/src/api/rosApi.js의 fetch 함수
→ use*Dashboard.js의 usePolling()
→ Page의 주요/전체 필터
→ Table과 상세 Panel
```

| 기능 | API 함수 전체/핵심 L | Hook 전체 L | Page에서 먼저 볼 핵심 L |
|---|---|---:|---:|
| Topic | `rosApi.js` `fetchTopics()` L45-L47 | `useTopicDashboard.js` `useTopicDashboard()` L17-L163 | `TopicsPage.jsx` L33-L83 |
| Service | `rosApi.js` `fetchServices()` L61-L64 | `useServiceDashboard.js` `useServiceDashboard()` L7-L78 | `ServicesPage.jsx` L68-L110 |
| Action | `rosApi.js` `fetchActions()` L66-L68 | `useActionDashboard.js` `useActionDashboard()` L7-L74 | `ActionsPage.jsx` L35-L74 |
| Node | `rosApi.js` `fetchNodes()` L70-L72 | `useNodeDashboard.js` `useNodeDashboard()` L6-L66 | `NodesPage.jsx` L35-L60 |

## 코드를 읽을 때 지켜야 할 구분

```text
Graph/Topology
= 현재 어떤 Node가 어떤 통신 역할을 가지고 있는가

Observation
= 메시지, status, feedback이 실제로 들어왔는가

Activity
= 사용자가 Service Call이나 Action Goal을 몇 번 실행했는가
```

세 값은 목적이 다르다. 화면 숫자를 볼 때 먼저 어느 종류인지 확인해야 한다.
