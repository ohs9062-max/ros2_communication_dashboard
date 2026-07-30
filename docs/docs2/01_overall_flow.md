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

## 프로그램 시작

| 순서 | 파일·함수 | 함수 전체 L | 핵심 L | 핵심 줄에서 하는 일 |
|---:|---|---:|---:|---|
| 1 | `main.py` `lifespan()` | L21-L27 | L22-L27 | FastAPI 시작 때 `ros_monitor.start()`, 종료 때 `stop()` |
| 2 | `ros_monitor.py` `start()` | L84-L98 | L89-L98 | rclpy Node, timer, 최초 Graph update, spin thread 생성 |
| 3 | `ros_monitor.py` `_update_graph()` | L681-L685 | L682-L685 | Node → Topic → Service → Action 순으로 Runtime 갱신 |
| 4 | `ros_monitor.py` `_spin()` | L669-L679 | L673-L675 | 실제 subscription callback이 실행되도록 ROS2 spin |

`timer`는 정해진 간격으로 Graph 목록을 다시 읽는 시계이고, `spin`은 실제 메시지·feedback 같은 통신 callback을 처리하는 반복 실행기다.

## 목록 API 공통 흐름

| 화면 | Router 전체 L | Router 핵심 L | RosMonitor 전체 L | RosMonitor 핵심 L |
|---|---:|---:|---:|---:|
| Topic | `monitoring.py` L16-L28 | L19-L27 | `snapshot()` L126-L171 | L128-L170 |
| Service | `monitoring.py` L43-L57 | L48-L56 | `service_snapshot()` L173-L232 | L179-L231 |
| Action | `monitoring.py` L60-L70 | L63-L69 | `action_snapshot()` L274-L318 | L276-L317 |
| Node | `monitoring.py` L73-L83 | L76-L82 | `node_snapshot()` L440-L446 | L442-L446 |
| Alert | `monitoring.py` L86-L89 | L89 | `alerts()` L500-L568 | L503-L566 |

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
| Topic | `rosApi.js` `fetchTopics()` L45-L47 | `useTopicDashboard()` L17-L163 | `TopicsPage.jsx` L33-L83 |
| Service | `fetchServices()` L61-L64 | `useServiceDashboard()` L7-L78 | `ServicesPage.jsx` L68-L110 |
| Action | `fetchActions()` L66-L68 | `useActionDashboard()` L7-L74 | `ActionsPage.jsx` L35-L74 |
| Node | `fetchNodes()` L70-L72 | `useNodeDashboard()` L6-L66 | `NodesPage.jsx` L35-L60 |

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
