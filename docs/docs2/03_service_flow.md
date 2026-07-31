# Service 흐름

## 한 문장으로 보기

Service 목록은 Graph의 Server/Client 관계를 보여주고, 실제 request/response는 Interface Lab에서 사용자가 실행할 때만 별도 `ServiceCallRuntime`이 전송하고 이력으로 저장한다.

## 쉬운 용어

| 용어 | 뜻 |
|---|---|
| Service Server | 요청을 받고 응답을 만드는 Node 역할 |
| Service Client | Server에 요청하고 응답을 기다리는 Node 역할 |
| callable | Registry 타입과 Graph 타입이 같고 현재 Server가 있어 호출 가능한 상태 |
| active check | Backend가 자동으로 요청해 확인하는 기능; 현재 timer 경로에서는 실행하지 않음 |
| Call Activity | 사용자가 실제 요청을 보낸 실행 이력 |

## 목록과 Topology

```text
get_service_names_and_types()
→ Server/Client endpoint 수
→ Service Cache
→ Node 관계를 반대로 집계
→ Server/Client Node 수 병합
→ GET /ros/services
```

| 단계 | 파일·함수 | 함수 전체 L | 핵심 L | 먼저 볼 내용 |
|---:|---|---:|---:|---|
| 1 | `service/runtime.py` `update()` | `service/runtime.py` L90-L152 | `service/runtime.py` L96-L112 | Graph에서 Service 이름·타입을 읽고 include/exclude 설정을 적용한다. |
| 2 | `service/runtime.py` `update()` | `service/runtime.py` L90-L152 | `service/runtime.py` L114-L131 | Server·Client endpoint 수와 category를 계산해 Service 상태 item을 만든다. |
| 3 | `service/runtime.py` `update()` | `service/runtime.py` L90-L152 | `service/runtime.py` L133-L152 | 현재 사라진 기존 Service를 `disconnected`로 보존하고 Runtime Cache를 교체한다. |
| 4 | `ros_monitor.py` `service_snapshot()` | `ros_monitor.py` L191-L267 | `ros_monitor.py` L197-L239 | Node 관계를 역집계하고 Dashboard 내부 Node를 제외한 Server/Client Node 수를 추가하며 endpoint 수는 원본 진단값으로 유지한다. |
| 5 | `ros_monitor.py` `service_snapshot()` | `ros_monitor.py` L191-L267 | `ros_monitor.py` L240-L266 | Registry 타입 일치·호출 가능 여부와 최근 사용자 Call 결과를 병합한다. |
| 6 | `monitoring.py` `get_ros_services()` | `monitoring.py` L43-L57 | `monitoring.py` L48-L56 | `include_hidden` 조건에 맞는 Service snapshot을 `/ros/services` 응답으로 반환한다. |
| 7 | `rosApi.js` → `useServiceDashboard.js` | `rosApi.js` L61-L64, `useServiceDashboard.js` L7-L78 | `useServiceDashboard.js` L11-L20, `useServiceDashboard.js` L30-L34 | 내부 포함 여부를 query에 넣어 polling하고 응답의 `services` 배열을 React state로 꺼낸다. |
| 8 | `ServicesPage.jsx` `ServicesPage()` | `ServicesPage.jsx` L50-L213 | `ServicesPage.jsx` L68-L110 | 주요·전체·내부/관리 집합을 선택하고 검색·대기/오류 필터를 적용해 최종 목록을 표시한다. |

전체 목록 흐름은 1~8로 보고, 실제 요청·응답은 아래 사용자 Service Call 표에서 별도로 본다.

`Server Node 수`는 해당 Service를 제공하는 고유 Node 수이고, `server_endpoint_count`는 Graph endpoint 진단값이다.

## 사용자 Service Call

```text
실행 버튼
→ POST /ros/interfaces/service-call
→ Router 입력 검사
→ RosMonitor 위임
→ 타입/Graph 검증
→ call_async()
→ 응답 또는 timeout
→ history 저장
```

| 단계 | 파일·함수 | 함수 전체 L | 실제 핵심 L | 의미 |
|---:|---|---:|---:|---|
| 1 | `routers/service_execution.py` `call_registered_service()` | `routers/service_execution.py` L27-L64 | `routers/service_execution.py` L29-L45 | JSON과 name/type/request 입력 검사 |
| 2 | `routers/service_execution.py` `call_registered_service()` | `routers/service_execution.py` L27-L64 | `routers/service_execution.py` L47-L55 | `ros_monitor.call_service()`에 전달 |
| 3 | `ros_monitor.py` `call_service()` | `ros_monitor.py` L273-L287 | `ros_monitor.py` L282-L287 | `ServiceCallRuntime`으로 그대로 위임 |
| 4 | `service_call_runtime.py` `call_service()` | `service_call_runtime.py` L85-L187 | `service_call_runtime.py` L94-L104 | timeout, 등록 타입, Graph Server, monitor Node 검사 |
| 5 | `service_call_runtime.py` `call_service()` | `service_call_runtime.py` L85-L187 | `service_call_runtime.py` L109-L126 | Service class와 ROS request 생성, Client 준비 |
| 6 | `service_call_runtime.py` `call_service()` | `service_call_runtime.py` L85-L187 | `service_call_runtime.py` L128-L136 | `call_async()`, timeout 대기, 응답 및 elapsed 계산 |
| 7 | `service_call_runtime.py` `call_service()` | `service_call_runtime.py` L85-L187 | `service_call_runtime.py` L141-L159 | 성공 응답 item 조립 |
| 8 | `service_call_runtime.py` `call_service()` | `service_call_runtime.py` L85-L187 | `service_call_runtime.py` L160-L184 | timeout/오류 item 조립 |
| 9 | `service_call_runtime.py` `call_service()` | `service_call_runtime.py` L85-L187 | `service_call_runtime.py` L186-L187 | 최종 history 저장과 반환 |

## active check와 사용자 Call

- `ServiceActiveCheckRuntime` 클래스는 남아 있지만 `ros_monitor.py`의 `RosMonitor._update_graph()` L733-L739에서 호출하지 않는다.
- 따라서 Graph에 보이는 Service를 Backend가 자동 호출하지 않는다.
- 실제 요청은 위의 Interface Lab 사용자 Call 경로에서만 발생한다.

## 주요/전체/내부 필터

- 주요: 내부·관리 Service가 아니면서 등록 타입, 대기/오류, 또는 숨김 아닌 사용자 Service.
- 전체: 내부·Parameter·Action 내부·관리 Service를 제외한 목록.
- 내부/관리 포함: `include_hidden=true`로 다시 요청한 모든 Service.

핵심 판정은 `ServicesPage.jsx`의 `isPrimaryService()` L241-L250, 목록 선택은 `ServicesPage.jsx` L81-L110, 내부·관리 판정은 `ServicesPage.jsx` L298-L319다.
