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
| 1 | `service/runtime.py` `update()` | L90-L152 | L96-L131 | Graph 목록, include/exclude, endpoint count, 상태 생성 |
| 2 | 같은 함수 | L90-L152 | L133-L148 | 사라진 Service를 disconnected로 보존 |
| 3 | `ros_monitor.py` `service_snapshot()` | L173-L232 | L179-L211 | Node 관계 수·endpoint 진단값·등록/호출 가능 여부 병합 |
| 4 | 같은 함수 | L173-L232 | L212-L231 | 최근 사용자 Call 요약과 effective status 병합 |
| 5 | `monitoring.py` `get_ros_services()` | L43-L57 | L48-L56 | `include_hidden`을 적용해 API 반환 |

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
| 1 | `routers/service_execution.py` `call_registered_service()` | L27-L64 | L29-L45 | JSON과 name/type/request 입력 검사 |
| 2 | 같은 함수 | L27-L64 | L47-L55 | `ros_monitor.call_service()`에 전달 |
| 3 | `ros_monitor.py` `call_service()` | L238-L252 | L240-L252 | `ServiceCallRuntime`으로 그대로 위임 |
| 4 | `service_call_runtime.py` `call_service()` | L85-L187 | L94-L104 | timeout, 등록 타입, Graph Server, monitor Node 검사 |
| 5 | 같은 함수 | L85-L187 | L109-L126 | Service class와 ROS request 생성, Client 준비 |
| 6 | 같은 함수 | L85-L187 | L128-L136 | `call_async()`, timeout 대기, 응답 및 elapsed 계산 |
| 7 | 같은 함수 | L85-L187 | L141-L159 | 성공 응답 item 조립 |
| 8 | 같은 함수 | L85-L187 | L160-L184 | timeout/오류 item 조립 |
| 9 | 같은 함수 | L85-L187 | L186-L187 | 최종 history 저장과 반환 |

## active check와 사용자 Call

- `ServiceActiveCheckRuntime` 클래스는 남아 있지만 `RosMonitor._update_graph()` L681-L685에서 호출하지 않는다.
- 따라서 Graph에 보이는 Service를 Backend가 자동 호출하지 않는다.
- 실제 요청은 위의 Interface Lab 사용자 Call 경로에서만 발생한다.

## 주요/전체/내부 필터

- 주요: 내부·관리 Service가 아니면서 등록 타입, 대기/오류, 또는 숨김 아닌 사용자 Service.
- 전체: 내부·Parameter·Action 내부·관리 Service를 제외한 목록.
- 내부/관리 포함: `include_hidden=true`로 다시 요청한 모든 Service.

핵심 판정은 `ServicesPage.jsx`의 `isPrimaryService()` L241-L250, 목록 선택은 L81-L110, 내부·관리 판정은 L298-L319다.

