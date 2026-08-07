# WORK LOG

이 파일은 AI 작업 인수인계를 위한 누적 기록이다. 최신 프로젝트 요약은
`.codex/CURRENT_STATUS.md`를 확인한다. 앞으로 모든 작업은 날짜와 함께 아래에 추가한다.

## 2026-08-06 - ROS2 Monitor와 웹 Backend 구조 분리

- 작업: 기존 Backend 내부에 섞여 있던 rclpy Monitor와 Interface Lab 실행을
  `ros2_ws/src/ros2_dashboard_monitor` 독립 ament_python package로 이동하고, Backend를
  `backend/app` 순수 FastAPI 구조로 재구성했다.
- 이유와 기준: ROS2 직접 접근과 웹 서비스 책임을 프로세스 수준에서 분리하고, Backend가
  rclpy Node와 Runtime Cache를 직접 공유하지 않도록 하기 위해서다.
- 주요 변경: `ros2_topic/ros2_service/ros2_action/ros2_node` 이름 적용, localhost HTTP transport,
  Backend monitor client/cache, ROS2 config와 uploaded interface workspace 이전,
  `ros2_dashboard_interfaces`와 demo nodes package 분리, 실행 script와 import 경로 정리.
- 검증: compile, `colcon list`, `colcon build --symlink-install`, ROS package 실행, Backend/Frontend
  기동과 기존 자동 테스트를 단계별로 확인했다.
- 남은 내용: 구조 분리 이후 대형 파일의 기능 분리와 운영 설정 정리가 계속 필요했다.

## 2026-08-06 - Frontend, Monitor, Interface Lab 기능 분리 리팩토링

- 작업: 비대한 Frontend Interface Lab과 페이지, Monitor snapshot 조립, Interface registry 및
  Service/Action/Topic 실행 runtime의 책임을 기능별 module/component로 나눴다.
- 판단 기준: 줄 수 자체보다 독립 변경되는 책임, 실행 흐름, 상태 소유권을 기준으로 분리하고
  공개 API와 응답 key는 유지했다.
- 주요 변경: route lazy loading, 기능별 API module, Interface Lab management/execution/receive
  panel과 model/workspace 분리, snapshot assembler/helper 분리, parser/import checker,
  client pool/history/executor 경계 정리.
- 검증: 각 구간마다 Backend tests, ROS2 tests, Frontend lint/build를 수행했다. lazy loading 후
  초기 bundle은 약 210 KB로 줄어 기존 500 KB 경고가 사라졌다.
- 다음 작업: Interface Lab controller/model/view 잔여 집중도와 큰 ROS runtime을 계속 점검한다.

## 2026-08-06~2026-08-07 - Topic, Service, Action QoS 확장

- 작업: Topic에 한정됐던 QoS 정보를 Service와 Action까지 확장하고 Interface Lab 통신 생성 시
  확인 가능한 상대 endpoint QoS를 적용하도록 구현했다.
- 이유와 기준: 미수신/timeout을 QoS 오류로 오판하지 않으면서 실제 Graph profile 비교 또는
  DDS/RMW incompatible event가 있을 때만 명확한 불일치를 보고하기 위해서다.
- 주요 변경: 공통 QoS state/schema와 profile 직렬화, Topic publisher/subscription endpoint 비교와
  다중 endpoint partial 판정, Topic Publish/Receive 자동 profile 선택, Service default profile의
  명시적 저장, Action Goal/Result/Cancel service와 Feedback/Status topic별 profile 관리,
  공통 상세 UI와 테스트 추가. Topic scalar `status`를 Action Status Topic QoS로 오인하던 UI
  mapping도 수정했다.
- 검증: ROS2 Monitor 119 tests, Backend 6 tests, 5 package colcon build, Frontend lint/build/SSR
  import가 성공했다. 실제 BEST_EFFORT LaserScan 수신, AddTwoInts call, Action goal/feedback/result와
  cancel을 확인했다.
- 남은 문제: 변경은 현재 staged/unstaged/untracked 상태로 섞여 있으며 커밋되지 않았다.
  Service 상대 QoS는 Jazzy Graph API 제한으로 확인 불가 시 unknown/default로 남는다. QoS Alert
  영속화는 별도 작업이다.
- 다음 AI: 작업 트리를 reset하지 말고 `git status`, staged diff, unstaged diff를 모두 확인한 뒤
  이어서 수정하거나 사용자 요청 시 범위별 commit을 준비한다.

## 2026-08-07 - 실행 문서와 QoS 표시 점검

- 작업: 구조 변경 이후 실행 명령을 `start.md` 형식으로 정리하고 demo server 개별 실행 명령을
  추가했다. Topic QoS 화면이 항상 unknown/unavailable로 보인 원인을 실제 payload/UI mapping에서
  조사하고 수정했다.
- 검증: Monitor snapshot과 실제 ROS2 endpoint에서 QoS 값 및 자동 적용 상태가 내려오는 것을
  확인했다.
- 주의: `start.md`와 관련 문서 변경은 아직 untracked/미커밋 상태다.

## 2026-08-07 - AI 작업 인수인계 기록 체계 추가

- 작업: `AGENTS.md`에 작업 전 상태/로그 확인과 작업 후 자동 기록 규칙을 추가하고,
  `.codex/CURRENT_STATUS.md`와 `.codex/WORK_LOG.md`를 생성했다.
- 이유와 기준: 대규모 구조 변경과 미커밋 작업이 이어지는 상황에서 다음 AI가 완료/계획,
  커밋 기준선/작업 트리, 검증 여부를 혼동하지 않고 이어받게 하기 위해서다.
- 주요 변경: 현재 구조·책임 경계·QoS 작업 상태·마지막 검증·미구현 요구사항·다음 작업 지점을
  실제 코드와 Git 상태 기준으로 기록했다. AGENTS의 기존 ROS2 test 기준도 마지막 확인값인
  119 tests로 갱신했다.
- 검증: 지정된 세 파일만 수정 대상으로 사용했고 Markdown diff와 whitespace 오류를 확인했다.
- 남은 문제: 이후 모든 AI 작업이 종료될 때 이 로그를 누적하고 프로젝트 상태가 바뀌면
  CURRENT_STATUS도 함께 갱신해야 한다.
- 다음 AI: 어떤 작업이든 시작 전에 두 `.codex` 문서를 먼저 읽고, 기존 dirty 작업을 보존한다.

## 2026-08-07 - 인수인계 문서 운용 방식 확인

- 작업: 모든 작업 시작 시 `AGENTS.md`와 두 `.codex` 문서를 함께 읽고, 종료 시 작업 규모에 맞게
  WORK_LOG를 누적하며 프로젝트 상태가 바뀐 경우에만 CURRENT_STATUS도 갱신하는 절차를 확인했다.

## 2026-08-07 - Service QoS unknown 표시 진단

- 조사: 화면 payload와 ROS2 Jazzy의 실제 `rclpy.node.Node` 공개 API를 대조했다. Topic에는
  publisher/subscription endpoint 정보와 QoS를 조회하는 API가 있지만 Service에는 이름·타입·개수와
  Node 관계 API만 있고 상대 Service endpoint QoS profile 조회 API가 없다.
- 판단: Service 화면의 `unknown/default_profile`, 빈 remote QoS는 구현 누락이 아니라 조회 불가능을
  추정하지 않고 표시한 정상 상태다. 실제 Call 성공은 통신 성공 근거지만 상대 profile의 세부값을
  Graph에서 확인했다는 뜻은 아니다. 프로젝트 구현 상태는 바뀌지 않았다.

## 2026-08-07 - 기능 분리 리팩토링 재개 지점 확인

- 조사: 현재 Git 상태, 대형 파일 line count, Interface Lab component/hook과 ROS runtime 분리 결과를
  대조했다. 구조 분리, route/API 분리, Interface Lab 표시 panel, snapshot assembler,
  Service/Action executor·discovery·공통 history storage까지는 반영되어 있다.
- 다음 지점: `InterfaceUploadControl.jsx`에 남은 Topic/Service/Action 실행 state/effect/handler를
  controller hook으로 이동하는 작업이 가장 안전한 다음 구간이다. 이후 `InterfaceLabWorkspace.jsx`의
  Service/Topic/Action view 분리, `interfaceLabModel.js`의 model domain 분리 순서가 적절하다.
- 주의: Workspace/model과 여러 ROS runtime에는 미커밋 QoS diff가 겹치므로 기존 변경을 보존하고
  구간마다 검수해야 한다. 이번 확인에서는 구현 상태를 변경하지 않았다.

## 2026-08-07 - 현재 미커밋 변경 전체 검수

- 범위: 인수인계 문서와 QoS 관련 staged/unstaged/untracked 변경을 포함한 현재 작업 트리를
  Backend, Frontend, ROS2 workspace 단위로 검수했다.
- 결과: diff whitespace 검사, Backend compile과 6 tests, Frontend lint/build, ROS2 compile,
  `colcon list`, 5 package symlink build, Monitor 관련 119 tests가 모두 성공했다. Frontend 최대
  초기 공통 chunk는 약 210 KB이며 500 KB 경고가 없다.
- 기동: 설치 환경에서 `ros2_dashboard_monitor monitor` executable이 인식됐고 호스트 DDS 권한으로
  Monitor가 포트 18765에서 정상 기동·종료했다. Backend도 포트 18000에서 Monitor 없이 정상
  기동·종료했다. `timeout`에 의한 exit 124는 의도한 5초 종료 결과다.
- 정적 경계: `backend/app`과 Backend tests에서 rclpy import가 없고 구 backend package import도
  발견되지 않았다.
- 남은 범위: 이번 검수는 자동 테스트와 단기 smoke test다. 실제 장비 Topic/Service/Action 통합은
  이전 검수 결과를 유지하며 이번 차수에는 재실행하지 않았다. 코드 수정은 하지 않았다.

## 2026-08-07 - Interface Lab Service/Action 실행 Controller 분리

- 작업: `InterfaceUploadControl.jsx`가 직접 소유하던 Service Call과 Action Goal의 목록, 선택값,
  입력값, timeout, busy/result/history, import 필터, 실행 API 호출을 각각
  `useServiceExecutionController.js`, `useActionExecutionController.js`로 이동했다.
- 이유와 기준: 표시 panel은 이미 분리됐지만 실행 상태와 side effect가 상위 component에 남아 있어
  기능별 변경이 서로 영향을 주고 있었다. Receive와 공유하는 선택 key callback은 유지해 기존 화면
  동작과 API payload를 바꾸지 않았다.
- 결과: `InterfaceUploadControl.jsx`는 1,355줄에서 1,256줄로 줄었고 Service/Action 실행 책임은
  독립 hook이 소유한다. 공개 API 경로와 UI props는 변경하지 않았다.
- 검증: Frontend oxlint 경고 없이 통과, Vite production build 성공, diff whitespace 검사 통과.
  공통 bundle은 210.21 KB이며 500 KB 경고가 없다.
- 남은 문제: Topic Publish/Receive와 Service/Action Receive 새로고침은 상위 component에 남아 있다.
  Browser에서 실제 버튼을 누르는 수동 통합 검증은 이번 구간에 수행하지 않았다.
- 다음 AI: 다음 구간은 Topic 실행 controller를 먼저 분리한 뒤 공통 Receive orchestration을 별도
  hook으로 이동한다. 그 후 `InterfaceLabWorkspace.jsx` view 분리를 진행한다.

## 2026-08-07 - Interface Lab Topic 실행 Controller 분리

- 작업: Topic callable Message 목록, import 필터, 선택값/schema 기본값, Graph Publish 후보,
  Topic 이름 자동 선택 출처, 단일/연속 Publish, 결과·history, continuous 상태 polling을
  `useTopicExecutionController.js`로 이동했다.
- 이유와 기준: Topic Receive와 공유하는 Message 선택은 유지하되, 실제 Publish 통신과 Graph 후보
  정책을 상위 UI component에서 분리해 Service/Action 실행 Controller와 같은 책임 경계를 만들었다.
- 결과: `InterfaceUploadControl.jsx`는 직전 1,256줄에서 1,078줄로 감소했다. Topic API payload,
  직접 입력값 보존, Graph 후보 자동 선택, continuous polling 주기는 변경하지 않았다.
- 검증: Frontend oxlint 경고 없이 통과, Vite production build 성공, diff whitespace 검사 통과.
  공통 bundle은 210.21 KB이고 500 KB 경고가 없다.
- 남은 문제: Topic/Service/Action Receive 상태와 전체 후보를 동시에 갱신하는 orchestration은 여전히
  상위 component에 있다. 실제 브라우저 Publish/Continuous 버튼 수동 검증은 수행하지 않았다.
- 다음 AI: `useInterfaceReceiveController`로 Receive 목록·history·검색·start/stop/reset·1초 polling을
  옮기고 세 실행 Controller의 replace/select callback과 연결한다.

## 2026-08-07 - Interface Lab Receive Controller 분리

- 작업: Topic/Service/Action Receive의 Graph 후보, 선택 항목, 검색, 활성 관찰 key, history 필터,
  start/stop/reset API, 전체 후보 동기화와 1초 polling을 `useInterfaceReceiveController.js`로 옮겼다.
- 이유와 기준: Receive 새로고침이 세 실행 Controller의 목록을 함께 갱신해야 하므로 개별 panel에
  흩뜨리지 않고 orchestration hook 하나가 실행 Controller의 `replace` callback을 호출하게 했다.
- 정책 보존: Topic 사용자 직접 입력/Graph/자동 선택 출처, Message full_type 필터, Service/Action
  선택 동기화, reset 메시지, polling 주기와 API payload를 유지했다.
- 결과: `InterfaceUploadControl.jsx`는 직전 1,078줄에서 760줄로 감소했다. 상위 component에는
  관리 panel과 실행/Receive Controller 조립, 열린 panel 전환, refresh signal 조정만 남았다.
- 검증: Frontend oxlint 경고 없이 통과, Vite production build 성공, diff whitespace 검사 통과.
  공통 bundle 210.21 KB, 500 KB 경고 없음.
- 남은 문제: 신규 Receive hook은 394줄로 단일 기능 범위지만 향후 복잡도가 늘면 통신 종류별 command
  helper를 분리할 수 있다. 실제 브라우저 start/stop/reset 수동 검증은 수행하지 않았다.
- 다음 AI: `InterfaceLabWorkspace.jsx`의 Service/Topic/Action 상세 View와 history/field 공통 표시를
  별도 component 파일로 이동한다. QoS 관련 기존 model 변경은 보존한다.

## 2026-08-07 - Interface Lab Workspace 상세 View 분리

- 작업: `InterfaceLabWorkspace.jsx`에 함께 있던 Service, Topic, Action 상세 실행 View를
  `workspace/ServiceWorkspaceDetail.jsx`, `TopicWorkspaceDetail.jsx`,
  `ActionWorkspaceDetail.jsx`로 이동했다. schema input, connection, history, JSON/text block은
  `WorkspaceShared.jsx`로 분리했다.
- 이유와 기준: 통신 종류별 View는 서로 다른 입력과 실행 흐름을 가지므로 독립 변경 단위로 두고,
  반복 UI만 공통 component로 공유했다. 상위 Workspace는 항목 선택과 View 조립만 담당한다.
- 정책 보존: 기존 props, Service/Action 실행 조건, Topic Publish/Subscribe 동작, Goal cancel,
  history 선택과 Topic QoS 안내 문구를 그대로 이전했다.
- 결과: `InterfaceLabWorkspace.jsx`는 781줄에서 337줄로 감소했다. 신규 View는 Topic 180줄,
  Action 102줄, Service 78줄, 공통 UI 117줄이다.
- 검증: Frontend oxlint 경고 없이 통과, Vite production build 성공, diff whitespace 검사 통과.
  공통 bundle 210.21 KB, Interface Lab chunk 113.70 KB, 500 KB 경고 없음.
- 남은 문제: 실제 브라우저 inline 실행 수동 검증은 수행하지 않았다. `interfaceLabModel.js`가 약
  719줄로 merge/schema/history/presentation 책임을 함께 가진다.
- 다음 AI: `interfaceLabModel.js`를 domain helper로 분리하되 기존 named export를 사용하는 import를
  먼저 조사하고 단계적으로 이동한다. 기존 QoS model mapping을 보존한다.

## 2026-08-07 - Interface Lab model 도메인 분리

- 작업: 719줄 `interfaceLabModel.js`의 함수를 `model/workspaceItems.js`, `schemaValues.js`,
  `executionHistory.js`, `workspaceDataUtils.js`, `workspacePresentation.js`로 이동하고 모든 내부 import를
  실제 도메인 모듈로 변경했다. 사용되지 않는 구 re-export 파일은 제거했다.
- 이유와 기준: workspace item 조립, ROS schema 값 변환, 실행 history, merge data helper, UI 표시
  helper는 변경 이유와 소비자가 달라 독립 모듈로 분리하는 것이 적절하다.
- 정책 보존: 기존 named function 구현과 호출부를 그대로 이동했다. 미커밋 QoS 변경인
  `qos: { mode: 'adaptive' }` 매핑 두 곳도 `workspaceItems.js`에 보존했다.
- 결과: 가장 큰 `workspaceItems.js`는 import 포함 490줄이며 나머지는 50~79줄이다. 구
  `interfaceLabModel.js` 참조는 Frontend 소스에서 0건이다.
- 검증: Frontend oxlint 경고 없이 통과, Vite production build 성공, diff whitespace 검사 통과.
  공통 bundle 210.21 KB, Interface Lab chunk 113.36 KB, 500 KB 경고 없음.
- 남은 문제: 실제 브라우저 workspace 조립과 inline 실행 수동 검증은 수행하지 않았다.
  `InterfaceUploadControl.jsx` 760줄, `InterfaceLabPage.jsx` 589줄의 orchestration 집중도가 남아 있다.
- 다음 AI: `InterfaceUploadControl.jsx`의 panel visibility와 refresh signal 동기화를 별도 hook으로
  분리한 뒤 `InterfaceLabPage.jsx`의 inline Topic/Service/Action 실행 상태를 조사한다.

## 2026-08-07 - Interface Upload 수명주기 분리

- 작업: Apply 상태 초기 조회, 외부 `refreshSignal`에 따른 열린 관리/실행 panel 갱신, Monitor
  재연결 후 import 확인과 5초 fallback을 `useInterfaceControlLifecycle.js`로 이동했다.
- 이유와 기준: 화면 표시 component가 데이터 수명주기와 재연결 상태 전이를 직접 관리하지 않게 하고,
  새로고침 시 Topic/Service/Action controller의 기존 `load()`를 재사용해 중복 API·선택 보정 로직을
  제거하기 위해서다.
- 정책 보존: 공개 API, refresh signal 의미, 열린 panel만 갱신하는 조건, 사용자 직접 Topic 입력값
  보존과 controller 선택 보정 정책은 유지했다. Service/Action 선택은 controller의 `select()` 하나로
  통일해 Receive 선택 동기화와 입력 초기화를 같은 경로로 처리한다.
- 결과: `InterfaceUploadControl.jsx`는 760줄에서 585줄로 감소했고 신규 lifecycle hook은 97줄이다.
- 검증: Frontend oxlint와 Vite production build, diff whitespace 검사가 성공했다. 공통 bundle은
  210.21 KB, Interface Lab chunk는 112.94 KB이며 500 KB 경고가 없다.
- 남은 문제: 실제 브라우저에서 Apply 후 Monitor 재연결, 삭제 후 세 후보 갱신, panel 전환을 누르는
  수동 통합 검증은 수행하지 않았다. panel visibility/open orchestration은 상위 component에 남아 있다.
- 다음 AI: panel 전환 상태와 `loadCallable*`/Receive open 흐름을 전용 coordinator hook으로 분리한 뒤
  `InterfaceLabPage.jsx`의 inline 실행 orchestration을 조사한다.

## 2026-08-07 - Interface Upload panel coordinator 분리

- 작업: 관리 목록, Receive workbench, Topic/Service/Action 실행 panel의 열기·닫기·모드 전환과
  workspace 확장 상태를 `useInterfacePanelCoordinator.js`로 이동했다. 세 실행 후보 loader도 mode별
  공통 경로로 통합했다.
- 이유와 기준: Management controller가 자신의 데이터 조회 외에 실행 panel을 닫던 역방향 결합을
  제거하고, 여러 panel의 상호 배타 전환 규칙을 하나의 coordinator에서 확인할 수 있게 하기 위해서다.
- 정책 보존: Registry/Package 조회가 성공한 경우에만 실행 panel을 닫고, 실행 panel을 열 때 Receive
  상태도 갱신하며, mock 모드에서는 실행 panel을 닫는 기존 순서와 조건을 유지했다. 관리 조회 실패는
  기존처럼 feedback으로 표시하고 열린 실행 panel은 보존한다.
- 결과: `InterfaceUploadControl.jsx`는 585줄에서 492줄로 감소했다. Management controller는 조회 성공
  여부만 반환하고 panel 간 전환을 직접 수행하지 않는다. 신규 coordinator는 149줄이다.
- 검증: Frontend oxlint, Vite production build, diff whitespace 검사가 성공했다. 공통 bundle은
  210.21 KB, Interface Lab chunk는 114.09 KB이고 500 KB 경고가 없다.
- 남은 문제: 실제 브라우저 클릭 기반 panel 전환과 확장 상태 수동 검증은 수행하지 않았다.
- 다음 AI: `InterfaceLabPage.jsx` 589줄의 inline Topic/Service/Action 실행 상태와 page-level 데이터
  조립을 조사하고, API 실행 side effect부터 controller hook으로 분리한다.

## 2026-08-07 - Interface Lab inline 실행 controller 분리

- 작업: 목록 항목에서 수행하는 Service Call, Action Goal/Cancel, Topic 단일·연속 Publish,
  Subscribe start/stop, Topic history reset과 관련 입력·결과·polling 상태를
  `useInlineWorkspaceController.js`로 이동했다.
- 이유와 기준: Page가 snapshot과 목록 View 조립 외에 ROS 실행 API payload와 오류 상태까지 직접
  소유하던 책임을 제거하고, 사용자 명시 실행 경로를 하나의 controller 경계로 만들기 위해서다.
- 정책 보존: Service/Action target 선택 우선순위, timeout, numeric schema 변환, Topic 직접 입력 보존,
  Graph 후보 자동 선택, QoS가 포함된 기존 API 응답, 연속 Publish 1초 polling, history limit 500과
  성공/실패 결과 shape를 변경하지 않았다.
- 결과: `InterfaceLabPage.jsx`는 589줄에서 322줄로 감소했고 inline controller는 361줄이다. Page에는
  snapshot refresh, summary/workspace item 조립, 선택 및 View props 연결이 남았다.
- 검증: Frontend oxlint, Vite production build, diff whitespace 검사가 성공했다. 공통 bundle은
  210.21 KB, Interface Lab chunk는 115.39 KB이고 500 KB 경고가 없다.
- 남은 문제: 실제 브라우저 inline Topic/Service/Action 버튼 수동 통합 검증은 수행하지 않았다.
  Controller는 단일 inline 실행 경계지만 Topic과 Service/Action 구현을 내부 hook으로 더 나눌 수 있다.
- 다음 AI: inline controller의 Topic 통신과 Service/Action 통신을 domain hook으로 분리한 뒤 Page의
  workspace 목록 선택/필터 조립을 별도 hook으로 옮길지 판단한다.

## 2026-08-07 - 기능 분리 리팩토링 진행률 재평가

- 현재 코드의 책임 경계, 최근 분리 내역과 영역별 대형 파일을 다시 대조했다.
- 구조/프로세스 분리는 거의 완료됐지만 내부 기능 분리는 Backend 약 90%, Frontend 약 70%,
  ROS2 Monitor 약 60%로 평가했다. 전체 가중 진행률은 약 68%다.
- 남은 핵심은 Frontend graph/Interface Lab controller 세분화와 ROS2 Interface Lab runtime,
  `ros2_topic/runtime.py`, `ros_monitor.py`의 추가 책임 분리다. 이 평가는 기능 완성률이 아니라
  현재 목표인 기능 분리 리팩토링 진행률이다.

## 2026-08-07 - Inline Topic과 Service/Action domain 분리

- 작업: 361줄 `useInlineWorkspaceController`에서 Topic 자동 선택·Publish·Subscribe·history·polling을
  `useInlineTopicController.js`로, Service Call과 Action Goal/Cancel을
  `useInlineServiceActionController.js`로 이동했다.
- 이유와 기준: Topic은 Graph 후보와 지속 실행 상태를 사용하지만 Service/Action은 callable target과
  timeout 기반 요청을 사용하므로 변경 이유와 통신 정책이 다르다. 상위 controller는 두 domain의
  외부 계약을 조합하는 역할만 맡겼다.
- 정책 보존: 기존 API payload, numeric schema 변환, history limit 500, Topic 이름 입력 출처,
  1초 continuous polling, Service/Action target 우선순위와 오류 result shape를 그대로 유지했다.
- 결과: 조합 controller는 361줄에서 61줄로 줄었고 Topic hook 258줄, Service/Action hook 124줄로
  분리됐다. `InterfaceLabPage.jsx` props 계약은 변경하지 않았다.
- 검증: Frontend oxlint, Vite production build, diff whitespace 검사가 성공했다. 공통 bundle은
  210.21 KB, Interface Lab chunk는 116.92 KB이고 500 KB 경고가 없다.
- 남은 문제: 실제 브라우저 inline 실행 수동 통합 검증은 아직 수행하지 않았다. Topic hook은
  단일 통신 domain이며 현재 300줄 미만이라 추가 분리보다 `graphTransform.js`를 우선한다.
- 다음 AI: 598줄 `frontend/src/utils/graphTransform.js`의 데이터 정규화, 필터와 layout 책임 및
  소비자 import를 조사해 단계적으로 분리한다.

## 2026-08-07 - Visualization graph transform 도메인 분리

- 작업: 598줄 `graphTransform.js`에서 숨김·활성 정책을 `graphFilters.js`, React Flow node/edge 생성과
  검색을 `graphElements.js`, 선택 Node 제한 graph 조립을 `graphNodeView.js`로 이동했다.
- 이유와 기준: 필터 정책, graph 데이터 모델, 전체 graph와 선택 Node graph는 입력 변경 원인과
  검증 기준이 달라 독립 모듈로 분리했다. 기존 소비자는 public facade인 `graphTransform.js`를 유지한다.
- 정책 보존: internal Topic/Node 제외, activeOnly, 등록 interface 예외, 검색 시 인접 edge 포함,
  선택 Node별 action/service/topic/edge 제한, layout 호출과 summary key를 그대로 유지했다.
- 결과: `graphTransform.js`는 598줄에서 123줄로 줄었다. 신규 모듈은 elements 112줄, filters 81줄,
  node view 143줄이며 기존 import 경로 변경은 없다.
- 검증: Frontend oxlint, Vite production build, diff whitespace 검사와 all/connected mode graph 변환
  Node smoke test가 성공했다. Visualization chunk는 207.40 KB, 500 KB 경고가 없다.
- 남은 문제: 실제 브라우저에서 대규모 graph 검색·필터·Node 선택 UI 수동 검증은 수행하지 않았다.
- 다음 AI: 535줄 `InterfaceUploadParts.jsx`에서 toolbar, manual interface form, 순수 model helper를
  분리한 후 Frontend 누적 변경 검수를 수행하고 ROS2 runtime 리팩토링으로 이동한다.

## 2026-08-07 - Interface Upload toolbar/manual View 분리

- 작업: `InterfaceUploadParts.jsx`의 파일·package upload 및 실행 panel 진입 toolbar를
  `InterfaceUploadToolbar.jsx`로, 기존 타입 등록과 수동 definition 작성 form을
  `InterfaceManualPanel.jsx`로 이동했다.
- 이유와 기준: 두 View는 `InterfaceUploadControl`에서만 소비되고, registry/result/schema 공통 요소와
  변경 이유가 달라 독립 component로 분리하기 적합하다.
- 정책 보존: 모든 button/input props, disabled 조건, reload 상태 문구, manual edit·validate·save
  흐름과 generated interface 저장 경로 안내를 그대로 유지했다.
- 결과: `InterfaceUploadParts.jsx`는 535줄에서 397줄로 감소했다. Toolbar 53줄, Manual panel 83줄이다.
- 검증: Frontend oxlint, Vite production build와 diff whitespace 검사가 성공했다. 공통 bundle은
  210.21 KB, Interface Lab chunk는 116.92 KB이며 500 KB 경고가 없다.
- 남은 문제: `InterfaceUploadParts.jsx`에는 순수 helper와 registry/result/history View가 함께 남아 있다.
- 다음 AI: key/status/default value helper를 model 파일로 옮기고 실행 결과/입력 View와 registry View를
  분리한 뒤 구 `InterfaceUploadParts.jsx`를 제거한다.

## 2026-08-07 - Interface Upload 공통 Parts 완전 분리

- 작업: `InterfaceUploadParts.jsx`의 key/status/default value 변환을
  `model/interfaceUploadModel.js`, package/registry/schema 표시를 `InterfaceRegistryParts.jsx`,
  Request field와 실행 결과/history 표시를 `InterfaceExecutionShared.jsx`로 이동하고 구 파일을 제거했다.
- 이유와 기준: 순수 계산 helper가 JSX component와 함께 있어 hook이 View 모듈을 import하던 결합을
  해소하고, registry 관리 View와 실행 결과 View를 독립 변경 단위로 만들기 위해서다.
- 정책 보존: key 문자열, status 문구, numeric/default 값 변환, registry 최근 삭제 표시, package schema,
  validation 오류와 history JSON 표시를 그대로 유지했다. 모든 소비 import는 새 실제 소유 경로로 바꿨다.
- 결과: 구 397줄 Parts 파일과 잔여 import가 0건이다. 신규 파일은 registry 122줄, execution shared
  121줄, model 98줄이며 불필요한 re-export facade를 남기지 않았다.
- 검증: Frontend oxlint, Vite production build, diff whitespace 검사와 key/default value model smoke가
  성공했다. 공통 bundle은 210.21 KB, Interface Lab chunk는 116.89 KB이고 500 KB 경고가 없다.
- 남은 문제: 실제 브라우저의 upload/manual/registry/실행 panel 클릭 수동 검증은 수행하지 않았다.
  `useInterfaceManagementController.js` 432줄은 단일 관리 domain이지만 추후 storage/upload/apply 명령
  분리를 검토할 수 있다.
- 다음 AI: Frontend 우선 구간을 종료하고 751줄 ROS2
  `interface_lab/execution/topic_runtime.py`의 publisher pool, receiver/history 책임부터 조사한다.

## 2026-08-07 - Interface Lab 지속 Topic Publish runtime 분리

- 작업: `topic_runtime.py`가 직접 소유하던 지속 Publish start/stop/list, thread loop와 상태 정리를
  `topic_continuous_runtime.py`의 `ContinuousTopicPublishRuntime`으로 이동했다.
- 이유와 기준: 지속 발행은 Event/Thread 수명주기와 반복 상태 머신이라는 독립 책임이다. 미커밋 QoS
  변경과 충돌하지 않도록 실제 단일 Publish, publisher 생성 및 adaptive QoS 선택은 기존 runtime에
  남기고 callback으로 호출하게 했다.
- 정책 보존: 첫 Publish 성공 후 thread 시작, 중복 실행 거부, Hz 정규화, 2초 join, message count,
  오류 시 자동 중지, public 응답에서 thread/Event 제외와 기존 public method 이름을 유지했다.
- 결과: `topic_runtime.py`는 751줄에서 642줄로 감소했고 지속 실행 runtime은 170줄이다.
- 검증: Python compile 성공, Topic Interface Lab targeted test 10개 통과, workspace install을 source한
  Monitor test 디렉터리 114개 전체 통과, diff whitespace 검사 통과. install을 source하지 않은 첫 전체
  실행의 9개 실패는 `rths_interfaces` import 환경 누락이었고 source 후 모두 해소됐다.
- 남은 문제: Publisher pool, Publish history와 Topic receive subscription/history가 원 runtime에 남아
  있다. 실제 ROS graph를 사용한 지속 Publish 수동 실행은 이번 구간에 수행하지 않았다.
- 다음 AI: Publish history store를 공통 storage로 옮기고 publisher pool을 QoS 상태와 함께 분리한다.

## 2026-08-07 - Interface Lab Topic Publisher pool/history 분리

- 작업: Topic 이름·타입별 Publisher 생성/재사용, adaptive QoS 상태와 destroy를
  `topic_publisher_pool.py`로 이동했다. Publish history는 기존 `BoundedExecutionHistory`를 사용하고,
  공통 저장소에 predicate 기반 `remove()`를 추가해 선택 Topic reset을 지원했다.
- 이유와 기준: Publisher lifecycle은 subscription/history와 다른 ROS resource 책임이고, 실행 history는
  Service/Action에서 이미 사용하는 bounded storage 정책과 동일하므로 중복 리스트 관리를 제거했다.
- 정책 보존: Publisher 생성 시 `topic_qos(..., local_role='publisher')`, incompatible QoS event,
  이름·타입 key 재사용, QoS snapshot, 실행 source/node metadata, 최신순 최대 보존, Topic별 reset과
  Runtime clear 시 subscription 후 publisher destroy 순서를 유지했다.
- 결과: `topic_runtime.py`는 642줄에서 624줄로 감소했고 Publisher pool은 72줄이다. 공통 history
  storage는 72줄이며 Service/Action 기존 사용 계약은 변경하지 않았다.
- 검증: Python compile, Topic/runtime summary 관련 18 tests, workspace install 환경의 Monitor 전체
  114 tests와 diff whitespace 검사가 통과했다.
- 남은 문제: 실제 ROS graph Publisher QoS 수동 통합은 이번 구간에 다시 실행하지 않았다. Topic
  subscription과 receive history/state, Message registry/Graph discovery가 원 runtime에 남아 있다.
- 다음 AI: subscription 생성·중지·clear와 receive history/state를 별도 runtime으로 이동한다.

## 2026-08-07 - Interface Lab Topic Receive runtime 분리

- 작업: Topic Subscription 생성/재사용/중지/clear, adaptive subscription QoS, 메시지 callback 변환,
  Topic별 bounded receive history와 dashboard state 조립을 `topic_receive_runtime.py`로 이동했다.
- 이유와 기준: Receive는 Publisher/continuous Publish와 별도의 ROS resource lifecycle이며, subscription과
  callback history는 같은 key/state를 공유하므로 하나의 runtime 경계로 분리하는 것이 안전하다.
- 정책 보존: 기존 `topic_runtime.get_message` monkeypatch가 계속 작동하도록 동적 loader callback을
  주입했다. history limit, sequence, preview/size/error, stop destroy 오류 응답, reset 시 subscription
  제거, `topic_qos(..., local_role='subscription')`과 incompatible event, public method/key를 유지했다.
- 결과: `topic_runtime.py`는 624줄에서 439줄로 감소했고 Receive runtime은 277줄이다. 상위
  `InterfaceReceiveRuntime`의 외부 class 이름과 Monitor/Router 호출 계약은 바뀌지 않았다.
- 검증: Python compile, Topic targeted 10 tests, workspace install 환경 Monitor 전체 114 tests와
  diff whitespace 검사가 통과했다.
- 남은 문제: 실제 ROS Topic receive 수동 통합은 이번 구간에 재실행하지 않았다. Message registry와
  Graph discovery/state 계산, 단일 Publish orchestration은 facade에 남아 있다.
- 다음 AI: 등록 Message 조회/검증과 Topic Graph 조회·충돌 state 계산을 별도 discovery 모듈로 옮긴다.

## 2026-08-07 - Interface Lab Message registry와 Topic Graph 분리

- 작업: 등록된 Message 목록 통합, 실행 가능 검증, schema/callable 응답 조립을
  `topic_message_registry.py`로 이동했다. rclpy Topic 이름·타입·endpoint 수 조회와 동일 이름 type 충돌
  상태 계산은 `topic_graph.py`로 이동했다.
- 이유와 기준: 사용자 등록 데이터 해석과 현재 ROS Graph 사실 조회는 데이터 원천과 실패 조건이 다르며,
  Publish/Receive 양쪽이 공통 사용하므로 실행 facade 내부의 private helper로 둘 이유가 없었다.
- 정책 보존: 기존 API key, Message 정렬, manual/package registry 통합, import 가능 조건, Graph conflict
  경고와 publisher/subscriber count를 유지했다. 기존 테스트가 `topic_runtime.registry_snapshot`과
  `registered_package_messages`를 monkeypatch하므로 loader callback을 주입해 호환성을 보존했다.
- 결과: `topic_runtime.py`는 439줄에서 338줄로 감소했다. 신규 Message registry는 110줄, Topic Graph
  inspector는 63줄이며 상위 `InterfaceReceiveRuntime` 공개 계약은 변경하지 않았다.
- 검증: Python compile, Topic Interface Lab targeted 10 tests, workspace install 환경 Monitor 전체
  114 tests와 diff whitespace 검사가 통과했다.
- 남은 문제: 실제 ROS Graph 수동 통합은 이번 구간에 재실행하지 않았다. 단일 Publish의 요청 검증·결과
  조립은 facade에 남아 있지만 하나의 orchestration 흐름이므로 즉시 세분화하지 않는다.
- 다음 AI: 740줄 `interface_lab/management/registry.py`를 조사하고 YAML storage/locking, interface
  parsing, import 검사 중 독립성이 높은 책임부터 분리한다.

## 2026-08-07 - Interface Registry 저장소와 package 설치 분리

- 작업: Registry YAML 기본 구조·정규화·읽기·원자적 쓰기·공유 lock을 `registry_storage.py`로 옮겼다.
  단일 `.msg/.srv/.action` 저장, 의존성 추출, CMakeLists/package.xml 갱신과 backup은
  `interface_package_installer.py`로 이동했다.
- 이유와 기준: 사용자 등록 상태의 영속화와 ROS package 소스 변경은 실패 원인과 테스트 기준이 다른
  책임이다. 등록 public API는 기존 `registry.py`에 유지하고 실제 파일 작업만 위임했다.
- 정책 보존: 기존 private helper를 사용하는 `manual_interfaces.py`를 즉시 깨지 않도록 storage와
  installer 함수를 호환 alias로 re-export했다. `registry._check_import` 및
  `default_interface_package` monkeypatch가 계속 작동하도록 installer에 callback/value를 주입했다.
- 결과: `registry.py`는 740줄에서 507줄로 감소했다. 신규 storage는 72줄, package installer는
  192줄이며 registry YAML 형식, API 응답 key, CMake/package.xml 생성 결과는 변경하지 않았다.
- 검증: Python compile, Interface Registry/Manual Interface targeted 18 tests, workspace install 환경
  Monitor 전체 114 tests와 diff whitespace 검사가 통과했다.
- 남은 문제: 실제 사용자 package에 대한 colcon build는 이번 기능 분리 구간에서 다시 수행하지 않았다.
  `registry.py`에는 build/apply summary, import refresh와 등록 orchestration이 남아 있다.
- 다음 AI: build/apply 상태 계산과 import 갱신을 별도 registry apply/status 모듈로 분리하고 기존
  `_check_import` monkeypatch 호환성을 유지한다.

## 2026-08-07 - Interface Registry apply/import 상태 분리

- 작업: build 완료 metadata 갱신, 전체 type import 재확인, 실제 Interface 파일·CMake 등록·package.xml
  의존성 기반 apply 상태 계산을 `registry_apply_status.py`로 이동했다.
- 이유와 기준: Registry CRUD와 build/import 상태 판정은 변경 계기와 I/O 대상이 다르다. 기존 public
  함수는 facade로 유지하고 lock 안에서 load → 계산 → save 순서만 조정하게 했다.
- 정책 보존: `registry_apply_summary`, `refresh_registry_imports`, `mark_registry_build_applied` 공개 경로와
  응답 key를 유지했다. `registry._check_import`, 기본 package 경로, workspace/display path를 callback과
  값으로 주입해 기존 monkeypatch와 환경 설정이 그대로 반영된다.
- 결과: `registry.py`는 507줄에서 319줄로 감소했다. 신규 apply/status 모듈은 247줄이며 missing,
  empty, partial, success 및 ready_for_build/import_pending 판정 의미를 유지했다.
- 검증: Python compile, Registry/Manual/Apply targeted 22 tests, workspace install 환경 Monitor 전체
  114 tests와 diff whitespace 검사가 통과했다. 처음 지정한 존재하지 않는 test 파일명은 실제
  `test_interface_apply.py`로 정정해 검증했다.
- 남은 문제: 실제 colcon build/apply 통합 실행은 이번 구조 이동 구간에서 재수행하지 않았다.
- 다음 AI: 610줄 `management/packages.py`에서 archive 추출 보안, ROS package 검증, registry storage,
  apply summary 책임을 조사해 독립성이 높은 부분부터 분리한다.

## 2026-08-07 - 업로드 Package archive 보안과 Registry 저장소 분리

- 작업: ZIP/폴더 입력의 크기·파일 수·상대 경로·생성물 폴더·symlink·허용 확장자 검증과 안전한 압축
  해제를 `package_archive.py`로 이동했다. `interface_packages.yaml` 읽기·정규화·원자적 저장은
  `package_registry_storage.py`로 이동하고 package 오류 타입은 공통 `errors.py`에 배치했다.
- 이유와 기준: 외부 입력 보안 검증과 영속 Registry I/O는 package identity/Interface parsing 및 apply
  상태와 독립적으로 변경·테스트되어야 한다. transport가 사용하는 기존 `packages.py` export는 유지했다.
- 정책 보존: ZIP 8MB, 파일 200개, 개별 파일 512KB 제한과 path traversal/symlink/build-install-log 차단,
  허용 파일 규칙, 기존 오류 문구 및 YAML 구조를 유지했다.
- 결과: `packages.py`는 610줄에서 487줄로 감소했다. archive 모듈은 117줄, storage는 40줄이다.
  보안 경계를 직접 검증하는 신규 테스트 6개를 추가했다.
- 검증: Python compile, Package/Archive/Apply targeted 13 tests, workspace install 환경 Monitor 전체
  120 tests가 통과했다. `git diff --check`가 찾은 파일 끝 빈 줄은 제거했다.
- 남은 문제: 실제 대형 ZIP 업로드와 colcon build/apply 통합 실행은 이번 구간에 재수행하지 않았다.
- 다음 AI: package별 import refresh/apply summary를 별도 status 모듈로 옮긴 후 package identity 검증과
  Interface 수집을 parser/inspector로 분리한다.
