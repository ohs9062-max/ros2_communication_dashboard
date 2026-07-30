# Backend 전체 흐름

## 1. 기능을 한 문장으로 설명

Backend는 ROS2에서 현재 보이는 통신 상태를 계속 관찰해 메모리에 저장하고, Frontend가 REST와 WebSocket으로 읽을 수 있게 제공한다.

여기서 Runtime은 “특정 기능의 실제 동작을 담당하는 객체”, cache는 “화면에 빨리 전달하려고 메모리에 저장한 최신 데이터”, snapshot은 “특정 시점의 상태를 한 번에 묶은 데이터”다.

## 2. 전체 흐름

```text
Uvicorn 실행
→ FastAPI lifespan
→ RosMonitor.start()
→ rclpy 초기화와 ROS2 Node 생성
→ Runtime과 timer 준비
→ spin thread 시작
→ ROS2 Graph와 메시지 관찰
→ cache snapshot 생성
→ REST/WebSocket 응답
→ Frontend 표시
```

## 3. 단계별 쉬운 설명

### 1) FastAPI가 시작된다

- 파일: `main.py L20~L45`
- 역할: lifespan은 Backend가 켜질 때 `ros_monitor.start()`를 호출하고, 꺼질 때 `ros_monitor.stop()`을 호출한다. Router도 이 구간에서 FastAPI app에 등록된다.
- 입력: Uvicorn의 app 시작 신호
- 출력: 요청을 받을 준비가 된 FastAPI app
- 다음 흐름: `RosMonitor.start()`로 이동한다.

### 2) Runtime 객체를 준비한다

- 파일: `ros_monitor.py L37~L82`
- 역할: Topic, Service, Action, Node Monitoring Runtime과 Interface Lab 실행 Runtime을 한곳에서 만든다.
- 왜 필요한가: 기능별 책임을 나누면서도 하나의 ROS2 Node와 lock을 공유하기 위해서다.
- 다음 흐름: `RosMonitor.start()`가 ROS2를 실제로 시작한다.

### 3) ROS2 Node와 timer를 만든다

- 파일: `ros_monitor.py L84~L98`
- 역할: `rclpy.init()`을 실행하고 `ros2_dashboard_topic_monitor` Node를 만든다. 설정된 주기마다 `_update_graph()`를 호출할 timer도 등록한다.
- 입력: `MonitorConfig.poll_interval_sec`
- 출력: 실행 중인 ROS2 Node와 timer
- 다음 흐름: 첫 `_update_graph()`를 즉시 실행한 뒤 spin thread를 시작한다.

### 4) spin thread가 ROS callback을 처리한다

- 파일: `ros_monitor.py L665~L675`
- 역할: `rclpy.spin()`이 Subscription callback, timer callback, Action/Service future 완료를 처리한다.
- 왜 필요한가: FastAPI 요청 처리와 ROS2 callback 처리가 서로를 오래 막지 않게 하기 위해서다.

### 5) 각 Graph Runtime을 갱신한다

- 파일: `ros_monitor.py L677~L683`
- 역할: Node → Topic → Service → Action 순서로 `update()`를 호출한다.
- 중요: Service active check 자동 호출은 이 실행 경로에서 의도적으로 비활성화돼 있다. Service 생존은 Graph로 관찰하고 실제 요청은 Interface Lab 사용자가 실행한다.
- 출력: Runtime별 최신 cache

### 6) API가 snapshot을 반환한다

- 파일: `routers/monitoring.py L16~L89`
- 역할: `/ros/topics`, `/ros/services`, `/ros/actions`, `/ros/nodes`, `/ros/alerts` 요청을 RosMonitor snapshot 함수로 연결한다.
- 입력: Frontend HTTP 요청
- 출력: JSON 목록, 상태, meta
- 다음 흐름: Frontend hook이 응답을 state로 저장한다.

### 7) WebSocket이 가벼운 통합 상태를 보낸다

- 파일: `ros_monitor.py L456~L486`
- 파일: `routers/monitoring.py L92~L109`
- 역할: 1초마다 리소스 수와 Alert, Topic latest 요약을 보낸다. 상세 목록과 관계 데이터는 REST가 담당한다.

## 4. 실제 코드 위치

| 기능 | 현재 코드 위치 |
|---|---|
| app/lifespan/router 등록 | `main.py L20~L48` |
| 설정과 singleton | `app_state.py L1~L10` |
| Runtime 조립 | `ros_monitor.py L37~L82` |
| 시작 | `ros_monitor.py L84~L98` |
| 종료 | `ros_monitor.py L100~L124` |
| Graph 갱신 | `ros_monitor.py L677~L683` |
| 공통 발견 상태 | `resource_state.py L11~L44` |
| Monitoring REST/WS | `routers/monitoring.py L16~L109` |

## 5. 입력 데이터

- ROS2 Graph API가 알려주는 Node, Topic, Service, Action
- ROS2 Subscription으로 들어오는 메시지
- `monitor.yaml`과 등록 Interface YAML
- Interface Lab에서 사용자가 보낸 실행 요청

## 6. 처리 과정

Runtime은 Graph의 현재 값과 이전 cache를 비교한다. 현재 보이면 `last_seen_at`을 갱신하고, 이전에 보였지만 지금 사라졌으면 `disconnected`로 만든다. ROS callback과 HTTP 요청이 동시에 cache를 읽고 쓸 수 있으므로 공유 데이터는 lock으로 보호한다.

Backend 기능은 `ros2 topic list` 같은 CLI subprocess 출력에 의존하지 않는다. 실제 데이터는 `rclpy` Graph API에서 가져온다.

## 7. 출력 데이터

- REST: 화면별 상세 목록과 상태
- WebSocket: 연결 상태와 가벼운 통합 snapshot
- Alert: active/resolved 목록과 meta
- Interface Lab history: 사용자가 실행한 Publish/Call/Goal 결과

## 8. 종료와 다음 단계 연결

```text
FastAPI lifespan shutdown
→ RosMonitor.stop()
→ rclpy.shutdown()
→ spin thread join
→ Node destroy
→ Runtime/cache clear
```

- 파일: `main.py L20~L27`
- 파일: `ros_monitor.py L100~L124`

`--reload`가 발생하면 이 시작과 종료가 모두 다시 실행된다. Topic 상세 흐름은 [03_topic_flow.md](03_topic_flow.md), Service는 [04_service_flow.md](04_service_flow.md), Action은 [05_action_flow.md](05_action_flow.md)로 이어진다.

## 9. 핵심 요약

1. FastAPI는 요청을 받고, RosMonitor는 ROS2 Runtime을 시작하고 묶는다.
2. 각 Runtime이 미리 cache를 갱신하므로 API 요청마다 ROS2를 새로 시작하지 않는다.
3. 종료 시 ROS2 Node, thread, Runtime cache가 함께 정리된다.
