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

## 2026-08-07 - 업로드 Package apply 상태와 Interface inspector 분리

- 작업: package별 build 완료 metadata, Interface import 재검사, 실제 파일/CMake 등록 기반 apply 상태를
  `package_apply_status.py`로 옮겼다. package.xml 이름과 CMake project 일치 검증, msg/srv/action 파일
  수집·파싱은 `package_inspector.py`로 이동했다.
- 이유와 기준: 업로드/교체 orchestration과 설치 후 상태 판정, package 소스 해석은 입력과 실패 원인이
  다르다. `packages.py`는 기존 public API facade와 저장/삭제 흐름 중심으로 축소했다.
- 정책 보존: 기존 `mark_packages_build_applied`, `refresh_package_imports`, `package_apply_summary` 함수와
  응답 key, import_pending/ready_for_build 판정을 유지했다. `_check_import`, parser, dependency/path helper는
  주입해 기존 환경 및 대체 가능성을 보존했다.
- 결과: `packages.py`는 487줄에서 345줄로 감소했다. 신규 apply/status 모듈은 139줄, inspector는
  80줄이며 package 이름 규칙과 parse 오류 저장 의미는 바뀌지 않았다.
- 검증: Python compile, Package/Archive/Apply targeted 13 tests, workspace install 환경 Monitor 전체
  120 tests와 diff whitespace 검사가 통과했다.
- 남은 문제: 실제 업로드 package colcon build/import 통합 실행은 이번 구조 이동에서 재수행하지 않았다.
- 다음 AI: 501줄 `manual_interfaces.py`에서 manual type/definition Registry CRUD와 generated package
  CMakeLists/package.xml 재생성 책임을 분리한다.

## 2026-08-07 - Manual Interface 검증·Registry·generated package 분리

- 작업: 직접 작성 definition과 full_type 검증을 `manual_validation.py`, manual entry 조회·upsert·정확
  일치 삭제를 `manual_registry.py`로 이동했다. generated package 폴더 준비, Interface 파일 스캔,
  의존성 수집, CMakeLists/package.xml 전체 재생성은 `generated_package.py`로 분리했다.
- 이유와 기준: 사용자 입력 문법 검증, YAML Registry CRUD, ROS package metadata 렌더링은 변경 원인과
  테스트 기준이 다르다. `manual_interfaces.py`에는 작성·수정·삭제의 순서와 공개 응답 조립을 남겼다.
- 정책 보존: 기존 공개 함수명, validation 오류 문구, `generated_interface_package_root` monkeypatch,
  `_check_import`, `_atomic_write`, dependency helper 주입 경로를 유지했다. Interface 삭제 후 metadata를
  재생성하고 정확한 source/full_type entry만 제거하는 정책도 유지했다.
- 결과: `manual_interfaces.py`는 501줄에서 329줄로 감소했다. 신규 generated package 131줄,
  validation 115줄, Registry CRUD 70줄로 분리됐다.
- 검증: Python compile, Manual/Registry/Apply targeted 22 tests, workspace install 환경 Monitor 전체
  120 tests와 diff whitespace 검사가 통과했다.
- 남은 문제: 실제 generated package colcon build/import 통합 실행은 이번 구조 이동에서 재수행하지 않았다.
- 다음 AI: 675줄 `interface_lab/apply/runtime.py`에서 colcon subprocess lifecycle, apply 상태 저장,
  import 확인과 process restart scheduling 책임을 조사해 안전한 경계부터 분리한다.

## 2026-08-07 - Interface Apply 상태 저장·workspace·install 경로 분리

- 작업: Apply 상태 YAML과 build log 원자적 저장/tail 조회를 `apply/status_storage.py`, 업로드 package
  이름 정규화·workspace 중복 package 탐색·package 범위 build/install/log 정리를
  `workspace_packages.py`로 이동했다. install site-packages 탐색/반영은 `install_paths.py`, 단일 Registry와
  package Registry 상태 병합은 `summary.py`로 분리했다. Apply 오류 타입도 `apply/errors.py`로 이동했다.
- 이유와 기준: 상태 영속화, filesystem cleanup, Python import path, 상태 집계는 colcon 실행 orchestration과
  독립된 실패 원인과 안전 기준을 가진다. runtime에는 기존 공개 함수 wrapper와 실행 순서를 남겼다.
- 정책 보존: transport가 import하는 오류와 runtime public 함수 경로, 상태 YAML key, log tail 80줄,
  package명 검증, 정확한 package 범위 cleanup, duplicate 판정, site-packages 정렬과 summary 의미를 유지했다.
- 결과: `apply/runtime.py`는 675줄에서 493줄로 감소했다. 신규 status storage 69줄, workspace package
  helper 89줄, install paths 39줄, summary 43줄로 분리됐다.
- 검증: Python compile, Apply/Manual/Package targeted 16 tests, workspace install 환경 Monitor 전체
  120 tests와 diff whitespace 검사가 통과했다.
- 남은 문제: 실제 colcon build, import 확인 후 Monitor `execv` 재시작 통합은 이번 구조 이동에서
  재수행하지 않았다. `run_interface_apply()`는 여전히 200줄 이상의 orchestration이다.
- 다음 AI: colcon command 실행과 build log 생성, preflight/duplicate/build/import 결과 상태 조립을
  별도 executor/result builder로 분리하되 `_APPLY_LOCK`과 공개 API는 runtime에 유지한다.

## 2026-08-07 - Interface Apply colcon executor와 결과 builder 분리

- 작업: colcon command 실행과 build/skip/error 로그 포맷을 `apply/build_executor.py`, running·preflight
  skip·duplicate·build 완료·OSError 상태 payload 조립을 `result_builder.py`로 이동했다.
- 이유와 기준: `run_interface_apply()`가 실행 순서 외에 subprocess 인자, 로그 포맷, 동일 상태 key를
  반복 소유했다. runtime에는 lock 획득/해제와 preflight → duplicate → cleanup → build → import 순서만
  남기고 순수 결과 조립을 분리했다.
- 정책 보존: colcon 명령, `/bin/bash -lc`, capture/check/text 옵션, 공개 상태 key와 오류 문구,
  reload/restart scheduling 조건, cleanup 상세와 기존 `subprocess.run` patch 가능성을 유지했다.
- 결과: `apply/runtime.py`는 493줄에서 371줄로 감소했다. build executor는 93줄, result builder는
  142줄이다. executor 호출 계약과 success/import_failed/duplicate 상태를 검증하는 테스트 3개를 추가했다.
- 검증: Python compile, Apply/Manual/Package targeted 19 tests, workspace install 환경 Monitor 전체
  123 tests가 통과했다. 이번 변경 범위의 diff whitespace 검사도 통과했다.
- 남은 문제: 실제 colcon build와 성공 후 Monitor `execv` 재시작은 이번 구조 이동에서 재수행하지 않았다.
  전체 `git diff --check`는 별도 변경인 `docs/alert_policy/00_total_alert.md:207`의 EOF 빈 줄을 보고했으며,
  사용자 변경 보존을 위해 수정하지 않았다.
- 다음 AI: 현재 가장 큰 737줄 `ros2_topic/runtime.py`의 endpoint discovery, subscription lifecycle,
  latest/Hz/age 상태 조립 책임을 조사한다.

## 2026-08-07 - Topic 공개 snapshot 조립 분리

- 작업: Topic Graph 원시 항목, subscription latest cache, 설정상 필수/command Topic을 공개 API 상태로
  결합하는 책임을 `ros2_topic/snapshot.py`로 이동했다. 누락된 설정 Topic 생성, monitoring role,
  primary priority, Hz monitoring 상태, latest preview, subscription error와 QoS 필드 조립을 포함한다.
- 이유와 기준: Graph 조회·subscription 생성/정리와 Frontend용 파생 필드 계산은 변경 계기가 다르다.
  runtime lock 안에서는 일관된 원시 복사본만 만들고 순수 조립 함수는 lock 밖에서 실행하도록 했다.
- 정책 보존: Topic snapshot의 기존 key, 기본 QoS `unknown/unavailable`, configured Topic 순서와 중복 방지,
  registered interface 우선순위, required stream/command 판정 의미를 유지했다.
- 결과: `ros2_topic/runtime.py`는 737줄에서 649줄로 감소했고, 신규 snapshot 모듈은 161줄이다.
  누락 Topic, latest/QoS/error, 기본 unknown QoS를 검증하는 테스트 3개를 추가했다.
- 검증: Python compile, Topic targeted 25 tests, workspace install 환경 Monitor 전체 126 tests가 통과했다.
- 남은 문제: 실제 ROS Graph 기동 통합 검수는 이번 순수 구조 이동에서 다시 수행하지 않았다.
- 다음 AI: runtime에 남은 Graph endpoint 수집과 subscription 생성·소유 endpoint 판정·지연 정리를
  subscription manager로 분리하되 기존 test monkeypatch 경로와 rclpy callback 생명주기를 보존한다.

## 2026-08-07 - Topic subscription 생명주기 분리

- 작업: subscription 생성과 type 변경 시 교체, Monitor Node 소유 endpoint 수 계산, Graph API 미지원 시
  runtime/action subscription 수 fallback, 외부 endpoint 소멸 유예 후 destroy·cache 제거를
  `ros2_topic/subscription_lifecycle.py`로 이동했다.
- 이유와 기준: Graph 항목 조립과 rclpy subscription resource 생명주기는 실패 처리와 변경 원인이 다르다.
  다만 기존 runtime 상태·callback·QoS 선택기는 이동하지 않고 명시적으로 주입해 실행 흐름을 보존했다.
- 정책 보존: 기존 private facade, `runtime.DEFAULT_SUBSCRIPTION_CLEANUP_AFTER_SEC` monkeypatch 경로,
  `topic_qos_incompatible` event code, 동일 type 재사용, destroy 실패 시 cache 유지 정책을 유지했다.
- 결과: `ros2_topic/runtime.py`는 649줄에서 574줄로 감소했다. 신규 lifecycle 모듈은 156줄이며 자체
  endpoint 식별, Graph API fallback count, disappearance grace period를 검증하는 테스트 3개를 추가했다.
- 검증: Python compile, Topic/QoS targeted 33 tests, workspace install 환경 Monitor 전체 129 tests가 통과했다.
- 남은 문제: 실제 ROS Graph 프로세스를 띄운 subscription 생성·소멸 통합 검수는 이번 구조 이동에서
  다시 수행하지 않았다.
- 다음 AI: runtime `update()`의 Graph 목록 순회와 disconnected 상태 보존, endpoint count 및 raw Topic
  item 조립을 collector로 분리하고 자동 subscription callback은 runtime에 주입한다.

## 2026-08-07 - Topic Graph collector 분리

- 작업: Topic Graph 이름/type 필터, supported/registered/자동 구독 판정 연결, publisher/subscriber 및
  Monitor/external endpoint count 조립, Graph present/disconnected 보존을 `ros2_topic/graph_collector.py`로
  이동했다.
- 이유와 기준: rclpy Graph 입력을 raw Topic item으로 바꾸는 과정은 cache lock과 callback 수신, 공개
  snapshot 파생 필드 계산과 독립적으로 테스트할 수 있다. 자동 subscription과 Monitor endpoint 계산은
  runtime method를 callback으로 주입해 기존 실행 순서를 유지했다.
- 정책 보존: include/exclude와 type 제외, raw subscriber에서 Monitor endpoint를 차감하는 방식, 외부 endpoint가
  없는 Monitor-only Topic의 disconnected 처리, 이전 `last_seen_at`/`disconnected_at` 보존 의미를 유지했다.
- 결과: `ros2_topic/runtime.py`는 574줄에서 503줄로 감소했고, 신규 collector는 97줄이다. 필터/count,
  사라진 Topic 보존, Monitor-only endpoint 판정을 검증하는 테스트 3개를 추가했다.
- 검증: Python compile, Topic collector/runtime targeted 25 tests, workspace install 환경 Monitor 전체
  132 tests가 통과했다.
- 남은 문제: 실제 ROS Graph 프로세스의 endpoint 출현/소멸 통합 검수는 이번 구조 이동에서 재실행하지 않았다.
- 다음 AI: runtime의 latest/Hz 공통 요청 검증과 응답 조립, message class import와 QoS 선택을 분리할지
  변경 원인과 테스트 경계를 확인한다.

## 2026-08-07 - Topic latest/Hz query support 분리

- 작업: ROS Message class import, sensor/default 기반 adaptive subscription QoS 선택, timestamp window 정리와
  Hz/age/stale 계산, latest/Hz 공개 응답 payload 조립을 `ros2_topic/query_support.py`로 이동했다.
- 이유와 기준: import/QoS 기본 선택과 순수 응답 계약은 runtime cache orchestration과 독립적으로 검증할 수
  있다. 반면 node 실행 여부 → Topic 존재/type 지원 → class import → subscription 보장 순서는 runtime에
  남겨 실행 의미를 바꾸지 않았다.
- 정책 보존: 기존 `_message_class`, `_qos_profile`, `_latest_response`, `_hz_response` private facade와 공개
  JSON key/default, sensor preview QoS 기본값, Graph endpoint 기반 QoS 자동 선택을 유지했다.
- 결과: `ros2_topic/runtime.py`는 503줄에서 458줄로 감소해 500줄 우선 조사 기준 아래가 됐다. 신규 query
  support는 150줄이며 import 문법, 응답 key, timestamp pruning/Hz 계산 테스트 3개를 추가했다.
- 검증: Python compile, Topic/QoS targeted 29 tests, workspace install 환경 Monitor 전체 135 tests가 통과했다.
- 남은 문제: 실제 Publisher를 띄운 latest/Hz 통합 검수는 이번 구조 이동에서 재실행하지 않았다.
- 다음 AI: Topic runtime 구간은 coordinator 수준으로 정리됐다. 다음 ROS2 우선 대상인
  `ros2_action/runtime.py`의 Graph 수집과 status/feedback subscription 책임을 조사한다.

## 2026-08-07 - Action Graph API와 endpoint count 집계 분리

- 작업: 전체 Action 이름/type 조회, ROS Node 목록 순회, Node별 Action server/client 조회와 이름별 count
  병합을 `ros2_action/graph.py`로 이동했다.
- 이유와 기준: rclpy Action Graph 조회 실패 처리와 endpoint 집계는 status/feedback subscription 및
  result runtime 상태와 독립된 읽기 책임이다. 기존 runtime private method는 facade로 유지해 테스트 대체
  지점과 호출 계약을 보존했다.
- 정책 보존: Graph/Node별 조회 실패 시 빈 결과 fallback, 동일 Action의 복수 server/client count 누적,
  runtime `_action_count_maps` monkeypatch 가능성과 public Action snapshot 구조를 유지했다.
- 결과: `ros2_action/runtime.py`는 537줄에서 470줄로 감소했다. 신규 Graph 모듈은 122줄이며 다중 Node
  집계와 Graph/Node 조회 실패 fallback 테스트 3개를 추가했다.
- 검증: Python compile, Action/QoS/Topology targeted 20 tests, workspace install 환경 Monitor 전체
  138 tests가 통과했다.
- 남은 문제: 실제 Action server/client Node를 띄운 Graph count 통합 검수는 이번 구조 이동에서
  재실행하지 않았다.
- 다음 AI: status/feedback subscription 생성과 adaptive QoS, capability 저장, 사라진 Action cleanup을
  lifecycle 모듈로 분리하되 result runtime cleanup 순서를 유지한다.

## 2026-08-07 - Action status/feedback subscription lifecycle 분리

- 작업: Action status/feedback subscription 생성, Graph endpoint 기반 adaptive QoS 선택과 불일치 error type,
  Action service/topic 기본 QoS 상태, capability snapshot, Monitor 내부 subscriber count, entry subscription
  destroy를 `ros2_action/subscription_lifecycle.py`로 이동했다.
- 이유와 기준: rclpy endpoint 생성·파괴 및 QoS 상태는 Action Graph item 조립과 result 관찰 orchestration과
  독립된 resource lifecycle이다. runtime에는 entry type 교체, status/feedback/result support 결과 저장,
  사라진 Action의 result cleanup 순서를 유지했다.
- 정책 보존: Goal/Result/Cancel은 service default/unknown, Feedback/Status는 Graph 비교, endpoint별
  `action_feedback_qos_incompatible`/`action_status_qos_incompatible`, feedback 비활성/import 실패 사유,
  기존 private facade와 snapshot key를 유지했다.
- 결과: `ros2_action/runtime.py`는 470줄에서 348줄로 감소했다. 신규 lifecycle 모듈은 200줄이며 Status QoS
  저장, Feedback disabled reason, count/capability/destroy를 검증하는 테스트 3개를 추가했다.
- 검증: Python compile, Action lifecycle/runtime/QoS targeted 22 tests, workspace install 환경 Monitor 전체
  141 tests가 통과했다.
- 남은 문제: 실제 Action server의 BEST_EFFORT feedback/status endpoint를 사용한 통합 검수는 이번 구조
  이동에서 재실행하지 않았다.
- 다음 AI: Action runtime은 coordinator 수준으로 정리됐다. 현재 가장 큰 ROS2 coordinator인 582줄
  `ros_monitor.py`의 update/snapshot/alert 조립 책임을 조사한다.

## 2026-08-07 - Monitor Alert 생성과 메모리 상태 전이 분리

- 작업: Topic·Service·Action·Node Alert builder 호출과 병합, retained 대상 code 집합, dismissed ID 정리,
  active/resolved history 전이, visible ID 계산과 공개 응답 조립을 `alert_assembler.py`로 이동했다.
- 이유와 기준: ROS Runtime snapshot 수집은 coordinator 책임이지만 수집 완료된 상태에서 Alert를 계산하고
  메모리 정책을 적용하는 과정은 독립적인 정책 계층이다. lock 소유권은 `RosMonitor`에 유지했다.
- 정책 보존: 기존 retained code 14개, history limit 50, 현재 발생 중인 dismissed Alert 숨김, 해결된 Alert
  history 복사, `success/data/history/meta/message` 응답 key와 reset 동작을 유지했다.
- 결과: `ros_monitor.py`는 582줄에서 527줄로 감소했다. 신규 assembler는 107줄이며 Runtime 경고 병합,
  dismissed 교집합 정리, 공개 응답 key를 검증하는 테스트 3개를 추가했다.
- 검증: 첫 targeted 실행은 존재하지 않는 Node Alert 파일명을 지정해 테스트 수집 전 실패했다. 실제 파일
  범위로 정정한 Alert targeted 38 tests, Python compile, workspace install 환경 Monitor 전체 144 tests가
  통과했다.
- 남은 문제: Alert 영속 MariaDB 연결은 아직 구현되지 않았으며 현재 history는 Monitor 메모리 상태다.
- 다음 AI: `ros_monitor.py`의 WebSocket 경량 snapshot payload 조립을 분리한 뒤 start/stop/spin lifecycle
  분리 필요성을 검토한다.

## 2026-08-07 - WebSocket 경량 snapshot payload 조립 분리

- 작업: Topic/Service/Action/Node snapshot과 Alert 응답을 Browser WebSocket용 `monitor_snapshot`으로
  축약하는 조립 함수를 `snapshot_summary.py`에 추가하고 `RosMonitor.websocket_snapshot()`은 원본 상태
  수집과 timestamp 전달만 담당하게 했다.
- 이유와 기준: snapshot 수집은 coordinator의 실행 순서 책임이지만 고정된 WebSocket payload와 meta 축약은
  transport 표현 책임이다. 기존 class static meta helper는 이전 테스트와 내부 호환을 위해 유지했다.
- 정책 보존: `type/timestamp/data`, `topics/services/actions/nodes/alerts` key, Topic latest preview,
  callable/실행/상태 count 계산과 Alert `data` 전달 의미를 유지했다.
- 결과: `ros_monitor.py`는 527줄에서 514줄로 감소했다. 경량 payload 전체 key와 주요 meta를 검증하는
  테스트 1개를 추가했다.
- 검증: WebSocket/runtime/topic targeted 24 tests, Python compile, workspace install 환경 Monitor 전체
  145 tests가 통과했다.
- 남은 문제: 실제 Browser WebSocket 연결·재연결 통합은 이번 순수 payload 이동에서 재실행하지 않았다.
- 다음 AI: rclpy Node/timer/thread start/stop/spin lifecycle을 분리해 `RosMonitor`를 500줄 아래 coordinator로
  정리하되 모든 Interface runtime clear 순서를 보존한다.

## 2026-08-07 - Monitor rclpy Node와 spin thread lifecycle 분리

- 작업: rclpy init, 고정 Monitor Node 생성, Graph update timer 등록, daemon spin thread 시작,
  shutdown → thread join → Node destroy와 정상 ExternalShutdown 예외 처리를 `monitor_lifecycle.py`로 이동했다.
- 이유와 기준: ROS process resource 생명주기는 Topic/Service/Action runtime 조립과 독립적인 실패·정리
  경계를 가진다. Interface continuous publish 중지와 각 runtime clear, Alert cache 초기화는 기존
  `RosMonitor.stop()`에 남겨 의미와 순서를 보존했다.
- 정책 보존: Node 이름 `ros2_dashboard_topic_monitor`, 설정 poll interval, 최초 `_update_graph()` 후 spin,
  이미 살아 있는 thread의 start 무시, join timeout 2초, shutdown 중 예외 정책을 유지했다.
- 결과: `ros_monitor.py`는 514줄에서 499줄로 감소해 500줄 우선 조사 기준 아래가 됐다. 신규 lifecycle
  모듈은 58줄이며 init/timer, daemon thread 실행, shutdown/join/destroy 테스트 3개를 추가했다.
- 검증: lifecycle/runtime/WebSocket targeted 12 tests, Python compile, workspace install 환경 Monitor 전체
  148 tests가 통과했다.
- 남은 문제: 실제 Monitor process를 장시간 기동·종료하는 통합 검수는 이번 구조 이동에서 재실행하지 않았다.
- 다음 AI: `ros_monitor.py` coordinator 구간은 정리됐다. 다음 대형 ROS2 대상인 557줄 Interface Lab
  `action_goal_runtime.py`의 Goal 실행, client/QoS 상태와 history 책임을 조사한다.

## 2026-08-07 - Interface Lab Action Goal history 이벤트·summary 분리

- 작업: 저장된 Goal history를 Feedback/Result 수신 이벤트로 펼치는 변환, 전체/Action별 reset 시각 필터,
  Action name/type별 성공·실패·취소 누적과 최근 summary 5건 계산을 `execution/action_history.py`로 이동했다.
- 이유와 기준: Goal 전송/Cancel/Client QoS는 rclpy 실행 책임이지만 저장된 dict history의 화면 이벤트 변환과
  통계 계산은 순수 데이터 모델 책임이다. `ActionGoalRuntime`은 history storage와 reset 시각을 소유한다.
- 정책 보존: Feedback 이벤트 뒤 Result 이벤트 순서, 기존 event key와 ID 형식, global/exact reset 경계,
  summary key/count/최근 5건 제한을 유지했다. 기존 테스트가 직접 import하는 `_goal_summary` alias도
  runtime에서 호환 re-export한다.
- 결과: `action_goal_runtime.py`는 557줄에서 483줄로 감소했다. 신규 history 모듈은 127줄이며 이벤트 순서,
  reset 경계, outcome count와 history 제한 테스트 3개를 추가했다.
- 검증: targeted 19 tests는 통과했다. 첫 전체 수집에서 `_goal_summary` alias 제거로 ImportError가 발생해
  alias를 복구했고, Python compile과 workspace install 환경 Monitor 전체 151 tests가 최종 통과했다.
- 남은 문제: 실제 Goal feedback/result/cancel 통합 실행은 이번 순수 history 이동에서 재실행하지 않았다.
- 다음 AI: Frontend의 490줄 `InterfaceUploadControl.jsx`와 490줄 `workspaceItems.js` 중 UI 조립 책임이 남은
  `InterfaceUploadControl.jsx`를 먼저 조사한다.

## 2026-08-07 - Frontend Interface Receive Workspace View 분리

- 작업: Interface Lab Receive Workbench와 mode별 Topic·Service·Action panel 선택을
  `features/interface-lab/InterfaceReceiveWorkspace.jsx`로 이동했다. 상위 `InterfaceUploadControl`은 각
  Controller 상태와 callback을 `topic/service/action` props 객체로 그룹화해 전달한다.
- 이유와 기준: API/상태 orchestration은 상위 Controller 조립 책임이지만 mode에 따른 View 선택과 공통
  Workbench layout은 독립 표현 책임이다. 기존 Panel 컴포넌트와 props 계약은 변경하지 않았다.
- 정책 보존: Receive panel open/expanded/mode 전환, Topic importable filter·start/stop/history reset,
  Service/Action 선택·검색·start/stop·전체/선택 reset과 실행 Panel 선택 동기화를 유지했다.
- 결과: `InterfaceUploadControl.jsx`는 490줄에서 475줄로 감소했고 신규 Workspace View는 32줄이다.
- 검증: Frontend `npm run lint`, `npm run build`가 통과했다. 273 modules가 변환됐고 초기 index bundle은
  210.21 KB(gzip 66.65 KB), InterfaceLab lazy chunk는 117.11 KB로 500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 Receive 탭을 전환하고 ROS Topic/Service/Action을 수신하는 E2E 검수는
  이번 View 이동에서 재실행하지 않았다.
- 다음 AI: 490줄 `features/interface-lab/model/workspaceItems.js`의 Topic/Service/Action별 모델 변환과
  공통 key/filter helper 경계를 조사한다.

## 2026-08-07 - Frontend Workspace Graph Service/Action 모델 분리

- 작업: Graph Service/Action과 callable 후보의 name/type exact merge, server availability 보완, 실행 history
  연결과 callable workspace item 변환을 `model/workspaceGraphItems.js`로 이동했다. 기존
  `workspaceItems.js` export는 re-export로 유지했다.
- 이유와 기준: Graph endpoint 기반 모델은 Registry/package source 모델과 입력 변경 주기가 다르다.
  `buildWorkspaceItems()`는 각 source item을 모으고 type별 merge/filter하는 coordinator로 유지했다.
- 추가 수정: `workspaceItems.js`가 사용하면서 import하지 않던 `firstType`, `matchesWorkspaceFilter` 중
  `matchesWorkspaceFilter` import를 복구했고, `firstType`는 신규 Graph 모듈에서 명시적으로 import했다.
  이는 build 시 식별되지 않을 수 있지만 실제 함수 실행 시 발생할 ReferenceError를 예방한다.
- 정책 보존: Service/Action exact name+type key, Graph 값 위에 callable metadata 덮어쓰기, history 필터,
  `callable_service`/`callable_action` item key와 기존 공개 export 경로를 유지했다.
- 결과: `workspaceItems.js`는 490줄에서 388줄로 감소했고 신규 Graph item 모듈은 120줄이다.
- 검증: Frontend `npm run lint`, `npm run build`, 최소 입력의 `buildWorkspaceItems()` 직접 ESM 실행이
  통과했다. 274 modules, 초기 bundle 210.21 KB(gzip 66.66 KB), InterfaceLab chunk 117.44 KB이며
  500 KB 경고가 없다.
- 남은 문제: 실제 Registry/package/Graph가 혼합된 복합 데이터에 대한 Frontend 단위 테스트 체계는 없다.
- 다음 AI: 432줄 `hooks/useInterfaceManagementController.js`에서 Registry/package/apply 상태와 mutation
  orchestration의 독립 경계를 조사한다.

## 2026-08-07 - Frontend Manual Interface Controller 분리

- 작업: 수동 Interface panel의 mode/kind/type/name/definition/editing 상태, 편집 시작, 기존 build type 등록,
  definition 작성·수정과 사전 문법 검증을 `hooks/useManualInterfaceController.js`로 이동했다.
- 이유와 기준: 수동 입력 form과 validation mutation은 package upload/apply/delete 및 Registry 목록 UI와
  독립된 사용자 흐름이다. 공통 busy/feedback과 load Registry/Apply callback은 명시적으로 주입했다.
- 정책 보존: `uploaded_interfaces` package 이름, 기존 success/warning/error 메시지 의미, 작성 성공 후
  Registry·Apply reload, edit 상태 초기화와 `onStateChanged`, 기존 management hook 평면 반환 key 및
  `MANUAL_INTERFACE_PACKAGE` export를 유지했다.
- 결과: `useInterfaceManagementController.js`는 432줄에서 389줄로 감소했고 신규 manual hook은 136줄이다.
- 검증: Frontend `npm run lint`, `npm run build`가 통과했다. 275 modules, 초기 bundle 210.21 KB
  (gzip 66.66 KB), InterfaceLab chunk 118.35 KB이며 500 KB 경고가 없다.
- 남은 문제: 수동 Interface API를 실제 Backend/Monitor에 요청하는 Browser E2E는 이번 hook 이동에서
  재실행하지 않았다.
- 다음 AI: 394줄 `hooks/useInterfaceReceiveController.js`에서 Topic 수신과 Service/Action history 상태의
  독립 경계를 조사한다.

## 2026-08-07 - Frontend Service/Action Receive Observer 분리

- 작업: Service와 Action 수신 관찰에서 반복되던 선택 item 조회, 검색 filter, active key, 선택 대상 history,
  start/stop, 전체/선택 reset 흐름을 범용 `hooks/useResourceReceiveObserver.js`로 이동했다.
- 이유와 기준: Service/Action의 “수신”은 새 ROS subscription을 만드는 것이 아니라 사용자 실행 history를
  선택해 관찰하는 동일한 UI 정책이다. Topic은 실제 Monitor subscription start/stop과 Graph 후보 자동 선택이
  필요하므로 기존 receive controller에 별도로 유지했다.
- 정책 보존: exact name/type reset payload, start 시 기존 history reset 후 polling reload, active selection에서만
  history 표시, 검색 대상, 기존 성공/경고/오류 메시지와 상위 hook의 평면 반환 key를 유지했다.
- 결과: `useInterfaceReceiveController.js`는 394줄에서 312줄로 감소했고 범용 observer hook은 96줄이다.
- 검증: Frontend `npm run lint`, `npm run build`가 통과했다. 276 modules, 초기 bundle 210.21 KB
  (gzip 66.65 KB), InterfaceLab chunk 117.68 KB이며 500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 Service/Action 관찰 start/stop/reset을 실행하는 E2E 검수는 이번 hook 이동에서
  재실행하지 않았다.
- 다음 AI: 378줄 Monitor `transport/routers/interface_management.py`에서 HTTP parsing/validation과
  Registry/package filesystem 작업 호출이 올바르게 분리되어 있는지 조사한다.

## 2026-08-07 - 기능 분리 리팩토링 진행률 재평가

- 현재 코드, 대형 파일 분포, 완료된 책임 분리와 검수 기록을 기준으로 전체 기능 분리 리팩토링을 약
  78% 완료로 평가했다. ROS2 Monitor 약 82%, Frontend 약 76%, 순수 FastAPI Backend 약 72% 수준이다.
- 남은 핵심은 Monitor Interface management router, config loader와 일부 runtime 경계, Frontend
  Visualization/Overview/Interface Lab 잔여 coordinator, Backend service/repository 경계 재점검 및 전체
  stack 통합 검수다. 줄 수만 줄이는 작업은 완료 기준으로 계산하지 않았다.
- 현재 미커밋 변경 파일은 23개다. 다음 작업 전에 변경 묶음을 보존하고 구간 검수를 계속한다.

## 2026-08-07 - Monitor transport request parsing 분리

- 작업: 업로드 Content-Length 선검사와 실제 async stream 누적 크기 제한, JSON decode와 object type 검증을
  `transport/request_parsing.py`로 이동했다. 단일 Interface, ZIP package, folder multipart endpoint가 동일
  helper를 사용하도록 변경했다.
- 이유와 기준: body 크기 제한과 JSON shape 검증은 Registry/Package 도메인 작업이 아니라 HTTP transport
  보안·파싱 책임이다. endpoint별 payload limit/overhead와 기존 오류 문구는 Router에서 명시적으로 전달한다.
- 정책 보존: 단일 파일 64 KiB multipart overhead, ZIP 64 KiB, folder 512 KiB, header가 없거나 잘못된 경우에도
  실제 stream 상한 적용, 기존 400/413 status와 detail, 공개 endpoint/응답 key를 유지했다.
- 결과: `interface_management.py`는 378줄에서 338줄로 감소했고 공통 parser는 50줄이다. Header/stream
  overflow, 정상 body, JSON object/비-object/decode 실패 테스트 5개를 추가했다.
- 검증: 첫 targeted 수집은 pytest 예약 fixture 이름 `request`를 parametrize 인자로 사용해 실패했다.
  `incoming_request`로 정정 후 targeted 17 tests, Python compile, workspace install 환경 Monitor 전체
  156 tests가 통과했다.
- 남은 문제: 실제 multipart HTTP upload 통합 요청은 이번 helper 이동에서 재실행하지 않았다.
- 다음 AI: Package upload/folder/list/delete endpoint를 별도 Router 모듈로 이동하고 root router include와
  공개 경로가 유지되는지 검증한다.

## 2026-08-07 - Interface Package HTTP Router 분리

- 작업: ZIP package upload, folder multipart upload, package 목록과 삭제 endpoint를
  `transport/routers/interface_packages.py`로 이동하고 기존 `interface_management.router`가 하위 Router를
  include하도록 변경했다.
- 이유와 기준: 단일/manual Interface Registry API와 완성 ROS package API는 입력 형식, 오류 타입과 저장
  대상이 다르다. transport app은 기존 root Router 하나만 등록해 외부 구성과 경로를 유지했다.
- 정책 보존: 네 공개 endpoint와 HTTP method, replace query, ZIP/folder size overhead, duplicate 409와
  validation 400, 목록 meta/count 및 응답 message/key를 유지했다.
- 결과: `interface_management.py`는 338줄에서 245줄로 감소했고 Package Router는 110줄이다. Package 경로가
  정확히 한 번 포함되고 Registry/Manual 경로가 유지되는 계약 테스트 2개를 추가했다.
- 검증: 현재 FastAPI가 include Router를 `_IncludedRouter`로 지연 보관해 최초 route 테스트 2개가 실패했다.
  실제 app의 `original_router`를 재귀 순회하도록 수정했고 WebSocket route의 `methods` 부재도 안전 처리했다.
  최종 targeted 10 tests, Python compile, workspace install 환경 Monitor 전체 158 tests가 통과했다.
- 남은 문제: 실제 HTTP multipart package 업로드 E2E는 이번 Router 이동에서 재실행하지 않았다.
- 다음 AI: 484줄 `config_loader.py`의 config 경로 해석, YAML parsing/default와 MonitorConfig 모델 경계를
  조사한다.

## 2026-08-07 - Monitor 설정 모델과 YAML 값 변환 분리

- 작업: `MonitorConfig`, Service active-check 모델, YAML scalar/list 정규화와 영역별 설정 조립을 신규
  `monitor_config.py`로 이동했다. `config_loader.py`에는 `.env`, 설정 경로, 안전한 YAML/Registry 읽기와
  최종 `BackendConfig` 조립을 남겼다.
- 이유와 기준: 불변 설정 모델/순수 값 변환은 파일시스템·환경변수 I/O와 독립적으로 테스트하고 변경할 수
  있는 책임이다. 기존 runtime과 테스트가 사용하는 `config_loader.MonitorConfig`, 기본 상수 및
  `_monitor_config` 경로는 re-export로 호환 유지했다.
- 정책 보존: 누락/잘못된 YAML의 safe default, 구 `*_names` key 호환, 명시적 빈 exclude, 등록 후 import
  가능한 Message type 병합·중복 제거, Service active-check allowlist 검증을 그대로 유지했다.
- 결과: `config_loader.py`는 484줄에서 200줄로 감소했고, 순수 설정 모델/변환 모듈은 234줄이다.
- 검증: 설정/Topic 등록 타입 targeted 22 tests, Python compile, workspace install 환경 Monitor 전체
  158 tests와 `git diff --check`가 통과했다.
- 남은 문제: 실제 `.env` 및 대체 설정 경로를 사용한 별도 process 기동 검수는 이번 순수 책임 이동에서
  재실행하지 않았다.
- 다음 AI: Frontend `InterfaceUploadControl.jsx`의 잔여 View 조립 경계를 우선 조사하고, 이후 Monitor
  `service_call_runtime.py`의 client/QoS 실행과 history 저장 책임을 재점검한다.

## 2026-08-07 - Frontend Interface Upload Controller/View 분리

- 작업: Interface Upload의 Toolbar, 수동 입력, Receive, build 실패, Registry/package와 실행 panel 표시
  순서를 `InterfaceUploadView.jsx`로 이동하고 Topic·Service·Action 실행 panel 조건부 선택을
  `InterfaceExecutionWorkspace.jsx`로 분리했다.
- 이유와 기준: 기존 `InterfaceUploadControl`은 여러 feature controller를 조정하면서 화면 계층과 panel 표시
  순서까지 소유했다. 상태·명령 조립은 Controller에, 순수 조건부 렌더링은 View에 두는 경계를 적용했다.
- 정책 보존: panel 순서, open/expanded 조건, build 실패 시 log toggle, Receive mode 연동, 실행 field 변경,
  importable filter, history reset 및 기존 하위 component props 의미를 유지했다.
- 결과: `InterfaceUploadControl.jsx`는 475줄에서 455줄로 감소했다. 신규 View 40줄과 실행 Workspace 15줄은
  하위 component 선택만 담당한다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. 278 modules가 변환됐고
  초기 bundle은 210.21 KB(gzip 66.66 KB), Interface Lab chunk는 118.25 KB로 500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 모든 panel 전환과 Interface 실행을 누르는 E2E는 이번 표현 계층 이동에서
  재실행하지 않았다. Controller의 props mapping 자체는 아직 455줄 파일에 남아 있다.
- 다음 AI: Monitor `interface_lab/execution/service_call_runtime.py`의 client/QoS 실행과 history 저장 책임을
  조사해 독립 경계를 분리한다.

## 2026-08-07 - Interface Lab Service Client/QoS와 이력 분리

- 작업: Service Call 원본 저장, Receive event 변환, 전체/Service별 reset 경계, 최근 결과와 성공/실패 누적
  summary를 `execution/service_history.py`로 이동했다. Service Client의 기본 QoS 적용, 이름/type별 재사용과
  Dashboard 생성 상태는 `execution/service_client_pool.py`로 이동했다.
- 이유와 기준: ROS Client 생명주기/QoS, 호출 실행, 저장된 결과의 read model은 변경 원인과 테스트 경계가
  서로 다르다. `ServiceCallRuntime`은 Registry/Graph 허용 검사와 executor 조정에 집중하도록 했다.
- 정책 보존: `qos_profile_services_default`, `unknown/default_profile`, timeout을 QoS 오류로 오판하지 않는
  정책, 최대 30건 최신순 history, Receive event key, reset 시각 비교, 최근 summary 5건과 기존 public/private
  `_client`, `_service_qos`, `_call_summary` 호환 경로를 유지했다.
- 결과: `service_call_runtime.py`는 437줄에서 330줄로 감소했다. 신규 Service history는 139줄, Client pool은
  62줄이다.
- 검증: runtime summary/validation/QoS targeted 19 tests, Python compile, workspace install 환경 Monitor
  전체 158 tests와 `git diff --check`가 통과했다.
- 남은 문제: 실제 ROS Service server에 대한 Call/Response 통합 실행은 이번 책임 이동에서 재실행하지 않았다.
  Jazzy Service Graph가 상대 endpoint QoS를 제공하지 않는 제한은 그대로다.
- 다음 AI: Frontend `model/workspaceItems.js`의 Registry/package 모델 경계를 먼저 조사하고, 필요 시
  `VisualizationPage.jsx`의 toolbar와 graph 상태 View 경계를 이어서 분리한다.

## 2026-08-07 - Frontend Workspace Registry/package 모델 분리

- 작업: 단일 Registry Message/Service/Action을 Workspace item으로 변환하는 로직과 업로드 package 및
  child interface 변환을 `model/workspaceSourceItems.js`로 이동했다.
- 이유와 기준: Registry/package 저장 원천 모델은 Graph Service/Action callable 모델 및 여러 source를
  병합하는 coordinator와 변경 원인이 다르다. `workspaceItems.js`에는 source 조립, type별 병합과 최종
  filter만 남겼다.
- 정책 보존: Registry/package item id와 stableKey, full type 계산, Message Graph/Receive/QoS 상태,
  Service/Action 연결과 history, package counts/schema, source/import/rebuild 상태를 유지했다. 기존
  `workspaceItems.js`의 `registryItem`, `packageItems`, `packageTypeItem` export는 re-export로 유지했다.
- 결과: `workspaceItems.js`는 388줄에서 230줄로 감소했고 신규 source model은 161줄이다.
- 검증: Frontend `npm run lint`, `npm run build`, `buildWorkspaceItems`와 기존 re-export 직접 ESM 실행,
  `git diff --check`가 통과했다. 279 modules, 초기 bundle 210.21 KB(gzip 66.66 KB), Interface Lab chunk
  118.25 KB이며 500 KB 경고가 없다.
- 남은 문제: Registry/package/Graph가 함께 존재하는 실제 복합 payload의 Browser E2E는 이번 순수 모델
  이동에서 재실행하지 않았다.
- 다음 AI: `frontend/src/pages/VisualizationPage.jsx`의 toolbar/filter control View와 graph 상태 조정 책임을
  조사해 독립 경계를 분리한다.

## 2026-08-07 - Frontend Visualization Toolbar와 Node 선택 View 분리

- 작업: 시각화 모드 탭, 검색, Topic/Service/Action/숨김 filter, fit/reset/refresh 동작 UI를
  `components/visualization/VisualizationToolbar.jsx`로 이동했다. Node mode의 loading/error 안내와 Node
  선택 목록은 `VisualizationNodePicker.jsx`로 이동했다.
- 이유와 기준: Graph hook 상태와 모드 전환 규칙은 Page 조정 책임이지만, control 표시와 Node 목록 렌더링은
  입력값/callback만 필요한 독립 View다. canvas와 선택 상세는 Page에 유지해 한 구간의 변경 범위를 제한했다.
- 정책 보존: 주요/실행/전체 Node 전환, 검색 placeholder, 주요 항목 및 resource filter, 숨김 포함, 화면 맞춤,
  배치 초기화, 전체 Graph, 새로고침, Node 상태/namespace/연결 수와 빈 목록 문구를 유지했다.
- 결과: `VisualizationPage.jsx`는 385줄에서 257줄로 감소했다. 신규 Toolbar는 74줄, Node picker는 52줄이다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. 281 modules, 초기 bundle
  210.21 KB(gzip 66.65 KB), Visualization chunk 208.20 KB이며 500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 모드/filter/fit/reset과 Node 선택을 클릭하는 E2E는 이번 View 이동에서
  재실행하지 않았다.
- 다음 AI: `frontend/src/pages/OverviewPage.jsx`의 metric summary, Alert preview와 system section 경계를
  조사해 독립 View로 분리한다.

## 2026-08-07 - Frontend Overview Preview와 상태 차트 분리

- 작업: Alert와 Node/Topic/Service/Action 미리보기 카드 영역을 `features/overview/OverviewPreviewGrid.jsx`,
  상태 분포 column/table, legend와 percent/count 전환을 `OverviewColumnChart.jsx`로 이동했다.
- 이유와 기준: resource summary 계산과 Alert source별 이동은 Page 정책이지만, 이미 계산된 summary의 카드와
  차트 표시는 독립 View다. 기존 `overviewSummary.js`의 계산 helper를 재사용했다.
- 정책 보존: Alert 최대/접기 설정과 클릭, 각 resource 상세 이동, 카드 metric/상태, chart column 클릭,
  percent/count 표, 정상/주의/오류 색상과 비활성 안내 문구를 유지했다.
- 결과: `OverviewPage.jsx`는 383줄에서 181줄로 감소했다. 신규 Preview grid와 Column chart는 각각 90줄이다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. 283 modules, 초기 bundle
  210.21 KB(gzip 66.66 KB), Overview chunk 9.38 KB이며 500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 Alert/resource 카드 및 chart column 이동과 표시 모드 전환 E2E는 이번 View
  이동에서 재실행하지 않았다.
- 다음 AI: `frontend/src/components/InterfaceUploadControl.jsx`의 controller 결과를 View props로 변환하는
  대형 mapping 책임을 조사해 hook 또는 adapter 경계를 분리한다.

## 2026-08-07 - Interface Upload 실행/Receive View props adapter 분리

- 작업: Topic·Service·Action 실행 Controller와 Receive Controller의 내부 상태/명령을 각 panel props로
  변환하는 로직을 `model/interfaceUploadViewProps.js`의 순수 adapter 네 개로 이동했다.
- 이유와 기준: API 실행 상태 이름과 표현 component 계약은 변경 주기가 다르며, Control 안의 대형 inline
  mapping은 wiring 누락을 찾기 어렵다. hook 호출/수명주기는 Control에 유지하고 변환만 분리했다.
- 정책 보존: 실행 field update, importable filter, publish/continuous/call/goal 명령, timeout, 결과/history,
  Receive mode별 start/stop/reset/search/select와 expanded/open 조건을 유지했다.
- 결과: `InterfaceUploadControl.jsx`는 455줄에서 372줄로 감소했고 신규 adapter는 142줄이다.
- 검증: Frontend `npm run lint`, `npm run build`, adapter callback 생성 직접 ESM 실행과 `git diff --check`가
  통과했다. 284 modules, 초기 bundle 210.21 KB(gzip 66.66 KB), Interface Lab chunk 123.06 KB이며
  500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 각 실행/Receive panel을 조작하는 E2E는 이번 wiring 이동에서 재실행하지
  않았다. 관리 panel props와 네 실행 hook의 상호 연결은 Control에 남아 있다.
- Git 상태: 작업 중 사용자 측 새 기준선 `1434411`이 확인됐고, 이번 adapter 변경과 이 기록만 미커밋이다.
- 다음 AI: `frontend/src/components/ActionDetailPanel.jsx`와 `ActionTable.jsx`의 QoS/상태/연결/실행 표시 경계를
  조사해 독립 subview를 분리한다.

## 2026-08-07 - Frontend Action Feedback/Result 표시 정책 분리

- 작업: Action Feedback/Result preview 선택, 배지 value/label과 table 정렬 우선순위 계산을
  `features/actions/actionPresentation.js`로 이동했다.
- 이유와 기준: 실행 결과 상태를 `수신됨`, `대기 중`, `Goal 미관찰`, `Result Timeout` 등으로 판정하는 로직은
  table DOM과 독립적인 표시 정책이다. Table은 정렬·선택·별표·preview modal 렌더링에 집중시켰다.
- 정책 보존: last goal summary 우선, runtime fallback, validation/goal 전송/accept/result timeout,
  abort/cancel/error/unavailable, Feedback 지원 여부와 기존 sortValue 우선순위를 유지했다.
- 결과: `ActionTable.jsx`는 341줄에서 227줄로 감소했고 신규 presentation model은 105줄이다.
- 검증: Frontend `npm run lint`, `npm run build`, 대표 Feedback/Result 상태 분기 직접 ESM 실행과
  `git diff --check`가 통과했다. 285 modules, 초기 bundle 210.21 KB(gzip 66.65 KB), Actions chunk
  22.07 KB이며 500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 Action 정렬, JSON preview modal과 배지 표시를 확인하는 E2E는 이번 순수 정책
  이동에서 재실행하지 않았다.
- 다음 AI: `frontend/src/components/ActionDetailPanel.jsx`의 기본/통신/실행 상태, QoS와 JSON preview section을
  독립 subview로 분리한다.

## 2026-08-07 - Frontend Action 상세 section과 상태 표시 정책 분리

- 작업: Action 연결 Node/endpoint, 실행 측정, capability와 6개 JSON preview 영역을
  `features/actions/ActionDetailSections.jsx`로 이동했다. Goal/Result 상태 라벨과 tone 판정은 기존
  `actionPresentation.js`에 통합했다.
- 이유와 기준: 안내/기본 상태/QoS를 조립하는 Panel과 연결·실행·지원 여부·원시 데이터 section은 각각
  독립적인 표현 책임이다. 상태 코드 해석은 Table과 동일하게 presentation model에 두었다.
- 정책 보존: Dashboard 제외 Node 수와 원본 endpoint 수, 내부 실행 Node 보완, Goal 상태/실행 가능/서버 전송,
  validation 안내, 시간·결과·성공/실패, status/feedback/result 지원 여부, 모든 JSON preview와 Action 내부
  Goal/Result/Cancel/Feedback/Status QoS 표시를 유지했다.
- 결과: `ActionDetailPanel.jsx`는 372줄에서 111줄로 감소했다. 신규 detail sections는 122줄이고 공통 Action
  presentation model은 150줄이 됐다.
- 검증: Frontend `npm run lint`, `npm run build`, 대표 status label/tone 직접 ESM 실행과 `git diff --check`가
  통과했다. 286 modules, 초기 bundle 210.21 KB(gzip 66.66 KB), Actions chunk 22.44 KB이며 500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 상세 section expand, 연결 Node, QoS와 JSON 표시를 확인하는 E2E는 이번 View
  이동에서 재실행하지 않았다.
- 다음 AI: `frontend/src/components/InterfaceUploadControl.jsx`의 관리 panel props 조립과 Topic/Service/Action/
  Receive hook orchestration 경계를 조사해 다음 독립 hook 또는 adapter를 분리한다.

## 2026-08-07 - Interface Upload 관리 View props adapter 분리

- 작업: Toolbar, 수동 Interface 입력, Build 실패, Registry, 업로드 Package의 상태와 callback을 View 계약으로
  바꾸는 로직을 `model/interfaceUploadViewProps.js`의 `managementViewProps()`로 이동했다.
- 이유와 기준: 관리 Controller 내부 이름과 표현 component의 props 구조는 독립적으로 변경될 수 있다. 기존
  실행/Receive adapter와 동일한 경계에 순수 변환을 모으고 hook 호출과 삭제 후 후보 갱신 순서는 Control에
  유지했다.
- 정책 보존: Apply/CMake 재생성과 build log, 수동 작성·검증·편집 취소, Registry/package 삭제, expanded
  전환, 파일·폴더 upload와 replace, WebSocket/reload/feedback 표시 조건을 유지했다.
- 결과: `InterfaceUploadControl.jsx`는 372줄에서 324줄로 감소했고 adapter 파일은 142줄에서 215줄이 됐다.
- 검증: Frontend `npm run lint`, `npm run build`, 관리 adapter callback/failed 표시 직접 ESM 실행과
  `git diff --check`가 통과했다. 286 modules, 초기 bundle 210.21 KB(gzip 66.66 KB), Interface Lab chunk
  125.03 KB이며 500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 upload/apply/manual/삭제 UI를 조작하는 E2E는 이번 wiring 이동에서
  재실행하지 않았다. 여러 실행/수신 hook의 호출과 상호 연결 wiring은 Control에 남아 있다.
- 다음 AI: `InterfaceUploadControl.jsx`의 Topic·Service·Action·Receive hook orchestration을 하나의 독립
  composition hook으로 옮길 수 있는지 조사하되 controller 간 selection 동기화와 lifecycle 순서를 보존한다.

## 2026-08-07 - Interface Upload 실행 composition hook 분리

- 작업: Topic·Service·Action 실행 controller 생성과 Receive controller 연결을 신규
  `hooks/useInterfaceExecutionSuite.js`로 이동했다.
- 이유와 기준: 개별 controller 구현은 이미 기능별로 분리되어 있지만 Service/Action 선택을 Receive 선택과
  동기화하고 Receive refresh가 세 실행 후보 목록을 교체하는 의존 관계는 Control의 화면 조립 책임이 아니다.
- 주요 변경: Suite가 공용 Topic 목록과 Receive용 Service/Action 선택 key를 소유하고 네 controller를 올바른
  순서로 조립한다. Control에는 management, panel coordinator, lifecycle과 최종 View adapter 조립을 남겼다.
- 정책 보존: Topic 자동 후보, 사용자 입력 선택, Service/Action 선택 동기화, Receive 목록 refresh,
  실행 후보 replace, busy/feedback 및 `onStateChanged` 전달 경로를 유지했다.
- 결과: `InterfaceUploadControl.jsx`는 324줄에서 251줄로 감소했고 composition hook은 52줄이다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite가 287 modules를
  변환했고 초기 bundle은 210.21 KB(gzip 66.66 KB), Interface Lab chunk는 125.39 KB로 500 KB 경고가 없다.
- 남은 문제: 실제 Browser에서 네 controller 간 선택 및 refresh 연동 E2E는 이번 구조 이동에서 재실행하지
  않았다. React hook 단위 테스트 기반은 현재 별도로 구성돼 있지 않다.
- 다음 AI: Frontend의 이번 Interface Upload coordinator 분리는 여기서 마무리하고, Monitor의 남은
  300~500줄 runtime을 줄 수가 아닌 책임 기준으로 조사해 다음 분리 대상을 정한다.

## 2026-08-07 - Interface Action Client pool과 QoS 상태 분리

- 작업: Interface Lab ActionClient의 생성·재사용과 Goal/Result/Cancel/Feedback/Status별 QoS 선택 및 상태
  보존을 신규 `execution/action_client_pool.py`의 `ActionClientPool`로 이동했다.
- 이유와 기준: `action_goal_runtime.py`는 Goal 허용·실행·취소와 history 흐름을 조정해야 하지만 client cache와
  ROS entity 생성 QoS는 별도 생명주기를 가진다. 이미 분리된 `ServiceClientPool`과 대칭 구조를 적용했다.
- 주요 변경: 이름/type tuple로 client를 재사용하고, Action service 3종은 기본 Service QoS, Feedback/Status는
  Graph endpoint 기반 adaptive Topic QoS를 선택하며 생성 당시 상태를 pool에 보존한다. Runtime의 `_client`,
  `_action_qos_profiles`, `_action_qos`는 기존 테스트/내부 호출 호환 facade로 유지했다.
- 결과: `action_goal_runtime.py`는 483줄에서 417줄로 감소했고 신규 pool은 110줄이다.
- 검증: Python compileall, Monitor 직접 `python3 -m pytest -q ros2_ws/src/ros2_dashboard_monitor/test`,
  `git diff --check`가 통과했으며 158 tests passed다.
- 트러블슈팅: 최초 전체 테스트에서 Runtime 생성 후 `ActionClient` 심볼을 교체하는 기존 cache key 테스트 1개가
  실패했다. client factory를 실제 생성 시점에 모듈 심볼을 조회하는 lambda로 바꿔 테스트 seam과 기존 동적
  대체 가능성을 복구했고 재실행에서 전부 통과했다.
- 남은 문제: 실제 ROS Action server를 띄운 통합 Goal/Feedback/Result/Cancel 검수는 이번 구조 이동에서
  재실행하지 않았다. 공개 payload와 QoS 판정 로직 자체는 기존 전체 단위 테스트로 확인했다.
- 다음 AI: `action_goal_runtime.py`에 남은 등록 Action 후보 조립과 Graph 허용 검사/상태 조립을 별도 discovery
  service로 이동할 가치가 있는지 조사한다. `ros_monitor.py`는 이미 다수 helper에 위임된 coordinator이므로
  줄 수만으로 우선 분리하지 않는다.

## 2026-08-07 - Interface Action 등록 후보와 Graph 상태 조립 분리

- 작업: Registry/package Action 정규화, 등록 type과 Graph type exact match, callable 응답 조립과 Goal 실행
  허용 판정을 `execution/action_discovery.py`로 이동했다.
- 이유와 기준: Registry 형식 해석과 ROS2 Graph 사실 결합은 Goal 전송·취소 생명주기와 독립적인 discovery
  책임이다. 기존 Graph endpoint 조회 helper와 같은 모듈에 배치해 Action 후보 생성 흐름을 한곳에 모았다.
- 주요 변경: import 가능한데 parsed schema가 없는 Action의 generated class schema 보완, package Action 병합,
  동일 이름의 다른 type 구분, server/client count와 QoS 결합, import/server 부재 reason을 순수 함수로 분리했다.
  Runtime의 `_registered_actions`, `_allowed_action`, `_action_state`는 기존 내부 호환 facade로 유지했다.
- 결과: `action_goal_runtime.py`는 417줄에서 333줄로 감소하고 `action_discovery.py`는 68줄에서 197줄이 됐다.
- 검증: 신규 discovery 계약 테스트 3개를 추가했다. Python compileall, Monitor 전체 직접 pytest,
  `git diff --check`가 통과했으며 `161 passed`다.
- 남은 문제: 실제 ROS Graph와 업로드 Action package를 함께 사용한 Browser E2E는 이번 순수 조립 이동에서
  재실행하지 않았다. 공개 응답 key와 exact type 정책은 신규/기존 테스트로 확인했다.
- 다음 AI: Action Goal runtime은 실행 coordinator로 축소됐으므로 추가 분리를 잠시 멈추고,
  `ros_monitor.py`, Topic Alert 또는 다른 300줄 이상 Monitor 파일의 혼합 책임을 비교한다.

## 2026-08-07 - Topic MonitorStatus 전용 Alert 변환 분리

- 작업: 프로젝트 전용 `ros2_dashboard_interfaces/msg/MonitorStatus` 메시지의 level 해석, Alert identity와
  payload 변환을 신규 `ros2_topic/monitor_status_alerts.py`로 이동했다.
- 이유와 기준: Publisher/Subscription 존재와 missing/stale는 범용 ROS2 Topic 사실 정책이지만,
  MonitorStatus의 device/status/values와 severity 해석은 프로젝트 Interface 스키마에 결합된 별도 책임이다.
- 주요 변경: warning/error/critical만 Alert로 만들고 info/다른 Topic type/미수신 preview는 제외하는 기존
  정책, stable ID 구성과 age/value/node 필드를 유지했다. `alerts.py`의 `_monitor_status_alert` 이름은 import
  alias로 유지해 내부 호환성을 보존했다.
- 결과: `ros2_topic/alerts.py`는 385줄에서 304줄로 감소했고 신규 전용 변환 모듈은 94줄이다.
- 검증: 정상 severity 및 다른 type 제외, warning identity/value/age 계약 테스트 2개를 추가했다. Python
  compileall, Monitor 전체 직접 pytest, `git diff --check`가 통과했으며 `163 passed`다.
- 남은 문제: 실제 MonitorStatus publisher를 띄운 실시간 Browser Alert E2E는 이번 순수 변환 이동에서
  재실행하지 않았다.
- 다음 AI: 381줄 `snapshot_assembler.py`의 Service/Action/Node 조립을 resource별 모듈로 분리할지
  검토한다. `ros_monitor.py`는 계속 coordinator로 유지한다.
