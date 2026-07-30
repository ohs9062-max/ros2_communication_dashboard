# Backend 코드 읽기 안내

## 1. 기능을 한 문장으로 설명

이 문서는 Backend 시작부터 종료까지 실제 코드를 짧은 순서로 따라가기 위한 지도다.

## 2. 전체 흐름

```text
main.py lifespan
→ app_state.py singleton
→ RosMonitor.__init__()
→ RosMonitor.start()
→ RosMonitor._update_graph()
→ 각 Runtime.update()
→ monitoring router
→ RosMonitor.stop()
```

## 3. 단계별 코드 위치

1. FastAPI lifespan: `main.py L20~L30`
   - 시작할 때 `ros_monitor.start()`, 종료할 때 `stop()`을 호출한다.
2. 설정과 singleton: `app_state.py L1~L10`
   - 설정을 한 번 읽고 공유 RosMonitor를 만든다.
3. Runtime 조립: `ros_monitor.py L37~L82`
   - Topic, Service, Action, Node와 Interface Lab Runtime을 만든다.
4. ROS2 시작: `ros_monitor.py L84~L98`
   - `rclpy.init()`, Node, timer, 첫 갱신, spin thread 순서다.
5. ROS callback loop: `ros_monitor.py L669~L679`
   - `rclpy.spin()`이 callback을 실행한다.
6. Graph 갱신: `ros_monitor.py L681~L687`
   - 네 Monitoring Runtime의 `update()`를 호출한다.
7. REST 연결: `routers/monitoring.py L16~L89`
   - snapshot을 JSON으로 반환한다.
8. WebSocket 연결: `routers/monitoring.py L92~L109`
   - 1초마다 `websocket_snapshot()`을 전송한다.
9. 종료: `ros_monitor.py L100~L124`
   - shutdown, join, destroy, cache clear 순서다.

## 4. 입력·처리·출력

- 입력: Uvicorn 생명주기, ROS2 Graph와 callback
- 처리: Runtime update와 cache 저장
- 출력: REST/WebSocket snapshot
- 다음 단계: 기능별 문서 `03`~`08`에서 각 Runtime 내부를 따라간다.

## 5. 핵심 요약

코드를 처음 읽을 때는 `main.py L20~L30`에서 시작해 `ros_monitor.py L84~L124`, `L669~L687`, 마지막으로 `routers/monitoring.py L16~L109` 순서로 읽으면 된다.
