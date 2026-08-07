# CURRENT STATUS

마지막 갱신: 2026-08-07

이 문서는 다음 AI가 현재 작업 지점을 빠르게 파악하기 위한 요약이다. 세부 정책은
`AGENTS.md`, 누적 이력은 `.codex/WORK_LOG.md`를 확인한다. 문서와 코드가 다르면 실제 코드와
검증 결과를 우선한다.

## 현재 프로젝트 구조

```text
ros2_dashboard/
├─ backend/                     # 순수 FastAPI, Monitor client/cache, REST/WS, 사용자 정책
│  ├─ app/
│  ├─ config/user_preferences.yaml
│  └─ tests/
├─ ros2_ws/src/
│  ├─ ros2_dashboard_monitor/   # rclpy Monitor와 Interface Lab 실제 ROS2 실행
│  ├─ ros2_dashboard_interfaces/
│  ├─ ros2_dashboard_demo_nodes/
│  └─ uploaded_interfaces/
│     ├─ generated_interfaces/
│     └─ packages/
├─ frontend/                    # Vite/React UI
├─ docs/
├─ scripts/
└─ .codex/                     # AI 현재 상태와 누적 작업 기록
```

`ros2_ws/build`, `install`, `log`, `frontend/node_modules`, `frontend/dist`, `.runtime`은 생성물이다.
구 `backend/src`와 구 `topic/service/action/node` 패키지 구조를 다시 만들지 않는다.

## 현재 구현 상태

- 구조 분리 기준선은 Git 커밋 `9d18c14`~`405071e`에 반영되어 있다. ROS2 직접 접근은
  `ros2_dashboard_monitor`, 웹 API와 Runtime Cache는 `backend/app`, UI는 `frontend`가 담당한다.
- Monitor와 Backend는 같은 메모리를 공유하지 않고 localhost HTTP로 통신한다. Monitor는
  기본 `127.0.0.1:8765`, Backend 공개 API는 실행 인자 기준 기본 `127.0.0.1:8000`이다.
- Backend는 Monitor snapshot을 polling하고 공개 REST 및 `/ws/monitor` Browser WebSocket을
  제공한다. Backend 코드에서 `rclpy` Node를 만들지 않는다.
- Interface Lab의 등록, package upload, build/apply/import 확인과 Topic Publish/Receive,
  Service Call, Action Goal/Feedback/Result/Cancel 실행은 Monitor 영역에 있다.
- Frontend는 route lazy loading과 기능별 API/Interface Lab panel 분리가 적용되어 있다.
- Interface Lab의 Topic Publish/Continuous Publish, Service Call, Action Goal 실행 상태·선택 보정·
  API 호출·history 갱신은 각각 `useTopicExecutionController`, `useServiceExecutionController`,
  `useActionExecutionController` hook으로 분리되어 있다.
- Topic/Service/Action Receive의 목록·검색·start/stop/reset·history·1초 polling은
  `useInterfaceReceiveController`로 분리되어 있다.
- Interface Lab Workspace의 Service/Topic/Action 상세 View와 schema/history/JSON 공통 UI는
  `features/interface-lab/workspace/` 아래 기능별 component로 분리되어 있다.
- Interface Lab model은 `model/workspaceItems.js`, `schemaValues.js`, `executionHistory.js`,
  `workspaceDataUtils.js`, `workspacePresentation.js`로 분리됐고 구 `interfaceLabModel.js`는 제거됐다.
- Interface Upload의 Apply 초기 조회, 외부 refresh signal 처리, Monitor 재연결 후 import 확인과
  fallback timer는 `useInterfaceControlLifecycle`로 분리됐다. 열린 실행 panel 새로고침은 각
  Topic/Service/Action controller의 `load()` 경로를 재사용한다.
- Interface Upload의 Topic·Service·Action 실행 controller 생성, Service/Action Receive 선택 동기화와
  Receive가 실행 후보를 교체하는 연결은 `useInterfaceExecutionSuite`가 담당한다. 개별 실행 및 Receive
  상태/명령 구현은 기존 controller hook에 유지한다.
- Interface Upload의 관리/Receive/Topic·Service·Action panel 전환, 실행 후보 로딩, 확장 상태 알림은
  `useInterfacePanelCoordinator`가 담당한다. Management controller는 관리 데이터 조회 결과만 반환하고
  다른 기능 panel을 직접 닫지 않는다.
- Interface Lab 목록의 inline 실행은 `useInlineTopicController`와
  `useInlineServiceActionController`로 분리됐고, `useInlineWorkspaceController`는 현재 선택 종류에
  맞는 상태와 명령을 조합한다.
- Visualization graph 변환은 전체 graph coordinator `graphTransform.js`, 선택 Node graph
  `graphNodeView.js`, node/edge 모델 `graphElements.js`, 숨김·활성 정책 `graphFilters.js`로 분리됐다.
- Visualization의 모드/검색/항목/레이아웃 Toolbar는 `VisualizationToolbar.jsx`, loading/error와 Node 목록
  선택 View는 `VisualizationNodePicker.jsx`가 담당한다. `VisualizationPage.jsx`는 graph hook 상태 전환,
  summary와 canvas/detail 조립을 담당한다.
- Overview의 Alert 및 Node/Topic/Service/Action 미리보기 카드는 `OverviewPreviewGrid.jsx`, 상태 분포
  column/table과 percent/count 전환은 `OverviewColumnChart.jsx`가 담당한다. `OverviewPage.jsx`는 resource
  summary 계산과 Alert source별 상세 화면 이동 정책을 담당한다.
- Action Table의 Feedback/Result preview 선택과 배지 상태·라벨·정렬 우선순위 정책은
  `features/actions/actionPresentation.js`가 담당한다. `ActionTable.jsx`는 정렬 상태, 행과 modal 렌더링을
  담당한다.
- Action 상세의 연결 Node/endpoint, 실행 측정, capability와 JSON preview 영역은
  `features/actions/ActionDetailSections.jsx`가 담당한다. Goal/Result 상태 한글 라벨과 tone도
  `actionPresentation.js`에 모았으며 `ActionDetailPanel.jsx`는 안내, 기본 상태, QoS와 section 조립을 담당한다.
- Interface Upload toolbar와 수동 Interface 등록/작성 form은 각각 `InterfaceUploadToolbar.jsx`,
  `InterfaceManualPanel.jsx`로 분리됐다.
- 구 `InterfaceUploadParts.jsx`는 제거됐다. Registry/schema View는 `InterfaceRegistryParts.jsx`,
  실행 입력·결과·history View는 `InterfaceExecutionShared.jsx`, 순수 key/status/value helper는
  `model/interfaceUploadModel.js`에 있다.
- Interface Lab Topic의 지속 Publish thread/state 관리는 `topic_continuous_runtime.py`로 분리됐고,
  `topic_runtime.py`는 기존 public method를 통해 이를 위임한다.
- Interface Lab Topic Publisher 재사용·adaptive QoS 상태·destroy는 `topic_publisher_pool.py`, Publish
  history 상한/조회/조건 삭제는 공통 `BoundedExecutionHistory`가 담당한다.
- Interface Lab Topic Subscription 생성·중지·adaptive QoS·수신 history/state는
  `topic_receive_runtime.py`가 담당하며 `topic_runtime.py`는 public facade/coordinator 역할을 한다.
- Interface Lab의 등록 Message 조회·실행 가능 검증·schema 조립은 `topic_message_registry.py`, Topic
  Graph 조회·type 충돌 상태 계산은 `topic_graph.py`가 담당한다. `topic_runtime.py`에는 단일 Publish
  요청 조립과 분리 runtime 위임만 남아 있다.
- Interface registry YAML의 정규화·원자적 저장·공유 lock은 `management/registry_storage.py`, 단일
  업로드 파일의 생성 package 저장과 CMake/package.xml 갱신은 `interface_package_installer.py`가
  담당한다. `registry.py`는 기존 public API와 등록 흐름을 조정한다.
- Registry build 완료 표시, import 상태 갱신, 실제 파일/CMake/package.xml 기반 apply 판정은
  `management/registry_apply_status.py`가 담당한다. `registry.py`는 lock 범위와 저장 시점을 관리한다.
- 업로드 package의 ZIP/폴더 입력 크기·경로·symlink·허용 파일 검사는 `management/package_archive.py`,
  package Registry YAML 정규화·원자적 저장은 `package_registry_storage.py`가 담당한다.
- 업로드 package의 build/import/apply 상태는 `management/package_apply_status.py`, package.xml과
  CMake identity 검증 및 msg/srv/action 정의 수집은 `package_inspector.py`가 담당한다.
- 사용자 직접 작성 Interface 검증은 `management/manual_validation.py`, Registry CRUD는
  `manual_registry.py`, generated package의 파일 스캔·의존성 수집·CMake/package.xml 재생성은
  `generated_package.py`가 담당한다. `manual_interfaces.py`는 공개 작성·수정·삭제 흐름을 조정한다.
- Interface Apply 상태 YAML/log I/O는 `apply/status_storage.py`, workspace package 중복 검사와 package
  범위 생성물 정리는 `workspace_packages.py`, install Python 경로 반영은 `install_paths.py`, 단일/package
  apply 상태 병합은 `summary.py`가 담당한다.
- Interface Apply colcon 호출과 build/skip/error 로그 조립은 `apply/build_executor.py`, 단계별 공개 상태
  payload 조립은 `result_builder.py`가 담당한다. `apply/runtime.py`는 lock, preflight, build/import 순서를
  조정한다.
- Topic Graph/cache의 공개 API 상태 조립은 `ros2_topic/snapshot.py`가 담당한다. 누락된 설정 Topic,
  monitoring role/primary/Hz 상태, latest preview와 QoS 공개 필드를 이 계층에서 결합하며
  `ros2_topic/runtime.py`는 lock 아래 원시 상태를 복사해 전달한다.
- 일반 Topic 연결·missing·stale Alert 정책은 `ros2_topic/alerts.py`, 프로젝트 전용
  `ros2_dashboard_interfaces/msg/MonitorStatus` payload의 severity/identity/value 변환은
  `ros2_topic/monitor_status_alerts.py`가 담당한다.
- Topic subscription의 생성·type 변경 교체, Monitor 소유 endpoint 계산, 외부 endpoint 소멸 후 유예
  정리는 `ros2_topic/subscription_lifecycle.py`가 담당한다. runtime의 기존 private 메서드는 호환 facade와
  callback/QoS 의존성 연결 역할만 유지한다.
- Topic Graph 이름/type 필터링, endpoint count 조립, 외부 endpoint 존재 판정과 이전 항목의 disconnected
  보존은 `ros2_topic/graph_collector.py`가 담당한다. runtime은 이전 cache와 자동 subscription/count
  callback을 주입하고 결과 cache를 교체한다.
- Topic latest/Hz의 Message class import, adaptive subscription QoS 선택, timestamp window 기반
  Hz/age/stale 계산과 공개 응답 payload는 `ros2_topic/query_support.py`가 담당한다. runtime은 요청 검증,
  subscription 보장과 cache 접근 순서를 조정한다.
- Action Graph 전체 조회와 Node별 server/client endpoint count 집계는 `ros2_action/graph.py`가 담당한다.
  `ActionRuntime`의 기존 Graph private method는 테스트·호환 facade로 유지된다.
- Action status/feedback subscription 생성, endpoint별 adaptive QoS와 capability 상태, 내부 subscriber count,
  subscription destroy는 `ros2_action/subscription_lifecycle.py`가 담당한다. runtime은 entry 교체와 result
  runtime support/cleanup 순서를 조정한다.
- Topic·Service·Action·Node Alert 생성 병합과 dismissed/retained/resolved/history 상태 전이는
  `alert_assembler.py`가 담당한다. `RosMonitor`는 각 runtime snapshot을 수집하고 lock 아래 상태 전이 결과를
  저장한다.
- Browser WebSocket용 경량 `monitor_snapshot` payload와 Topic/Service/Action/Node meta 축약은
  `snapshot_summary.py`가 담당한다. `RosMonitor`는 원본 snapshot과 Alert를 수집해 전달한다.
- rclpy 초기화, Monitor Node/timer 생성, daemon spin thread 시작, shutdown/join/destroy는
  `monitor_lifecycle.py`가 담당한다. `RosMonitor.stop()`은 Interface runtime 중지·clear와 Alert cache
  초기화 순서를 유지한다.
- Interface Lab Action Goal history의 Feedback/Result 이벤트 변환, reset 경계 필터링, Action별 최근
  결과와 성공·실패·취소 누적 summary는 `execution/action_history.py`가 담당한다.
- Interface Lab ActionClient의 이름/type별 재사용, Goal/Result/Cancel Service와 Feedback/Status Topic의
  5개 QoS 선택 및 실제 사용 상태 보존은 `execution/action_client_pool.py`가 담당한다.
  등록 Registry/package Action 정규화, Graph exact type 매칭, callable 상태와 실행 허용 판정은
  `execution/action_discovery.py`가 담당한다. `action_goal_runtime.py`는 Goal/Cancel 실행, 활성 Goal과
  history 흐름을 조정한다.
- Interface Lab Service Client의 기본 QoS 적용, 이름/type별 생성·재사용과 Dashboard 생성 상태는
  `execution/service_client_pool.py`가 담당한다. Call 원본 저장, Receive 이벤트 변환, reset 경계와
  Service별 최근 결과/누적 summary는 `execution/service_history.py`가 담당하며
  `service_call_runtime.py`는 discovery·허용 검사·호출 실행을 조정한다.
- Frontend Interface Lab Receive의 Topic·Service·Action mode별 Panel 선택과 Workbench View는
  `features/interface-lab/InterfaceReceiveWorkspace.jsx`가 담당한다. `InterfaceUploadControl`은 각 Controller
  상태와 callback을 mode별 props로 그룹화한다.
- Frontend Interface Lab의 Graph Service/Action entry 병합과 callable workspace item 변환은
  `model/workspaceGraphItems.js`, Registry와 업로드 package/child interface의 source item 변환은
  `model/workspaceSourceItems.js`가 담당한다. `workspaceItems.js`는 source/graph item 조립과 type별 병합,
  최종 필터를 담당하며 기존 source 변환 export를 re-export한다.
- Frontend 수동 Interface 입력 상태, 기존 type 등록, definition 작성·수정·문법 검증은
  `hooks/useManualInterfaceController.js`가 담당한다. 상위 management controller는 삭제·upload·apply 및
  Registry/Package 상태 동기화를 담당하고 기존 평면 반환값을 재노출한다.
- Frontend Service/Action 수신 관찰의 선택·검색·start/stop·전체/선택 history reset은 범용
  `hooks/useResourceReceiveObserver.js`가 담당한다. Topic은 실제 subscription 생성/중지가 필요하므로
  `useInterfaceReceiveController.js`에 별도 흐름으로 유지한다.
- Interface Upload의 Toolbar, 수동 입력, Receive, build 실패, Registry/package 및 실행 panel 표시 순서는
  `InterfaceUploadView.jsx`가 담당하고 Topic·Service·Action 실행 panel 선택은
  `InterfaceExecutionWorkspace.jsx`가 담당한다. `InterfaceUploadControl.jsx`은 controller 상태와 command를
  각 View props 계약으로 조립한다.
- Topic·Service·Action 실행 Controller, Receive Controller와 관리 Toolbar·수동 입력·Build 실패·Registry·
  Package 상태를 하위 panel props 계약으로 변환하는 순수 adapter는
  `model/interfaceUploadViewProps.js`가 담당한다. Control은 hook 호출과 adapter 입력 조립을 담당한다.
- Monitor FastAPI transport의 Content-Length/stream 이중 크기 제한과 JSON object 요청 검증은
  `transport/request_parsing.py`가 담당한다. Interface Router는 endpoint별 payload 변환과 도메인 오류의
  HTTP status 매핑을 담당한다.
- 업로드 ROS2 Interface package의 ZIP/folder upload, 목록과 삭제 HTTP endpoint는
  `transport/routers/interface_packages.py`가 담당하며 기존 `interface_management.router`가 하위 Router를
  include해 공개 경로와 transport app 등록 방식을 유지한다.
- Monitor 설정 데이터 모델과 YAML 값 정규화는 `monitor_config.py`가 담당한다. `config_loader.py`는
  환경 파일, 설정 경로, YAML/Registry 읽기와 최종 `BackendConfig` 조립을 담당하며 기존
  `MonitorConfig` 및 `_monitor_config` import 경로를 호환 유지한다.
- Topic/Service/Action/Node 감시 폴더명은 각각 `ros2_topic`, `ros2_service`, `ros2_action`,
  `ros2_node`다.

## 주요 설계와 정책

- 공개 API 경로와 기존 JSON key를 호환 유지한다.
- ROS2 사실 수집은 rclpy Graph API를 사용하며 ROS2 CLI 출력을 데이터 원천으로 파싱하지 않는다.
- Monitor 설정과 변경 가능한 Interface 데이터는 monitor package의 source config에 보존하고,
  사용자 별표는 `backend/config/user_preferences.yaml`에 보존한다.
- 배포값은 중앙 Settings/Config Loader와 `.env`/YAML에서 읽는다. 프로토콜 상수와 API key 같은
  불변값만 코드에 둔다.
- 자동 감시와 사용자가 명시적으로 요청하는 Publish/Call/Goal은 별도 실행 경로로 유지한다.
- Service timeout이나 server unavailable을 QoS 불일치로 단정하지 않는다.
- Git commit/push는 사용자가 명시적으로 요청할 때만 수행한다.

## 현재 작업 중인 내용

작업 트리는 clean하지 않다. 기존 변경을 reset하거나 일괄 덮어쓰지 말고 `git status`와
staged/unstaged diff를 먼저 확인해야 한다.

- QoS 확장 변경이 staged와 unstaged 상태로 섞여 있다. 공통 `qos.py`, Topic endpoint 비교와
  자동 선택, Service 기본 QoS 상태, Action의 Goal/Result/Cancel/Feedback/Status별 QoS,
  Interface Lab 적용, 상세 UI와 테스트가 포함된다.
- 새 `QosDetails.jsx`, `test_qos.py`, `start.md`는 현재 untracked다.
- `config.md`, `docs/qos/dds_qos.md`에도 미커밋 변경이 있다. 소유권과 의도를 확인하지 않고
  되돌리거나 포함 범위를 넓히지 않는다.
- 위 QoS 구현은 마지막 검수에서 동작했지만 아직 현재 Git 기준선에 커밋되지 않았다.
- `InterfaceUploadControl.jsx` Controller/수명주기 분리 변경과 관련 신규 hook도 현재 미커밋 상태다.

## 마지막 확인된 검증 상태

2026-08-07 전체 통합 검수 기록과 이후 리팩토링 대상 테스트 기록:

```text
ROS2 Monitor tests: 119 passed, 0 failures/errors/skips
Backend tests: 6 passed
colcon list/build: 5 packages 탐색 및 build 성공
Frontend lint/build/SSR import: 성공
Frontend 초기 bundle: 약 210 KB, 500 KB 경고 없음
실제 BEST_EFFORT LaserScan: endpoint QoS 자동 적용 후 수신 성공
실제 AddTwoInts Service: 7 + 5 = 12 응답 성공
실제 Action: goal/feedback/result 및 cancel accepted/canceled 확인
Monitor 설치 executable 및 localhost transport 단기 기동/종료: 성공
Backend 단독 uvicorn 단기 기동/종료: 성공
이후 기능 분리와 신규 package 보안 테스트 포함 직접 pytest: 120 passed
Apply executor/result 단위 테스트 추가 후 직접 pytest: 123 passed
Topic snapshot 조립 단위 테스트 추가 후 직접 pytest: 126 passed
Topic subscription lifecycle 단위 테스트 추가 후 직접 pytest: 129 passed
Topic Graph collector 단위 테스트 추가 후 직접 pytest: 132 passed
Topic query support 단위 테스트 추가 후 직접 pytest: 135 passed
Action Graph 집계 단위 테스트 추가 후 직접 pytest: 138 passed
Action subscription lifecycle 단위 테스트 추가 후 직접 pytest: 141 passed
Monitor Alert assembler 단위 테스트 추가 후 직접 pytest: 144 passed
WebSocket 경량 snapshot 계약 테스트 추가 후 직접 pytest: 145 passed
Monitor rclpy lifecycle 단위 테스트 추가 후 직접 pytest: 148 passed
Interface Action history 단위 테스트 추가 후 직접 pytest: 151 passed
Frontend Interface Receive Workspace 분리 후 lint/build: 성공, 초기 bundle 210.21 KB
Frontend Workspace Graph item 분리 후 lint/build/direct model 실행: 성공
Frontend Manual Interface controller 분리 후 lint/build: 성공
Frontend Service/Action receive observer 분리 후 lint/build: 성공
Monitor transport request parser 단위 테스트 추가 후 직접 pytest: 156 passed
Interface Package Router 계약 테스트 추가 후 직접 pytest: 158 passed
Monitor 설정 모델/값 변환 분리 후 직접 pytest: 158 passed
Frontend Interface Upload View 조립 분리 후 lint/build: 성공, 초기 bundle 210.21 KB
Interface Service Client/이력 분리 후 직접 pytest: 158 passed
Frontend Workspace Registry/package 모델 분리 후 lint/build/direct model 실행: 성공
Frontend Visualization Toolbar/Node picker 분리 후 lint/build: 성공
Frontend Overview Preview/상태 차트 분리 후 lint/build: 성공
Frontend Interface Upload 실행/Receive View props adapter 분리 후 lint/build/direct adapter 실행: 성공
Frontend Action Feedback/Result 표시 정책 분리 후 lint/build/direct presentation 실행: 성공
Frontend Action 상세 section/상태 표시 정책 분리 후 lint/build/direct presentation 실행: 성공
Frontend Interface Upload 관리 View props adapter 분리 후 lint/build/direct adapter 실행: 성공
Frontend Interface Upload 실행 composition hook 분리 후 lint/build: 성공
Interface Action Client pool/QoS 분리 후 Monitor 직접 pytest: 158 passed
Interface Action 등록/Graph/callable discovery 분리 후 Monitor 직접 pytest: 161 passed
Topic MonitorStatus 전용 Alert 변환 분리 후 Monitor 직접 pytest: 163 passed
```

이 수치는 이후 변경 후 자동으로 유효하지 않다. 관련 코드를 수정하면 영향 범위 검수를 다시 한다.

## 남은 문제와 제한사항

- QoS 변경의 최종 diff 검토와 사용자 요청에 따른 커밋 분리가 남아 있다.
- Jazzy 일반 Service Graph는 상대 Service endpoint QoS를 직접 제공하지 않으므로 Service는
  `qos_profile_services_default`를 사용하며 상대 QoS 판정은 `unknown/default_profile`일 수 있다.
- QoS 불일치를 영속 Alert 이력과 완전히 연결하는 작업은 남아 있다.
- WSS 운영 배포 검증, MariaDB Alert 영속 저장, Camera Topic 이미지 시각화,
  Gazebo TurtleBot 명령 preset은 확정된 향후 요구사항이지만 아직 완료되지 않았다.
- demo outcome server 종료 시 `rcl_shutdown already called` 중복 shutdown traceback이 관찰됐다.
  실행 기능과 별개지만 demo node cleanup 개선이 필요하다.
- `AGENTS.md` 하단에는 리팩토링 전 역사 기록이 남아 있다. 현재 경로/책임은 0절을 우선한다.

## 다음 작업 방향

1. 먼저 현재 staged/unstaged/untracked QoS diff를 보존한 채 범위를 재확인한다.
2. QoS 관련 정적 검사, ROS2 119 tests, Backend tests, Frontend lint/build를 변경 후 다시 실행한다.
3. 사용자 승인 시에만 QoS 변경과 문서 변경을 의도별 commit으로 정리한다.
4. Action Table/상세, Interface Upload 조립, Interface Action Client pool/QoS와 discovery,
   Topic MonitorStatus Alert 분리는 완료됐다. 다음은 381줄 `snapshot_assembler.py`의 Service/Action/Node
   resource별 조립 분리 또는 다른 Monitor 파일을 책임 기준으로 재평가한다.
5. 신규 기능은 WSS와 MariaDB Alert 이력 설계를 우선하며, 미구현 항목을 현재 기능으로
   보고하지 않는다.
