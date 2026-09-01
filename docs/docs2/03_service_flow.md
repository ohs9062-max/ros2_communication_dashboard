# Service 흐름

## 수집과 목록

```text
rclpy Service Graph
→ ServiceRuntime.update()
→ Service snapshot + Fast DDS server endpoint QoS
→ Monitor transport
→ Backend cache
→ Services 화면
```

| 단계 | 현재 코드 위치 | 역할 |
|---:|---|---|
| 1 | `ros2_service/runtime.py ServiceRuntime.update()` L93-L158 | Graph Service/type/filter 수집, 상태와 disconnected debounce |
| 2 | `ros2_service/discovery.py build_service_item()` L17-L57 | Server/Client count와 기본 상태 item |
| 3 | `service_snapshot.py assemble_service_snapshot()` L16-L116 | 외부 Node 관계, Call 요약, Registry/primary, QoS 병합 |
| 4 | `service_snapshot.py visible_service_snapshot()` L117-L133 | hidden 정책을 적용한 공개 목록 |
| 5 | `transport/routers/monitoring.py get_ros_services()` L64-L78 | Monitor Service API |
| 6 | `frontend/src/hooks/useServiceDashboard.js` L10-L89 | 목록·Alert·Node polling과 상세 선택 |
| 7 | `frontend/src/pages/ServicesPage.jsx` L10-L128 | 주요/전체, 검색·상태 filter와 목록·상세 |

유효한 type에서 Server가 있으면 `active`, Server 없이 Client만 있으면 `waiting_server`, 둘 다 없으면
`inactive`다. type이 유효하지 않으면 `unknown`이다. Client 없음은 요청 대기형 Service의 정상 상태다.
Graph Server 존재는 발견 사실이지 실제 Call 성공 증명이 아니다.

기본 목록은 상태, 이름, type, Server/Client Node 수, 호출 가능, 마지막 응답, 응답 시간, 마지막 호출을 표시한다.
raw request/response, endpoint QoS와 DDS 채널은 우측 상세에 둔다.

## 사용자 Service Call

```text
POST /ros/interfaces/service-call
→ transport router
→ InterfaceLabFacade
→ ServiceCallRuntime
→ rclpy Client call_async
→ response/error + history
```

- route: `transport/routers/service_execution.py` L34-L78
- runtime entry: `interface_lab/execution/service_call_runtime.py call_service()` L84-L157
- callable 후보: 같은 파일 `callable_services()` L77-L83
- history/reset: 같은 파일 L158-L204

호출은 사용자가 명시할 때만 수행한다. 자동 active check는 기본 비활성화이며
`RosMonitor._update_graph()` L446-L455에서 호출하지 않는다. 최근 Call 결과는 일반 Monitor Alert에
`service_call_timeout` 또는 `service_call_failed`로 반영될 수 있다.

## QoS와 수

Service Request/Response QoS는 rclpy Service Graph가 아니라 Fast DDS observer의 원격 server
Request DataReader와 Response DataWriter를 사용한다. observer 미사용은 `graph_unavailable`이며 장애가 아니다.
Client 생성 뒤에는 상대 DDS endpoint signature가 변경된 Graph 갱신에서만 호환 상태를 다시 계산하고,
Service snapshot은 저장된 Client QoS 상태를 병합한다.

`server_count/client_count`는 raw Graph endpoint 수고 기본 목록의 `server_node_count/client_node_count`는
Dashboard 내부 Node를 제외한 고유 Node 수다. Lab Client 생성 여부는
`ServiceCallRuntime.dashboard_state_by_service()` L209-L214에 별도로 유지한다.
