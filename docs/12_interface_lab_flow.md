# Interface Lab 흐름

## 1. 기능을 한 문장으로 설명

Interface Lab은 ROS Interface를 등록·Build·import 확인한 뒤 사용자가 직접 Topic Publish/Receive, Service Call, Action Goal을 실행하는 작업 화면이다.

Monitoring은 자동 관찰이고 Interface Lab은 사용자 명시 실행이다. 같은 등록 타입을 참고하지만 Subscription, Client, history는 서로 다른 Runtime이 관리한다.

## 2. 전체 흐름

```text
Interface 등록 또는 업로드
→ registry/YAML과 source 저장
→ build_required 기록
→ 사용자가 Apply
→ colcon build --symlink-install
→ import check
→ import_available 갱신
→ Graph 타입 exact match
→ Publish/Receive/Call/Goal 후보
→ 사용자 실행
→ 결과와 history 표시
```

## 3. 단계별 쉬운 설명

### 1) Interface를 등록한다

| 방식 | 의미 | 실제 코드 위치 |
|---|---|---|
| manual type | 이미 설치된 full type만 등록 | `manual_interfaces.py L55~L91` |
| manual definition | 화면에서 정의를 작성해 파일 생성 | `manual_interfaces.py L92~L191` |
| single upload | `.msg/.srv/.action` 한 파일 업로드 | `registry.py L82~L210` |
| package upload | 완성된 ROS package 업로드 | `packages.py L63~L222` |

관리 API는 `routers/interface_management.py L41~L378`에 있다.

### 2) 두 저장소를 구분한다

#### `ros2_ws/src/uploaded_interfaces/generated_interfaces`

직접 작성과 단일 업로드 파일을 하나의 ROS package에 모은다.

- 파일 스캔: `manual_interfaces.py L404~L415`
- CMake/package.xml 전체 재생성: `manual_interfaces.py L416~L488`
- 파일이 0개면 `rosidl_generate_interfaces()`를 남기지 않고 build 가능한 빈 package로 만든다.

#### `ros2_ws/src/uploaded_interfaces/packages`

완성된 package를 package 이름 그대로 저장한다.

- package identity 검증: `packages.py L491~L556`
- Backend는 업로드 package의 `package.xml`과 `CMakeLists.txt`를 새 내용으로 재생성하지 않는다.

### 3) 변경이 있으면 Apply 대기로 표시한다

- 파일: `apply/runtime.py L75~L99`
- 역할: `build_required`, `rebuild_required`, pending message를 상태 YAML에 저장한다.

### 4) 사용자가 Apply를 실행한다

- 파일: `routers/interface_apply.py L26~L85`
- 파일: `apply/runtime.py L100~L341`
- 역할: backend workspace에서 `colcon build --symlink-install`을 실행하고 log와 status를 저장한다.
- 동시 Apply는 lock으로 막는다.

### 5) generated Python import를 확인한다

- 파일: `apply/runtime.py L500~L589`
- 역할: 새 `.msg/.srv/.action`에서 생성된 Python class를 실제 import하고 registry/package의 `import_available`을 갱신한다.
- 다음 흐름: Monitoring 지원 타입과 Interface Lab 실행 후보에 반영된다.

### 6) Monitor를 안전하게 재실행한다

- 파일: `apply/runtime.py L342~L357`
- 역할: Build와 import 확인 성공 응답을 보낸 뒤 standalone Monitor를 동일 PID로 재실행한다.
- 주의: Backend는 종료하지 않으며 Monitor의 짧은 재기동 구간에는 마지막 Runtime Cache를 유지한 뒤 자동 재연결한다.

## 4. 실행 기능

### Topic Publish

```text
등록 msg 선택
→ schema와 payload 입력
→ 이름/type 안전 검사
→ ROS message 변환
→ Publisher 생성/재사용
→ publish와 history
```

- Backend: `execution/topic_runtime.py L273~L416`
- API: `routers/topic_execution.py L15~L106`
- 공통 변환: `value_converter.py L37~L143`
- Action 내부 Topic은 일반 Message Publish에서 거부한다.
- Graph에 같은 이름의 다른 타입이 있으면 전송 전에 거부한다.

### Topic Receive

```text
사용자가 start
→ InterfaceReceiveRuntime Subscription
→ 메시지와 history 저장
→ stop/reset
```

- Backend: `execution/topic_runtime.py L113~L272`
- API: `routers/topic_execution.py L108~L175`
- Monitoring 자동 Subscription과 별도다.

### Service Call

```text
등록 srv와 Graph exact match
→ request validation
→ service_is_ready()
→ call_async()
→ response 또는 Timeout
→ history/summary
```

- Backend: `execution/service_call_runtime.py L85~L188`
- history: `service_call_runtime.py L189~L278`
- API: `routers/service_execution.py L15~L97`
- validation 실패는 `sent_to_server=false`
- Timeout은 `error_type=timeout`
- `response.success=false`는 `response_failed`
- 자동 active check는 실행하지 않는다.

### Action Goal

```text
등록 action과 Graph exact match
→ Goal validation
→ send_goal_async()
→ accepted/rejected
→ Feedback callback
→ get_result_async()
→ succeeded/canceled/aborted 또는 Timeout
→ history/summary
```

- Backend: `execution/action_goal_runtime.py L91~L239`
- history/summary: `action_goal_runtime.py L240~L355`, `L620~L643`
- API: `routers/action_execution.py L15~L105`
- Goal 거절, 전송 실패, 수락 Timeout, Result Timeout을 구분한다.
- 사용자 cancel 요청 기능은 현재 없다.

## 5. Frontend 흐름

- 전체 workspace와 실행 state: `InterfaceLabPage.jsx L45~L539`
- Service 실행 영역: `InterfaceLabPage.jsx L836~L905`
- Topic 실행 영역: `InterfaceLabPage.jsx L906~L1044`
- Action 실행 영역: `InterfaceLabPage.jsx L1045~L1128`
- 등록/업로드 보조 UI: `InterfaceUploadControl.jsx L48~L2207`

Frontend는 registry, package, callable, history를 합쳐 작업 항목을 만든다. 사용자가 직접 입력한 Publish Topic 이름은 Graph polling으로 덮어쓰지 않는다.

## 6. 입력 데이터

- Interface 정의 파일 또는 full type
- Build/import 결과
- Graph name/type
- 사용자 payload, request, Goal, timeout

## 7. 처리 과정

관리 코드는 파일과 registry를 다루고, Apply 코드는 build/import를 다루며, execution Runtime은 실제 ROS 통신을 담당한다. 이 책임을 섞지 않는다.

## 8. 출력 데이터와 다음 단계

- registry/package/apply status
- callable message/service/action 후보
- Publish/Receive/Call/Goal 결과와 history
- import 가능한 등록 타입은 Monitoring 주요 항목과 상세 감시에도 연결된다.

Monitoring 연결은 [03_topic_flow.md](03_topic_flow.md), [04_service_flow.md](04_service_flow.md), [05_action_flow.md](05_action_flow.md)를 참고한다.

## 9. 핵심 요약

1. 등록→Build→import 확인이 끝나야 generated Interface를 안전하게 실행할 수 있다.
2. Monitoring은 관찰하고 Interface Lab은 사용자가 누른 작업만 실행한다.
3. single interface package와 완성 package 저장소의 생성·삭제 정책을 섞지 않는다.
