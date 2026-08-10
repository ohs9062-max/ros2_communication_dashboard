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

## 2026-08-07 - Service·Action·Node Snapshot assembler 분리

- 작업: 하나의 `snapshot_assembler.py`에 있던 Service, Action, Node 공개 상태 조립을 각각
  `service_snapshot.py`, `action_snapshot.py`, `node_snapshot.py`로 이동했다.
- 이유와 기준: 세 리소스는 Graph role, Interface Lab 실행 이력, primary 판정과 공개 필드가 서로 다르며
  독립적으로 변경된다. Topic 보강까지 포함한 단일 파일은 변경 영향 범위를 불필요하게 넓혔다.
- 주요 변경: Service의 Call summary/callable/hidden 처리, Action의 Goal summary/관찰 activity/통신 상태,
  Node의 내부 Node 및 시스템 주요 리소스 판정을 리소스별로 분리했다. `ros_monitor.py`는 새 모듈을 직접
  import하며, 기존 `snapshot_assembler` import 사용자를 위해 세 함수를 재노출한다.
- 정책 보존: Node/endpoint count, 내부 Node 제외, Interface client 생성 여부, execution node, primary
  priority/source, 사용자 priority, hidden count와 기존 공개 JSON key를 유지했다.
- 결과: `snapshot_assembler.py`는 381줄에서 Topic 전용 85줄로 감소했다. 신규 Service/Action/Node assembler는
  각각 112/107/43줄이다.
- 검증: Python compileall, Monitor 전체 직접 pytest, `git diff --check`를 두 차례 실행했고 모두 통과했으며
  `163 passed`다.
- 남은 문제: 실제 ROS Graph와 Browser 상세 화면을 연결한 E2E는 이번 구조 이동에서 재실행하지 않았다.
  기존 snapshot/topology/runtime 테스트로 공개 상태 계약을 검증했다.
- 다음 AI: `ros_monitor.py`는 coordinator로 유지하되, 남은 499줄 중 Interface Lab 공개 facade 묶음처럼
  독립 위임 계층으로 옮길 가치가 있는 부분이 있는지 조사한다.

## 2026-08-07 - 기능 분리 리팩토링 진행 상태 재점검

- 현재 코드와 파일 크기, 누적 검증 기록을 다시 대조했다. 구조 분리와 Backend 계층화는 사실상 완료,
  Frontend 주요 비대 화면과 Interface Lab 분리는 대부분 완료, ROS2 Monitor의 대형 Runtime 세부 분리는
  진행 중으로 판단했다.
- 기능 분리 범위 기준 추정 진행률은 Backend 90~95%, Frontend 80~85%, ROS2 Monitor 75~80%, 전체 약
  82%다. WSS/MariaDB/Camera/TurtleBot preset 같은 미구현 신규 기능은 이 리팩토링 진행률에 포함하지 않았다.
- 마지막 완료 지점은 Service/Action/Node snapshot assembler 분리이며 현재 해당 변경은 미커밋 상태다.
  다음 작업 지점은 `ros_monitor.py`의 Interface Lab facade 또는 다른 대형 Runtime의 혼합 책임 조사다.

## 2026-08-07 - RosMonitor Interface Lab 공개 facade 분리

- 작업: `RosMonitor`에 있던 Topic Publish/Receive, Service Call, Action Goal/Cancel 및 세 리소스 실행 이력의
  단순 위임 메서드를 신규 `interface_lab/facade.py`의 `InterfaceLabFacade`로 이동했다.
- 이유와 기준: 이 메서드들은 Monitor Graph 수집·snapshot·lifecycle 상태를 계산하지 않고 각 Interface Lab
  runtime의 API를 외부 Router에 재노출하는 동일 책임이다. 상속형 facade로 기존 `ros_monitor.method()`
  호출 계약을 유지했다.
- 주요 변경: `RosMonitor`가 facade를 상속하도록 하고 runtime 생성/정리는 그대로 보유했다. Service/Action/
  Topic 요청의 keyword, timeout, history filter와 continuous publish 인자를 변경하지 않았다.
- 결과: `ros_monitor.py`는 497줄에서 293줄로 감소했고 facade는 161줄이다. Monitor는 lifecycle, resource
  snapshot, Alert 상태 전이, topology/priority 조정 중심 coordinator가 됐다.
- 검증: Service Call, Action Goal/Cancel, Topic Receive/Continuous Publish/History 인자 전달 계약 테스트
  3개를 추가했다. Python compileall, Monitor 전체 직접 pytest, `git diff --check`가 통과했고 `166 passed`다.
- 남은 문제: 실제 transport Router를 통한 ROS 통합 실행은 이번 단순 위임 이동에서 재실행하지 않았다.
  Router가 사용하는 기존 메서드 이름은 상속으로 그대로 유지된다.
- 다음 AI: `ros_monitor.py` 추가 분리는 중단하고 458줄 `ros2_topic/runtime.py` 또는 다른 대형 Runtime의
  남은 facade/상태 책임을 비교한다.

## 2026-08-10 - 리팩토링 진행 상태 확인

- 현재 상태 문서, 누적 작업 로그, Git 상태와 주요 파일 크기를 대조했다.
- 구조/기능 분리 리팩토링은 마지막 평가 기준 전체 약 82%이며, Backend 90~95%, Frontend 80~85%,
  ROS2 Monitor 75~80% 수준이다. 현재 작업 트리는 clean하다.
- 마지막 완료 지점은 `RosMonitor`의 Interface Lab 공개 위임을 `InterfaceLabFacade`로 분리한 작업이다.
  다음 조사 대상은 `ros2_topic/runtime.py`의 남은 혼합 책임이다.
- WSS, MariaDB Alert 이력, Camera 시각화, TurtleBot Gazebo 명령 preset은 후속 신규 기능이며 위 리팩토링
  진행률에는 포함하지 않는다.

## 2026-08-10 - Topic latest/Hz 조회 facade 분리

- 작업: `ros2_topic/runtime.py`의 latest message와 Hz 공개 요청 검증, subscription 보장, cache 응답 조립을
  신규 `ros2_topic/query_facade.py`의 `TopicQueryFacade`로 이동했다.
- 이유와 기준: Graph 수집과 subscription 생명주기는 이미 별도 모듈로 분리돼 있으며, HTTP Router가 사용하는
  latest/Hz 조회 흐름은 동일한 실행 상태·Topic type·import 검증 경계를 가진 독립 공개 API 책임이다.
- 정책 보존: 기존 `latest_message`, `topic_hz`와 `_latest_response`, `_hz_response`, `_topic_hz_snapshot`
  호출 계약, 공개 JSON key, 오류 문구, adaptive subscription 생성과 Hz/stale 계산 경로를 유지했다.
- 결과: `TopicRuntime`이 facade를 상속하도록 구성했고 `runtime.py`는 458줄에서 302줄로 감소했다. 신규
  facade는 169줄이며 Runtime에는 Graph/cache/subscription coordinator 책임이 남았다.
- 검증: Python compileall, ROS2 및 workspace setup 적용 후 Monitor 전체 pytest, `git diff --check`가
  통과했으며 `166 passed`다. 최초 pytest는 workspace setup을 source하지 않아 import collection에 실패했고,
  올바른 프로젝트 실행 환경에서 재검증했다.
- 남은 문제: 실제 ROS Topic publisher와 REST `/latest`, `/hz`를 연결한 통합 E2E는 이번 구조 이동에서
  재실행하지 않았다. 다음 분리는 `TopicRuntime`의 Graph 갱신 facade와 subscription callback/state 중 실제
  독립 책임이 남았는지 조사하되, 이미 분리된 helper를 단순히 재포장하지 않는다.

## 2026-08-10 - Topic subscription facade 분리

- 작업: `TopicRuntime`의 자동 구독 정책 적용, subscription 생성 연결, 보유 여부와 Monitor subscriber count,
  latest callback 상태 갱신, Message class와 adaptive QoS 선택을 신규
  `ros2_topic/subscription_facade.py`의 `TopicSubscriptionFacade`로 이동했다.
- 이유와 기준: Graph/cache 조정과 ROS subscription 생성·수신 callback 생명주기는 변경 이유가 다르며,
  후자는 기존 `subscription_lifecycle.py`와 `subscriptions.py` helper를 연결하는 하나의 독립 책임이다.
- 정책 보존: 기존 private 메서드 이름, registered interface 자동 구독, 오류 cache/log, Action 내부 subscriber
  합산, message preview와 Hz timestamp 갱신, endpoint 기반 adaptive QoS 선택을 유지했다. 기존 테스트가
  `runtime.DEFAULT_SUBSCRIPTION_CLEANUP_AFTER_SEC`를 교체하므로 사라진 endpoint cleanup facade는 runtime에
  남겨 테스트 seam과 유예 정책을 보존했다.
- 결과: `TopicRuntime`은 query facade와 subscription facade를 상속하고 Graph/cache coordinator 중심의
  180줄로 감소했다. 신규 subscription facade는 140줄이다.
- 검증: Python compileall, ROS2 및 workspace setup 적용 Monitor 전체 pytest, `git diff --check`가 통과했고
  `166 passed`다.
- 남은 문제: 실제 ROS publisher의 QoS 변경과 subscription 재생성 통합 E2E는 이번 구조 이동에서
  재실행하지 않았다. `TopicRuntime`은 현재 의미 있는 coordinator 크기이므로 줄 수만을 위한 추가 분리는
  중단하고 다른 대형 Monitor runtime의 혼합 책임을 비교하는 것이 적절하다.

## 2026-08-10 - Action subscription facade 분리

- 작업: `ActionRuntime`의 status/feedback subscription entry 생성·교체, result 지원 상태 결합, callback
  runtime 갱신, Monitor subscriber count와 사라진 Action cleanup을 신규
  `ros2_action/subscription_facade.py`의 `ActionSubscriptionFacade`로 이동했다.
- 이유와 기준: Action Graph 목록과 disconnected 상태를 조립하는 책임과 ROS 관찰 endpoint 생명주기 및
  callback 상태 전이는 독립적으로 변경된다. 기존 `subscription_lifecycle.py`, `subscriptions.py`,
  `ActionResultRuntime`을 연결하는 조정 경계를 facade로 명시했다.
- 정책 보존: 기존 `monitor_subscriber_count` 공개 메서드와 모든 private seam, status/feedback 자동 감시 설정,
  type 변경 시 subscription 교체, 5종 QoS capability, result support/policy/reason, stale Action cleanup 순서를
  유지했다.
- 결과: `ActionRuntime`은 facade를 상속하고 Graph/cache/disconnected 상태 조립 중심의 184줄로 감소했다.
  신규 Action subscription facade는 178줄이다.
- 검증: Python compileall, ROS2 및 workspace setup 적용 Monitor 전체 pytest, `git diff --check`가 통과했고
  `166 passed`다.
- 남은 문제: 실제 Action server로 status/feedback/result와 type 변경 cleanup을 확인하는 통합 E2E는 이번
  구조 이동에서 재실행하지 않았다. Action runtime도 의미 있는 coordinator 크기가 되었으므로 다음에는
  Interface Apply 또는 package management의 남은 혼합 책임을 비교한다.

## 2026-08-10 - 업로드 Interface package installer 분리

- 작업: 업로드 package root의 identity와 interface 검사, 기존 package 교체를 위한 staging·backup
  트랜잭션, 저장 후 interface 절대/표시 경로 재매핑과 Registry entry 생성을 신규
  `management/package_installer.py`의 `install_package_root`로 이동했다.
- 이유와 기준: `packages.py`는 ZIP/폴더 입력, Registry CRUD·apply/import 상태와 실행 후보 변환을 함께
  담당했고, 실제 filesystem 설치 트랜잭션은 실패 복구와 보안 검증 기준이 독립적인 변경 단위다.
- 정책 보존: 공개 `upload_interface_package`/folder API, replace 조건, package identity와 최소 interface 검사,
  symlink 없는 copy, staging/backup 복구, dependency와 pending build 상태, Registry 응답 key를 유지했다.
- 결과: `packages.py`는 345줄에서 282줄로 감소했고 신규 installer는 122줄이다. 공개 upload 함수와 경로
  설정 seam은 기존 모듈에 남아 transport 및 테스트 호출 경로를 유지한다.
- 검증: Python compileall, ROS2 및 workspace setup 적용 Monitor 전체 pytest, `git diff --check`가 통과했고
  `166 passed`다.
- 남은 문제: 실제 대형 사용자 package와 filesystem rename 실패를 강제로 발생시키는 통합 검증은 이번
  구조 이동에서 재실행하지 않았다. 다음 후보는 `packages.py`의 Registry 상태와 등록 interface projection
  책임 또는 Interface Apply runtime의 상태/import-check 경계다.

## 2026-08-10 - 업로드 package 실행 후보 projection 분리

- 작업: package Registry의 msg/srv/action 항목을 Interface Lab 실행 후보 payload로 변환하는 로직을 신규
  `management/package_interfaces.py`의 순수 함수 `registered_messages`, `registered_services`,
  `registered_actions`로 이동했다.
- 이유와 기준: Registry 저장·build/import 상태 갱신과 Topic Publish/Service Call/Action Goal이 소비하는
  schema projection은 변경 이유가 다르며, 파일 및 ROS runtime 의존성 없이 독립 검증할 수 있다.
- 정책 보존: 기존 `registered_package_*` 공개 함수와 import 경로, source/package/file/type 이름,
  Message schema, Service request/response, Action goal/result/feedback, interface 우선 import 오류 fallback과
  `import_available is True` 판정을 유지했다.
- 결과: `packages.py`는 직전 282줄에서 231줄로 감소했고 projection 모듈은 82줄이다. 기존 공개 함수는
  Registry snapshot 조회 후 순수 변환을 호출한다.
- 검증: 세 interface kind의 schema와 import 상태 계약 테스트 3개를 추가했다. Python compileall, ROS2 및
  workspace setup 적용 Monitor 전체 pytest, `git diff --check`가 통과했고 `169 passed`다.
- 남은 문제: 실제 업로드 package를 build/import한 뒤 세 실행 화면에 표시하는 Browser E2E는 이번 순수
  변환 이동에서 재실행하지 않았다. package management는 적절한 크기로 축소됐으며 다음 후보는 Interface
  Apply runtime의 상태/import-check 경계다.

## 2026-08-10 - Interface Apply 영속 상태 분리

- 작업: Apply 상태/log 경로 결정, idle 기본 상태, 저장 상태와 현재 lock/log tail 결합, Interface 변경 후
  rebuild pending 전이와 import-check 결과 병합을 신규 `interface_lab/apply/state.py`로 이동했다.
- 이유와 기준: colcon preflight/build/import 실행 순서와 YAML 상태 모델·전이는 변경 이유가 다르며, 상태
  경계는 기존 `status_storage.py` 위에서 독립적으로 관리할 수 있다.
- 정책 보존: `runtime.py`의 `apply_status`, `mark_interface_change_pending`, `record_import_check_status`,
  default path와 내부 `_read_status`/`_empty_status` import 경로를 유지했다. 환경변수 상대/절대 경로,
  build 성공 후 import 실패 상태와 기존 공개 key 및 한글 오류 문구도 유지했다.
- 결과: `apply/runtime.py`는 371줄에서 280줄로 감소했고 신규 state 모듈은 125줄이다. Runtime은 lock,
  preflight, 중복 검사, package 범위 cleanup, colcon build와 import 확인 순서에 집중한다.
- 검증: Python compileall과 Monitor 전체 pytest `169 passed`를 확인했다. whitespace 수정 후 Apply 관련
  테스트 7개와 `git diff --check`를 재실행해 통과했다.
- 남은 문제: 실제 colcon apply 후 동일 PID Monitor 재실행 E2E는 이번 상태 이동에서 재실행하지 않았다.
  다음 후보는 Apply import-check/summary orchestration 또는 다른 300줄 이상 runtime의 혼합 책임이다.

## 2026-08-10 - Interface Apply import-check 조정 분리

- 작업: 업로드 package 이름 조회, 단일/package build 완료 표시, install Python 경로 반영, Registry import
  재검사와 apply summary 병합을 신규 `interface_lab/apply/import_check.py`로 이동했다.
- 이유와 기준: colcon 실행과 preflight/error 처리 책임에서 build 이후 Python import 환경 및 두 Registry 상태를
  결합하는 책임을 분리하면 Apply runtime의 실행 순서와 import 정책을 독립적으로 변경·검증할 수 있다.
- 정책 보존: `runtime.py`의 `uploaded_interface_package_names`, `run_import_check_and_update_registry`,
  `combined_apply_summary`, `refresh_install_python_paths`, `find_install_site_packages` import 경로와 응답 key를
  유지했다. build 성공 시 단일/package 완료 표시 후 sys.path 반영과 import 확인을 수행하는 순서도 유지했다.
- 결과: `apply/runtime.py`는 직전 280줄에서 209줄로 감소했고 신규 import-check 모듈은 101줄이다. Runtime은
  lock, preflight, duplicate 검사, package 범위 cleanup, colcon 실행과 실패 상태 조립에 집중한다.
- 검증: Python compileall과 Monitor 전체 pytest `169 passed`를 확인했다. import/whitespace 정리 후 Apply
  관련 테스트 7개와 `git diff --check`를 재실행해 통과했다.
- 남은 문제: 실제 새 interface build 후 install path 추가와 import 성공을 확인하는 통합 E2E는 이번 구조
  이동에서 재실행하지 않았다. Apply runtime은 의미 있는 coordinator 크기가 되었으므로 추가 분리는
  중단하고 다른 대형 실행 runtime을 비교하는 것이 적절하다.

## 2026-08-10 - Interface Service discovery 정책 분리

- 작업: 단일 Registry와 업로드 package Service 정규화, generated class schema 보완, 등록 type과 Graph type
  exact match, callable 응답 조립과 Call 실행 허용 판정을 기존 `execution/service_discovery.py`로 이동했다.
- 이유와 기준: Registry 형식 및 ROS Graph 사실을 결합하는 discovery 정책은 Service request 변환·전송,
  timeout/validation과 history 생명주기에서 독립적이며, Action discovery와 대칭 구조가 적절하다.
- 정책 보존: `ServiceCallRuntime`의 `_registered_services`, `_allowed_service`, `_service_state`, `_service_graph`
  private seam과 공개 `callable_services` 응답 key를 유지했다. Import 가능, server count, exact type,
  QoS unknown/default 상태와 기존 reason 문구 판정도 유지했다.
- 결과: `service_call_runtime.py`는 330줄에서 254줄로 감소했고 확장된 service discovery는 159줄이다.
  Runtime은 Client pool, 실제 Call executor, validation 결과와 history/QoS 기록 조정에 집중한다.
- 검증: Registry schema 보완, callable exact match/QoS, 미등록·serverless 허용 거부 계약 테스트 3개를
  추가했다. Python compileall, ROS2 및 workspace setup 적용 Monitor 전체 pytest, `git diff --check`가
  통과했고 `172 passed`다.
- 남은 문제: 실제 Service server와 업로드 Service package를 함께 사용한 Browser E2E는 이번 discovery
  이동에서 재실행하지 않았다. 다음 후보는 Service Runtime의 validation/history facade 또는 다른 대형
  management/runtime의 혼합 책임이다.

## 2026-08-10 - Interface Topic Receive history 분리

- 작업: Topic 수신 메시지 JSON 변환과 오류 preview, sequence/count/last event 갱신, Topic별 bounded history
  조회와 전체/이름/type별 reset을 신규 `execution/topic_receive_history.py`의 `TopicReceiveHistory`로
  이동했다.
- 이유와 기준: ROS subscription 생성·destroy와 수신 event 저장/검색/초기화는 생명주기와 변경 이유가 다르다.
  Topic state dict는 공유하되 history mutation을 전용 thread-safe 저장소 경계로 모았다.
- 정책 보존: 기존 `TopicReceiveRuntime.history`, `reset_history`, `_record_message` 호출 계약, 최신순 정렬,
  history limit, sequence, size bytes, 직렬화 실패 event, reset 시 active subscription destroy와 공개 응답 key를
  유지했다. 공유 dict 참조를 보존하기 위해 전체 초기화는 재할당하지 않고 `clear()`를 사용한다.
- 결과: `topic_receive_runtime.py`는 277줄에서 222줄로 감소했고 신규 history 저장소는 116줄이다. Runtime은
  Topic 검증, adaptive QoS subscription start/stop/destroy와 공개 receive 상태 조립에 집중한다.
- 검증: Python compileall, ROS2 및 workspace setup 적용 Monitor 전체 pytest, `git diff --check`가 통과했고
  `172 passed`다.
- 남은 문제: 실제 고주파 Topic에서 history limit과 직렬화 비용을 측정하는 성능/E2E 검증은 이번 구조
  이동에서 재실행하지 않았다. 다음 후보는 manual interface management 또는 registry의 혼합 책임이다.

## 2026-08-10 - 단일 Interface 업로드 입력 준비 분리

- 작업: 단일 `.msg/.srv/.action` 업로드의 경로 제거 파일명 정규화, kind/빈 파일/크기/UTF-8/PascalCase
  검증, interface parsing과 parse error를 포함한 기본 Registry entry 생성을 신규
  `management/interface_upload.py`의 `prepare_interface_upload`로 이동했다.
- 이유와 기준: 외부 업로드 입력의 보안·문법 검증은 Registry lock, generated package 설치와 YAML 저장에서
  독립적인 정책이며 Router나 저장 방식과 무관하게 검증할 수 있다.
- 정책 보존: 허용 kind, 256KB 상한, 기존 한글 오류 문구, parse 실패도 entry를 저장하는 동작, timestamp와
  `file_name/file_kind/type_name/raw_text/parsed_error` key를 유지했다. `manual_interfaces.py`와 `packages.py`가
  사용하던 `registry.ALLOWED_KINDS`, `TYPE_NAME_PATTERN`, `_safe_file_name`, `parse_interface` re-export도
  유지했다.
- 트러블슈팅: 첫 전체 테스트 collection에서 `packages.py`의 `registry.parse_interface` 호환 import 누락을
  확인했다. `registry.py`에 명시적 re-export를 복구한 뒤 재실행했다.
- 결과: `registry.py`는 319줄에서 285줄로 감소했고 신규 upload 입력 모듈은 67줄이다. Registry는 설치,
  lock 범위와 YAML 상태 저장 조정에 집중한다.
- 검증: Python compileall, ROS2 및 workspace setup 적용 Monitor 전체 pytest, `git diff --check`가 통과했고
  `172 passed`다.
- 남은 문제: 실제 HTTP multipart의 상한/stream 검증은 transport request parser 책임이며 이번 이동에서
  재실행하지 않았다. 다음 후보는 Registry apply 상태 I/O 조정 또는 manual definition lifecycle이다.

## 2026-08-10 - Manual Interface Registry entry 모델 분리

- 작업: 파일을 만들지 않는 기존 ROS type 수동 등록과 generated package에 파일로 저장하는 manual
  definition의 Registry payload 생성을 신규 `management/manual_entries.py`의 `manual_type_entry`,
  `manual_definition_entry`로 이동했다.
- 이유와 기준: Registry JSON/YAML shape와 build 상태 기본값은 validation, filesystem 쓰기, CMake/package.xml
  재생성과 독립적인 모델 책임이다. Coordinator는 실제 side effect 순서와 테스트 seam을 유지해야 한다.
- 정책 보존: `source`, allowlist, timestamp, full type, parsed schema, file/CMake/package.xml 상태,
  dependency/import/rebuild/error 및 절대/표시 경로 key를 유지했다. 기존 테스트가 patch하는
  `manual_interfaces._check_import`, `generated_interface_package_root`와 Registry 함수 경로도 유지했다.
- 결과: `manual_interfaces.py`는 329줄에서 306줄로 감소했고 신규 entry 모델은 87줄이다. 줄 수 감소보다
  두 등록 방식의 상태 모델을 한곳에서 확인할 수 있는 책임 경계를 우선했다.
- 검증: Python compileall, ROS2 및 workspace setup 적용 Monitor 전체 pytest, `git diff --check`가 통과했고
  `172 passed`다.
- 남은 문제: 실제 manual definition build/import 및 Browser 수정·삭제 E2E는 이번 모델 이동에서
  재실행하지 않았다. 다음에는 manual delete lifecycle이나 Registry apply 상태 조정의 독립성을 비교한다.

## 2026-08-10 - Generated Interface 삭제 lifecycle 분리

- 작업: manual definition과 single-upload generated interface 삭제의 package 소유권 확인, 실제 파일 제거,
  남은 파일 기준 CMake/package.xml 재생성, source/full_type/file_name exact Registry 항목 제거와 응답 조립을
  신규 `management/manual_delete.py`의 `delete_generated_interface`로 이동했다.
- 이유와 기준: 삭제는 여러 filesystem/Registry side effect의 순서를 지켜야 하는 독립 lifecycle이며,
  입력 validation과 삭제 대상 조회 정책과 분리해 실패 지점과 책임을 명확히 할 수 있다.
- 정책 보존: `uploaded_interfaces` package만 허용, 없는 파일도 Registry 정리, metadata 선재생성 후 exact entry
  제거, `deleted_file/file_deleted/build_required/rebuild_required/message` 등 공개 응답 key를 유지했다.
  기존 `manual_interfaces.delete_uploaded_interface`와 patch 가능한 package root/regenerate/remove 함수 경로도
  유지했다.
- 결과: `manual_interfaces.py`는 직전 306줄에서 288줄로 감소했고 신규 delete lifecycle은 56줄이다.
- 검증: Python compileall, ROS2 및 workspace setup 적용 Monitor 전체 pytest, `git diff --check`가 통과했고
  `172 passed`다.
- 남은 문제: metadata 재생성 성공 후 Registry 저장만 실패하는 실제 filesystem 장애 복구 정책은 기존과
  동일하며 이번 구조 이동에서 확장하지 않았다. 다음 후보는 Registry apply 상태 조정 또는 다른 남은 대형
  transport/runtime이다.

## 2026-08-10 - Topic Receive transport Router 분리

- 작업: Topic Receive start/stop, 현재 상태, history 조회와 reset 5개 endpoint를
  `transport/routers/topic_execution.py`에서 신규 `topic_receive.py`로 이동하고 parent Router가 include하도록
  구성했다.
- 이유와 기준: 사용자가 명시적으로 실행하는 Topic Publish와 subscription 기반 Topic Receive는 API path와
  runtime lifecycle이 다르며 독립적으로 변경된다. 기존 app Router 등록은 변경하지 않고 하위 Router 경계를
  사용했다.
- 정책 보존: 5개 공개 API path/method, `topic_type`/`full_type` fallback, history limit, JSON 오류 HTTP 400,
  reset 후 현재 Topic 목록 결합과 기존 success/data/meta/message key를 유지했다.
- 결과: `topic_execution.py`는 238줄에서 170줄로 감소하고 신규 Receive Router는 89줄이다. 기존 Router에는
  callable Message/schema와 단일·연속 Publish, Publish history endpoint만 남았다.
- 검증: Python compileall과 Monitor 전체 pytest `172 passed`를 확인했다. whitespace 수정 후
  `git diff --check`가 통과했으며 실제 FastAPI app에 parent Router를 include한 OpenAPI에서 Receive 5개 경로가
  모두 유지되는 것을 확인했다. FastAPI의 지연 `_IncludedRouter` 때문에 평면 `route.methods` 검사 대신 최종
  OpenAPI를 검증 기준으로 사용했다.
- 남은 문제: HTTP client로 각 Receive endpoint를 호출하는 transport 통합 테스트는 이번 이동에서 별도로
  추가하지 않았다. 다음 후보는 Interface management Router의 upload/manual endpoint 분리다.

## 2026-08-10 - Manual Interface transport Router 분리

- 작업: 기존 ROS type 수동 등록, manual definition 작성·문법 검증·수정·삭제와 generated interface package
  metadata 재생성 endpoint를 `transport/routers/interface_management.py`에서 신규
  `interface_manual.py`로 이동하고 parent Router가 include하도록 구성했다.
- 이유와 기준: 단일 파일 upload/Registry 조회·삭제와 manual type/definition lifecycle은 입력 payload,
  filesystem side effect와 변경 주기가 다른 API feature다. 공개 app Router 등록은 유지하고 하위 Router로
  기능 경계를 명시했다.
- 정책 보존: manual 관련 6개 method 조합과 5개 공개 path, JSON object parsing, HTTP 400 도메인 오류 매핑,
  allowlist/default package, rebuild pending 기록과 기존 success/entry/data/message key를 유지했다.
- 결과: `interface_management.py`는 253줄에서 129줄로 감소했고 신규 manual Router는 140줄이다. Parent에는
  단일 interface upload, Registry 조회와 generated/외부 type 구분 삭제 조정만 남았다.
- 검증: Python compileall과 Monitor 전체 pytest `172 passed`, `git diff --check`가 통과했다. 실제 FastAPI
  app에 parent Router를 include한 최종 OpenAPI에서 manual 5개 path와 동일 path의 PUT/DELETE method가 모두
  유지되는 것을 확인했다.
- 남은 문제: HTTP client로 manual write/update/delete를 실제 호출하는 transport 통합 테스트는 이번 구조
  이동에서 별도로 추가하지 않았다. 다음 후보는 parent Registry 삭제 판정 service 또는 남은 frontend 대형
  controller를 비교한다.

## 2026-08-10 - Frontend Interface 업로드 action 분리

- 작업: 단일 `.msg/.srv/.action` 다중 파일 필터·순차 업로드와 결과 summary, ZIP package/folder 입력 필터와
  업로드, generated package CMake metadata 재생성 action을 신규
  `features/interface-lab/hooks/useInterfaceUploadActions.js`로 이동했다.
- 이유와 기준: 파일 input event와 upload API/feedback/status refresh 생명주기는 Apply, 삭제, manual 입력과
  독립적으로 변경된다. 상위 management controller가 소유한 Registry/Apply 상태 setter와 load callback을
  주입해 기존 단일 상태 원천은 유지했다.
- 정책 보존: 허용 확장자, ZIP/folder 필터, replace option, 파일별 성공/경고/실패 summary, 부분 refresh 실패
  warning, package interface count, upload 후 Registry/Apply/Package refresh와 `onStateChanged` 호출 순서,
  기존 `handleFile/handlePackageFile/handlePackageFolder/regenerateUploadedInterfacesCmake` 반환 계약을 유지했다.
- 결과: `useInterfaceManagementController.js`는 389줄에서 288줄로 감소했고 신규 upload action hook은
  144줄이다. Controller에는 load 상태, delete/apply/manual composition과 최종 평면 계약 조립이 남았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 288 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는 125.86KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser file/folder input과 replace upload 클릭 E2E는 이번 구조 이동에서 재실행하지
  않았다. 다음 후보는 management controller의 삭제 action 또는 Apply/import action 분리다.

## 2026-08-10 - Frontend Interface 삭제 action 분리

- 작업: manual definition, 업로드 package, Registry entry 삭제와 삭제 후 Registry·Package·Apply 상태 동기화,
  실행 후보 refresh 및 최근 Registry 삭제 marker 관리를 신규
  `features/interface-lab/hooks/useInterfaceDeleteActions.js`로 이동했다.
- 이유와 기준: 세 삭제 API는 대상은 다르지만 동일한 busy/error/feedback, 관리 목록 3종 refresh,
  실행 후보 갱신과 `onStateChanged` lifecycle을 공유하며 upload/apply/manual 입력과 독립적으로 변경된다.
- 정책 보존: 현재 편집 중 manual 항목 삭제 시 편집 해제, package와 파일/등록별 warning 문구,
  최근 삭제 3건 dedupe, Registry `file_deleted` 분기, refresh 실행 순서와 기존
  `removeManualDefinition/removePackage/removeRegistryEntry` 반환 계약을 유지했다.
- 구현 주의: 첫 조립에서 delete hook이 manual controller의 `editingManualDefinition`보다 먼저 참조되지 않도록
  hook 호출 순서를 manual controller destructure 뒤로 배치했다.
- 결과: `useInterfaceManagementController.js`는 직전 288줄에서 217줄로 감소했고 신규 delete action hook은
  106줄이다. Management Controller에는 load 상태, Apply/import, upload/delete/manual composition과 최종
  평면 계약 조립이 남았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 289 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.67KB), Interface Lab chunk는 126.37KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser에서 세 삭제 버튼과 현재 편집 항목 삭제 동작을 확인하는 E2E는 이번 구조 이동에서
  재실행하지 않았다. 다음 후보는 Apply/import action 분리다.

## 2026-08-10 - Frontend Interface Apply/import action 분리

- 작업: Interface Apply 실행, build/import 결과 상태와 feedback, reload phase 전이, 재연결 후 import check와
  Registry·Package·Apply 상태 갱신을 신규 `features/interface-lab/hooks/useInterfaceApplyActions.js`로
  이동했다.
- 이유와 기준: Apply는 upload/delete/manual 입력과 달리 Monitor 동일 PID 재시작 및 재연결 이후 import 확인을
  포함하는 독립 lifecycle이다. Management controller의 load callback과 상태 setter를 주입해 기존 상태 원천과
  lifecycle hook 연결을 유지했다.
- 정책 보존: build 시작 표시, log 초기화, success/partial/import_failed/error tone과 한글 문구, not_applied 첫
  항목 표시, scheduled/idle reload phase, Apply 후 status→Registry→Package refresh 순서, import check 후
  Registry/Package panel open과 `onStateChanged`, 안정적인 `runImportCheck` callback 계약을 유지했다.
- 결과: `useInterfaceManagementController.js`는 직전 217줄에서 171줄로 감소했고 신규 Apply action hook은
  98줄이다. Management Controller는 공유 관리 상태, load 함수와 upload/delete/apply/manual hook 조립 및
  기존 평면 반환 계약에 집중한다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 290 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는 126.93KB로 500KB 경고가 없다.
- 남은 문제: 실제 Apply 버튼부터 Monitor 재시작·WebSocket 재연결·import check까지 Browser E2E는 이번 구조
  이동에서 재실행하지 않았다. Management Controller는 현재 의미 있는 composition 크기이므로 추가 분리를
  중단하고 다른 Frontend 대형 Page/Panel을 비교한다.

## 2026-08-10 - Interface Lab 관리 개요 View 분리

- 작업: Interface Lab Hero 설명, 초기화/상태 새로고침과 마지막 갱신 표시, 9개 summary 카드, Apply 상태 pill과
  `InterfaceUploadControl` Workbench 조립을 신규
  `features/interface-lab/InterfaceLabManagementOverview.jsx`로 이동했다.
- 이유와 기준: snapshot/workspace 선택·inline 실행은 Page 조정 책임이지만, 관리 기능의 개요와 이미 계산된
  summary/Apply 상태 표시는 입력 props와 callback만 필요한 독립 View다.
- 정책 보존: 모든 안내 문구, reset/refresh disabled 및 상태 텍스트, summary label/tone, Apply status label,
  workbench reset key, refresh signal, WebSocket과 expanded callback, error 표시 위치를 유지했다.
- 결과: `InterfaceLabPage.jsx`는 322줄에서 257줄로 감소했고 신규 management overview View는 99줄이다.
  Page에는 snapshot refresh, workspace item/selection/history와 inline execution controller 조립이 남았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 291 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는 127.38KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser에서 초기화/새로고침/summary/Workbench 표시를 확인하는 E2E는 이번 View 이동에서
  재실행하지 않았다. 다음 후보는 Page의 workspace browser/list/inline View 분리다.

## 2026-08-10 - Interface Lab Workspace Browser View 분리

- 작업: 10개 group tab, workspace item 수와 카드 목록, 선택 toggle, package 관련 항목 이동, 선택 항목의
  `InlineWorkspace` 렌더링과 inline controller→View props 배선을 신규
  `features/interface-lab/InterfaceLabWorkspaceBrowser.jsx`로 이동했다.
- 이유와 기준: Page는 snapshot과 선택 상태를 조정하지만, group/list/선택 inline 상세 표시는 계산된 item과
  controller 계약만 소비하는 독립 View다. controller 결과 전체를 View에 전달해 Page의 30개 이상 개별 props
  재배선을 제거했다.
- 정책 보존: group label/filter 변경 시 선택 해제, 동일 카드 재클릭 toggle, history 선택 초기화, package 관련
  Service/Action 이동, Topic publish/continuous/subscribe/reset과 Service/Action 실행·cancel의 모든 callback,
  빈 목록 문구와 기존 DOM class를 유지했다.
- 결과: `InterfaceLabPage.jsx`는 직전 257줄에서 144줄로 감소했고 신규 Workspace Browser는 105줄이다.
  Page에는 snapshot refresh, summary/workspace item 계산, selected detail 보정과 두 상위 View 조립이 남았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 292 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는 127.64KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser에서 모든 group, 카드 toggle, package related 이동과 inline 통신 버튼을 확인하는
  E2E는 이번 View 이동에서 재실행하지 않았다. InterfaceLabPage는 현재 적절한 조정 크기이므로 추가 분리를
  중단하고 다른 대형 Panel/Page를 비교한다.

## 2026-08-10 - Interface Lab Topic Execution Panel 분리

- 작업: 등록 Message 필터/선택, Graph Topic 후보와 직접 이름 입력, payload field, 단일·연속 Publish,
  Publish 결과/history View를 `features/interface-lab/execution/TopicExecutionPanel.jsx`로 이동했다. 세 실행
  Panel이 공유하는 확장 heading은 `ExecutionPanelHeading.jsx`로 분리했다.
- 이유와 기준: Topic 실행은 Graph 후보, Publisher 이름, Hz와 continuous 상태/history를 사용하지만
  Service/Action은 callable target과 timeout request/goal 폼을 사용하므로 변경 이유가 다르다.
- 정책 보존: 모든 props와 Message 상태/경고 문구, Graph/직접 입력 source callback, field disabled 조건,
  0.1~50Hz 입력, 단일/연속 버튼 상태, result/history 렌더링과 기존 `InterfaceExecutionWorkspace` panel open
  조건을 유지했다.
- 트러블슈팅: 첫 lint에서 Topic과 함께 제거한 `CallResultBlock` import가 Service Panel에도 필요하다는
  warning을 확인했다. 기존 파일에 import를 복구하고 lint/build를 재실행했다.
- 결과: `InterfaceExecutionPanels.jsx`는 235줄에서 130줄로 감소했고 Topic Panel은 100줄, 공통 heading은
  12줄이다. 기존 파일에는 Service/Action 실행 View만 남았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`를 재실행해 warning 없이 통과했다.
  Vite는 294 modules를 변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는 127.64KB로
  500KB 경고가 없다.
- 남은 문제: 실제 Browser에서 Topic Graph 후보/단일/연속 Publish와 history reset E2E는 이번 View 이동에서
  재실행하지 않았다. 다음 후보는 Service와 Action 실행 Panel을 각각 분리하는 작업이다.

## 2026-08-10 - Interface Lab Service/Action Execution Panel 분리

- 작업: 등록 Service 선택·Request field·timeout·Call 결과/history View와 등록 Action 선택·Goal field·timeout·
  Goal 결과/history View를 각각 `features/interface-lab/execution/ServiceExecutionPanel.jsx`,
  `ActionExecutionPanel.jsx`로 이동하고 구 `InterfaceExecutionPanels.jsx`를 제거했다.
- 이유와 기준: Service와 Action은 공통 heading/field UI를 사용하지만 request/response Call과 goal/result
  lifecycle이 달라 독립적으로 변경된다. 이미 분리한 Topic Panel과 같은 feature 경계로 정렬했다.
- 정책 보존: importable filter, key/status label, callable disabled 조건, schema field, timeout 입력,
  busy button 문구, Call/Goal result와 history 렌더링, `InterfaceExecutionWorkspace`의 open 조건과 props spread를
  유지했다. 확장 heading은 기존 공통 component를 계속 사용한다.
- 결과: 기존 130줄 Panel 묶음 파일을 제거하고 Service/Action Panel을 각각 65줄 파일로 분리했다. Topic
  100줄, 공통 heading 12줄과 함께 통신 종류별 View 구조가 완성됐다.
- 검증: 구 파일 참조가 0건임을 확인했고 Frontend `npm run lint`, `npm run build`, `git diff --check`가
  통과했다. Vite는 295 modules를 변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는
  127.64KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser Service Call과 Action Goal 버튼 E2E는 이번 View 이동에서 재실행하지 않았다.
  다음 후보는 Receive Panel의 Topic/Service/Action View 분리다.

## 2026-08-10 - Interface Lab Topic Receive Panel 분리

- 작업: Message import 필터와 full_type 선택, Graph Topic 검색 후보와 직접 Subscribe 이름, 수신 가능 상태,
  subscription start/stop, 선택/전체 history reset, active Topic과 수신 history View를 신규
  `features/interface-lab/receive/TopicReceivePanel.jsx`로 이동했다.
- 이유와 기준: Topic Receive는 실제 ROS subscription 생성과 Message import/type, Graph Topic name 조합을
  사용하지만 Service/Action Receive는 실행 runtime의 관찰 key와 history 표시를 사용하므로 변경 이유가 다르다.
- 정책 보존: 모든 props, 검색/Message/Graph count, import/QoS 상태 label, Graph/user name source callback,
  start disabled 조건, 다섯 action button, active/history title과 기존 DOM class를 유지했다.
- 결과: `InterfaceReceivePanels.jsx`는 236줄에서 146줄로 감소했고 신규 Topic Receive Panel은 93줄이다.
  `InterfaceReceiveWorkspace`가 새 경로를 직접 import하며 기존 mode 조건을 유지한다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 296 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는 127.64KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser Topic subscription start/stop/reset E2E는 이번 View 이동에서 재실행하지 않았다.
  다음 후보는 Service/Action Receive Panel과 공통 action View 분리다.

## 2026-08-10 - Interface Lab Receive Workbench와 Resource Panel 분리

- 작업: Receive mode tabs/확장/mock 안내를 `features/interface-lab/receive/InterfaceReceiveWorkbench.jsx`로,
  Service/Action 검색·선택·start/stop/reset/refresh와 history View를 kind config 기반 공통
  `ResourceReceivePanel.jsx`로 이동하고 구 `InterfaceReceivePanels.jsx`를 제거했다.
- 이유와 기준: Workbench는 mode/layout 책임이며 Service/Action 관찰 UI는 이름/type key와 label/history title만
  다르고 lifecycle 계약이 동일하다. Topic은 실제 subscription 및 Message/Graph 조합이 달라 별도 Panel을
  유지했다.
- 정책 보존: 네 mode tab, mock 확장 제외와 안내 문구, Service/Action key/name/type 표시, active key 기반
  receiving 상태, 다섯 action button disabled/label, 각 history title, `InterfaceReceiveWorkspace` mode 조건과
  기존 controller props spread를 유지했다.
- 결과: 기존 146줄 묶음 파일을 제거하고 Workbench 30줄, Resource Receive 84줄, 기존 Topic Receive 93줄의
  역할별 구조로 정리했다. Service/Action 중복 View는 config로 통합했다.
- 검증: 구 파일 및 Service/Action Panel 이름 참조가 0건임을 확인했고 Frontend `npm run lint`,
  `npm run build`, `git diff --check`가 통과했다. Vite는 297 modules를 변환했고 초기 bundle은
  210.21KB(gzip 66.66KB), Interface Lab chunk는 126.97KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser Service/Action 관찰 mode와 reset/refresh E2E는 이번 View 이동에서 재실행하지
  않았다. 다음에는 `InterfaceLabWorkspace.jsx`의 카드/inline/detail 조립 책임을 비교한다.

## 2026-08-10 - Interface Lab Workspace 카드와 Inline 상세 분리

- 작업: 구 `InterfaceLabWorkspace.jsx`의 요약/목록 카드 View를 `workspace/WorkspaceCards.jsx`, package 연결
  항목과 선택 Interface 상세 실행 조립을 `workspace/InlineWorkspace.jsx`, Apply 상태 문구 변환을
  `workspace/workspaceStatus.js`로 이동하고 구 파일을 제거했다.
- 이유와 기준: 카드 표시는 목록·요약 presentation, inline workspace는 Topic/Service/Action 상세 실행 조립,
  Apply label은 순수 상태 표시 정책으로 변경 이유가 다르다. 기존 상세 종류별 component가 있는
  `workspace/` 경계에 맞춰 배치했다.
- 정책 보존: summary/card DOM class와 badge 조건, package related item 선택, 상세 metadata와 JSON/raw View,
  Topic Publish/Receive, Service Call, Action Goal/Cancel의 모든 props와 종류별 분기 조건을 유지했다.
- 트러블슈팅: 최초 빌드는 통과했지만 카드 파일에서 component와 `applyStatusLabel`을 함께 export해 Fast
  Refresh warning이 발생했다. 순수 함수를 `workspaceStatus.js`로 분리한 뒤 lint/build를 재실행했다.
- 결과: 기존 337줄 혼합 파일을 제거하고 Inline Workspace 254줄, 카드 65줄, 상태 정책 14줄로 책임을
  분리했다. Management Overview와 Workspace Browser는 새 모듈을 직접 import한다.
- 검증: 구 `InterfaceLabWorkspace.jsx` 참조 0건, Frontend `npm run lint`, `npm run build`, `git diff --check`가
  통과했다. Vite는 299 modules를 변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는
  126.97KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser에서 package related 선택과 Topic/Service/Action inline 실행 E2E는 이번 구조 이동에서
  재실행하지 않았다. 다음 후보는 254줄 `InlineWorkspace.jsx`의 package related View와 공통 metadata/detail
  shell 분리 여부다.

## 2026-08-10 - Interface Lab Package 연결 목록과 상세 Panel 분리

- 작업: `InlineWorkspace.jsx`에 있던 package 연결 Service/Action 목록을 `PackageRelatedItems.jsx`, 선택 Interface의
  공통 metadata/schema/raw 표시와 Topic/Service/Action 상세 View 분기를 `WorkspaceDetailPanel.jsx`로 이동했다.
- 이유와 기준: package 항목은 하위 실행 후보 탐색/선택만 담당하고, 비-package 항목은 schema와 통신 종류별
  실행 UI를 조립한다. 상위 Inline Workspace는 항목 종류 선택과 controller props 전달만 담당하도록 했다.
- 정책 보존: package heading/빈 목록/서버·실행 가능 문구와 선택 callback, 상세 source/full type/package/import/
  build/server/callable/error 값, collapsible JSON/raw, 모든 Topic/Service/Action props와 kind 분기를 유지했다.
- 결과: `InlineWorkspace.jsx`는 254줄에서 90줄로 감소했고 package 목록은 23줄, 상세 Panel은 134줄이다.
  종류별 기존 `TopicWorkspaceDetail`, `ServiceWorkspaceDetail`, `ActionWorkspaceDetail`은 변경하지 않았다.
- 검증: 구 내부 `InterfaceDetailPanel` 참조 0건, Frontend `npm run lint`, `npm run build`, `git diff --check`가
  통과했다. Vite는 301 modules를 변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는
  127.07KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser package 연결 선택과 inline 통신 실행 E2E는 이번 View 이동에서 재실행하지 않았다.
  다음에는 181줄 `TopicWorkspaceDetail.jsx`의 Publish/Receive/history UI 책임을 비교한다.

## 2026-08-10 - Interface Lab Topic Publish와 Subscribe 상세 분리

- 작업: `TopicWorkspaceDetail.jsx`의 Publish 후보/이름/payload/지속 발행 UI를 `TopicPublishPanel.jsx`,
  Subscribe 이름/활성 상태/start/stop/reset UI를 `TopicSubscribePanel.jsx`로 이동했다. 상위에는 Graph 연결과
  type conflict, 마지막 결과/history 조립을 유지했다.
- 이유와 기준: Publish는 Publisher 생성과 payload/Hz 실행 상태, Subscribe는 subscription key와 활성 수신
  상태를 사용해 독립적으로 변경된다. Graph 연결 정보와 통합 history는 Topic 상세 전체 문맥에 속한다.
- 정책 보존: Graph 후보와 직접 이름 전환, Message schema field, adaptive QoS 안내, 0.1~50Hz와 지속 발행 상태,
  Subscribe exact topic_name/full_type 매칭, 버튼 disabled/문구, reset, 결과/history View와 기존 DOM class를 유지했다.
- 결과: Topic 상세 181줄은 조립 38줄, Publish 95줄, Subscribe 41줄로 분리됐다. `WorkspaceDetailPanel`에서
  사용하는 `TopicWorkspaceDetail` 공개 props 계약은 변경하지 않았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 303 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는 127.25KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser에서 Graph 후보 Publish, 지속 발행, Subscribe와 history reset E2E는 이번 View 이동에서
  재실행하지 않았다. 다음 후보는 312줄 `useInterfaceReceiveController.js`의 mode별 상태/명령 책임 분리다.

## 2026-08-10 - Interface Lab Topic Receive Controller 분리

- 작업: 통합 `useInterfaceReceiveController.js`에서 Topic Graph/type/search 필터, 자동/Graph/사용자 선택 출처,
  현재 수신 여부와 visible history, start/stop 및 선택·전체 reset 명령을 `useTopicReceiveController.js`로 이동했다.
- 이유와 기준: Topic은 실제 subscription과 Message full_type/name 조합을 사용하지만 Service/Action은 실행
  history 관찰 observer를 공유한다. 전체 API snapshot 병렬 로딩과 1초 polling은 세 mode를 동기화하므로 상위에
  유지했다.
- 정책 보존: 사용자 직접 입력 유지와 Graph 첫 후보 자동 선택, exact topic name/type 수신 상태, history limit
  500, 모든 성공/실패 feedback 문구, reset 후 load, 상위 hook의 기존 공개 반환 key를 유지했다.
- 트러블슈팅: 최초 연결에서 통합 loader가 하위 hook의 setter를 참조해 exhaustive-deps warning이 발생했다.
  Topic snapshot/history state는 전체 loader가 소유하고 하위 hook에 주입하도록 조정해 순환 dependency와 경고를
  제거했다. 내부 setter는 공개 반환값에 추가되지 않는다.
- 결과: `useInterfaceReceiveController.js`는 312줄에서 198줄로 감소했고 Topic 전용 hook은 140줄이다.
  상위에는 통합 load, Service/Action observer, mode/open과 polling 조정만 남았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 304 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.65KB), Interface Lab chunk는 127.49KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser의 Topic 자동 선택/직접 이름 보존과 start/stop/reset E2E는 이번 hook 이동에서
  재실행하지 않았다. 다음 후보는 통합 Receive load를 별도 data loader로 분리할지, 다른 300줄대 Frontend
  후보로 이동할지 비교한다.

## 2026-08-10 - Service 화면 필터 정책과 Toolbar 분리

- 작업: `ServicesPage.jsx`의 내부/관리 Service 판정, primary/issue/search 필터와 summary 계산을
  `features/services/serviceFilters.js`, 검색창과 네 상태 filter button View를
  `features/services/ServiceFilterToolbar.jsx`로 이동했다.
- 이유와 기준: Service 분류·요약은 DOM과 무관한 순수 정책이고 Toolbar는 검색/필터 입력 표시만 담당한다.
  페이지에는 Dashboard 상태, selected Service 보정, Alert 클릭 후 hidden 포함 및 row focus, table/detail 조립을
  유지했다.
- 정책 보존: lifecycle/composition/action/costmap/management Service marker, user primary 예외, hidden 미조회 수,
  primary/issues/all/internal 네 filter 의미, 여섯 검색 field, includeHidden 동기화, 빈 목록 문구와 DOM class를
  유지했다.
- 결과: `ServicesPage.jsx`는 320줄에서 156줄로 감소했고 순수 필터 정책은 90줄, Toolbar는 34줄이다.
  기존 `ServiceSummaryCards`, `ServiceTable`, `ServiceDetailPanel` 계약은 변경하지 않았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 306 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Services chunk는 17.60KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser의 네 filter 전환, Alert 클릭 row focus와 hidden Service 선택 E2E는 이번 구조 이동에서
  재실행하지 않았다. 다음 후보는 310줄 `VisualizationDetailPanel.jsx`와 307줄 `CommunicationGraph.jsx`의
  시각화 책임을 비교한다.

## 2026-08-10 - Visualization 종류별 상세와 표시 정책 분리

- 작업: `VisualizationDetailPanel.jsx`의 Node/Topic/Service/Action별 metric·participant/entity 목록을
  `VisualizationKindDetails.jsx`, kind label과 status tone 변환을 `visualizationPresentation.js`로 이동했다.
- 이유와 기준: missing/empty 및 공통 상태·연결 요약은 선택 상세 shell 책임이고, 종류별 ROS2 resource 정보는
  각 entity schema 변화에 따라 독립적으로 변경된다. label/tone은 DOM과 무관한 순수 표시 정책이다.
- 정책 보존: 사라진 선택 안내, 상태 badge와 tone, incoming/outgoing connection, Node resource 목록,
  Topic publisher/subscriber/Hz, Service 요청자/응답자, Action Goal 실행자/요청자와 runtime 상태 문구를 유지했다.
- 결과: `VisualizationDetailPanel.jsx`는 310줄에서 122줄로 감소했고 종류별 상세는 81줄, 표시 정책은 15줄이다.
  기존 공개 `VisualizationDetailPanel({ graphNode, missingNodeId })` 계약은 변경하지 않았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 308 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Visualization chunk는 208.59KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser에서 네 resource kind 선택과 missing node 상태 E2E는 이번 View 이동에서 재실행하지
  않았다. 다음 후보는 307줄 `CommunicationGraph.jsx`의 drag/viewport와 edge routing 정책 분리다.

## 2026-08-10 - Visualization Graph interaction 정책 분리

- 작업: `CommunicationGraph.jsx`의 수동 위치 병합/prune, shift 동일-kind group drag state와 좌표 이동,
  viewport signature, node 중심 기준 nearest edge handle routing, minimap color를 순수
  `graphInteraction.js`로 이동했다.
- 이유와 기준: 좌표·edge 계산은 React lifecycle이나 React Flow hook 없이 입력 배열/Map을 변환하는 정책이다.
  컴포넌트에는 displayed state, requestAnimationFrame 정리, fit/reset effect와 drag event orchestration을
  유지했다.
- 정책 보존: node 기본 크기 286x156, 수평/수직 거리 기준 네 handle 방향, layout key 변경 시 수동 위치 reset,
  사라진 node 위치 prune, shift group drag, 단일 drag 위치 저장, kind별 minimap 색과 fit 옵션을 유지했다.
- 결과: `CommunicationGraph.jsx`는 307줄에서 200줄로 감소했고 순수 interaction 모듈은 99줄이다.
  기존 `CommunicationGraph` props와 React Flow DOM 구성을 변경하지 않았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 309 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Visualization chunk는 208.59KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser node 단일/shift group drag, layout reset, 자동 fit과 edge reroute E2E는 이번 이동에서
  재실행하지 않았다. 다음 후보는 274줄 `useVisualizationGraph.js` 또는 273줄 `TopicTable.jsx`의 책임 비교다.

## 2026-08-10 - Visualization 선택 정책과 Stable Graph 분리

- 작업: `useVisualizationGraph.js`의 Node picker primary/active/hidden/search 필터 및 정렬과 선택 Graph resource의
  Topic/Service/Action participant 보강을 `features/visualization/graphSelection.js`, graph signature와 이전 객체
  재사용을 `useStableGraph.js`로 이동했다.
- 이유와 기준: selectable Node 계산과 participant lookup은 React state 없이 입력 snapshot을 변환하는 정책이고,
  stable graph는 polling마다 의미가 같은 graph 객체로 인한 불필요한 downstream 갱신을 막는 독립 hook이다.
  polling과 filter state, graph transform 조립은 상위 dashboard hook에 유지했다.
- 정책 보존: primary/active/all filter 의미, 내부/hidden 제외, full_name/name/namespace 검색, active 우선 및 연결 수
  정렬, 종류별 빈 participant shape, node/edge signature 구성과 `useVisualizationGraph` 공개 반환 key를 유지했다.
- 결과: `useVisualizationGraph.js`는 274줄에서 179줄로 감소했고 선택 정책은 44줄, stable graph hook은 28줄이다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 311 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Visualization chunk는 208.77KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser에서 Node filter/search 정렬과 polling 중 graph 위치 안정성 E2E는 이번 이동에서
  재실행하지 않았다. 다음 후보는 273줄 `TopicTable.jsx`의 row/presentation/modal 책임 분리다.

## 2026-08-10 - Topic Table Row와 표시 정책 분리

- 작업: `TopicTable.jsx`의 개별 row 렌더링을 `features/topics/TopicTableRow.jsx`, 정렬 column 정의와
  Dashboard 통신 badge 항목, Hz state/label, missing 및 last checked 계산을 `topicTablePresentation.js`로
  이동했다.
- 이유와 기준: Table은 sort와 preview modal 상태, header/body 조립을 담당하고 row는 단일 Topic 표시·선택,
  presentation 모듈은 DOM과 무관한 상태 변환 및 정렬 값을 담당하도록 분리했다.
- 정책 보존: 열 순서와 기본 name asc, count/Hz/통신/관찰/마지막 확인 desc 정렬, Dashboard 제외 Node count,
  deep monitoring missing class, 모든 Hz 상태·문구, 세 Dashboard 통신 badge, 별표와 JSON preview를 유지했다.
- 결과: `TopicTable.jsx`는 273줄에서 70줄로 감소했고 row는 50줄, 표시·정렬 정책은 60줄이다.
  기존 `TopicTable` 공개 props와 empty state/modal 계약은 변경하지 않았다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 313 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.67KB), Topics chunk는 17.00KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser column별 정렬, row 선택/별표, preview modal과 missing 강조 E2E는 이번 구조 이동에서
  재실행하지 않았다. 다음 후보는 270줄 `useTopicExecutionController.js` 또는 265~333줄 Monitor runtime의
  남은 책임을 비교한다.

## 2026-08-10 - Interface Lab 지속 Topic Publish Controller 분리

- 작업: `useTopicExecutionController.js`의 지속 Publish Hz/active 목록, 활성 항목 polling과 start/stop 명령을
  `useContinuousTopicExecution.js`로 이동하고 반환값을 기존 Topic controller API에 병합했다.
- 이유와 기준: 단일 Publish는 요청 후 history를 갱신하고, 지속 Publish는 별도 backend runtime 상태와 1초
  polling 및 start/stop lifecycle을 가진다. Message 선택·Graph 후보·publish 이름과 단일 history는 상위에
  유지했다.
- 정책 보존: active key의 topic_name/full_type exact match, 1초 polling과 silent transport error, payload numeric
  normalization, Hz 전달, start/stop busy/result와 state changed callback, 외부 snapshot `replace` setter 및 기존
  반환 key를 유지했다.
- 트러블슈팅: 최초 lint에서 상위 `replace` callback의 새 `setContinuousPublishes` dependency warning을 확인했고
  dependency 배열에 명시한 뒤 lint/build를 재실행했다.
- 결과: `useTopicExecutionController.js`는 270줄에서 205줄로 감소했고 지속 Publish hook은 95줄이다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는 314 modules를
  변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는 127.70KB로 500KB 경고가 없다.
- 남은 문제: 실제 Browser 지속 Publish start/상태 갱신/stop E2E는 이번 hook 이동에서 재실행하지 않았다.
  다음에는 Frontend 300줄 기준 후보가 줄어든 상태를 재집계하고 Monitor runtime의 남은 책임을 검토한다.

## 2026-08-10 - Monitor Interface Lab 단일 Topic Publish Executor 분리

- 작업: `interface_lab/execution/topic_runtime.py`의 단일 Publish 입력 검증, Graph conflict/Action 내부 Topic 거부,
  generated Message 생성·Publisher 실행과 결과 payload 조립을 `topic_publish_executor.py`의
  `TopicPublishExecutor`로 이동했다.
- 이유와 기준: 단일 Publish 실행은 Registry/Graph/Publisher pool/history를 사용하는 독립 요청 lifecycle이며,
  runtime은 Message Registry, Graph Inspector, Publisher/Continuous/Receive runtime을 조립하고 기존 공개
  facade를 유지하는 역할에 집중해야 한다.
- 정책 보존: node 실행 확인, `/` name 검증, 등록 type 확인, conflict type 문구, validation details,
  신규 Publisher 0.5초 대기 후 Graph 재조회, subscriber count/QoS/message JSON, 실패 history 기록 후
  `InterfaceReceiveError` 변환과 모든 response key를 유지했다.
- 테스트 호환: 기존 테스트가 `topic_runtime.get_message`를 monkeypatch하는 seam은 executor에 lambda를 주입해
  유지했고 Router가 import하는 `InterfaceReceiveError`도 기존 모듈에서 계속 재노출된다.
- 결과: `topic_runtime.py`는 338줄에서 247줄로 감소했고 executor는 138줄이다.
- 검증: 두 Monitor source tree `compileall`, targeted `test_interface_receive_runtime.py` 10 tests,
  Monitor 전체 pytest 172 tests와 `git diff --check`가 모두 통과했다.
- 남은 문제: 실제 ROS2 Topic에 대한 신규 Publisher discovery 대기와 QoS 발행 E2E는 이번 구조 이동에서
  재실행하지 않았다. 다음 후보는 333줄 `action_goal_runtime.py`의 Goal request/result lifecycle 분리다.

## 2026-08-10 - Monitor Action Goal Tracker와 Result Builder 분리

- 작업: `action_goal_runtime.py`의 활성 Goal handle thread-safe 저장/remove 및 cancel wait/acceptance 처리를
  `action_goal_tracker.py`, Goal 실행 공통 결과 payload 생성을 순수 `action_result.py`로 이동했다.
- 이유와 기준: Goal handle은 send executor와 cancel endpoint가 공유하는 독립 lifecycle state이며, 결과 builder는
  실행 단계와 무관하게 성공/실패/timeout payload key를 조립한다. Runtime에는 discovery, client pool, history와
  goal executor 조정을 유지했다.
- 정책 보존: name/type exact handle key, cancel future callback/Event wait와 timeout 문구, goals_canceling 기반 승인,
  cancel QoS, elapsed/sent time과 optional status/error/error_type/details key를 유지했다.
- 호환: `execute_action_goal`에 전달되는 `_store_goal_handle`, `_remove_goal_handle`, `_result` private callback은
  runtime wrapper로 유지해 기존 테스트·호출 seam을 보존했다.
- 결과: `action_goal_runtime.py`는 333줄에서 311줄로 감소했고 tracker 48줄과 result builder 47줄이 독립됐다.
  줄 수 감소보다 mutable handle 소유권과 순수 결과 정책 분리를 우선했다.
- 검증: Monitor source `compileall`, Monitor 전체 pytest 172 tests, `git diff --check`가 모두 통과했다.
- 남은 문제: 실제 Action server에 대한 Goal send/feedback/result/cancel E2E는 이번 구조 이동에서 재실행하지
  않았다. Runtime에는 discovery adapter wrapper가 남아 있으므로 다음에는 receive reset/history 상태 또는
  discovery facade 분리의 실익을 검토한다.

## 2026-08-10 - Monitor Action Receive History 상태 분리

- 작업: `action_goal_runtime.py`의 전체/Action exact key별 Receive reset timestamp와 Goal history 기반
  feedback/result 관찰 snapshot 생성을 `action_receive_history.py`의 `ActionReceiveHistory`로 이동했다.
- 이유와 기준: Receive history reset은 Goal 실행 원본을 삭제하지 않고 UI 관찰 경계만 갱신하는 독립 상태다.
  Goal send/cancel/client discovery와 lifecycle이 다르므로 history loader를 주입받는 객체로 분리했다.
- 정책 보존: `build_receive_history` 이벤트 변환, global 및 `(action_name, action_type)` exact reset 경계,
  reset 전 visible event 수를 반환하는 `cleared`, 원본 Goal history 보존과 runtime 공개 메서드를 유지했다.
- 결과: `action_goal_runtime.py`는 직전 311줄에서 297줄로 줄어 300줄 아래가 됐고 Receive history state는
  38줄이다. Runtime clear에서 Goal tracker와 Receive reset state를 각각 초기화한다.
- 검증: Monitor source `compileall`, Action history/runtime summary 관련 11 tests, Monitor 전체 pytest
  172 tests와 `git diff --check`가 모두 통과했다.
- 남은 문제: 실제 Action feedback/result 수신과 reset UI E2E는 이번 상태 이동에서 재실행하지 않았다.
  다음 후보는 324줄 `ros2_action/subscriptions.py` 또는 304줄 `ros2_topic/alerts.py`의 책임을 검토한다.

## 2026-08-10 - Monitor Action Message Type Loader 분리

- 작업: `ros2_action/subscriptions.py`의 Action full type→feedback topic type 변환, GoalStatusArray class import,
  generated Action feedback Message class import/fallback을 `action_type_loader.py`로 이동했다.
- 이유와 기준: type 문법과 Python generated class import는 subscription entry/status runtime 갱신과 무관한
  discovery/import 정책이다. `subscriptions.py`에는 entry와 관찰 상태 변환을 유지했다.
- 정책 보존: `package/action/Name` 3-part 검증, `<Name>_FeedbackMessage`, package action module 우선 lookup,
  `get_action().Impl.FeedbackMessage` fallback과 import/lookup 실패 시 `None`, GoalStatusArray 상수를 유지했다.
- 호환: `subscription_facade.py`와 `subscription_lifecycle.py`가 사용하는 기존
  `ros2_action.subscriptions` loader import 경로는 해당 모듈 re-export로 보존했다.
- 결과: `subscriptions.py`는 324줄에서 271줄로 감소했고 Action type loader는 51줄이다.
- 검증: Monitor source `compileall`, Monitor 전체 pytest 172 tests, `git diff --check`가 모두 통과했다.
- 남은 문제: 실제 custom Action feedback generated class import E2E는 이번 이동에서 재실행하지 않았다.
  다음 후보는 304줄 `ros2_topic/alerts.py`의 연결/missing/stale 정책 책임을 검토한다.

## 2026-08-10 - Monitor Alert Retention과 Meta 분리

- 작업: `ros2_topic/alerts.py`의 상태 Alert active/resolved retention, 해결 history 기록/상한과 severity meta 집계를
  `ros2_topic/alert_retention.py`로 이동했다.
- 이유와 기준: Topic connection/missing/stale 및 MonitorStatus 판정은 새 Alert 후보 생성 책임이고, retention은
  Topic·Service·Action Alert에 공통으로 적용되는 시간 기반 lifecycle이다. 감지와 해결 상태 전이를 분리했다.
- 정책 보존: retained code만 lifecycle 적용, passthrough Alert, first/last/resolved timestamp, 해결 시 history 1회
  삽입과 `origin_id`, 기본 60초 보존 및 경계 이상 시 제거, active/resolved와 네 severity count를 유지했다.
- 호환: 기존 테스트와 다른 resource alert 모듈이 사용하는 `ros2_topic.alerts.retain_alerts`,
  `build_alert_meta`, `ALERT_RESOLVED_RETENTION_SEC` import 경로를 re-export로 보존했다.
- 결과: `ros2_topic/alerts.py`는 304줄에서 204줄로 감소했고 retention/meta 모듈은 87줄이다.
- 검증: Monitor source `compileall`, Alert 관련 36 tests, Monitor 전체 pytest 172 tests와
  `git diff --check`가 모두 통과했다.
- 남은 문제: MariaDB 영속 Alert history는 별도 확정 기능으로 아직 이 메모리 retention 분리 범위가 아니다.
  다음에는 남은 Monitor 대형 파일을 재집계해 실제 복수 책임 후보만 계속 정리한다.

## 2026-08-10 - Monitor Service Active Check Codec 분리

- 작업: `ros2_service/active_check.py`의 generated Service class import, request 객체 생성, response JSON preview와
  nested `success_field` lookup/boolean 판정을 `active_check_codec.py`로 이동했다.
- 이유와 기준: ROS interface 객체 변환은 allowlist 지원 여부와 pending/success/timeout 상태 payload 정책과
  독립적이다. 실제 client/future lifecycle은 기존 `active_check_runtime.py`에 계속 유지했다.
- 정책 보존: `get_service` import, `service_class.Request`와 `label='request'`, ROS message JSON 변환,
  success field 미설정 성공, bool 직접 판정, 기타 값 truthiness 및 누락된 dotted path KeyError 문구를 유지했다.
- 호환: `active_check_runtime.py`가 사용하는 `active_check.load_service_class`, `build_request`,
  `response_state` import 경로는 codec symbol re-export로 유지했다.
- 결과: `active_check.py`는 269줄에서 229줄로 감소했고 codec은 40줄이다.
- 검증: Monitor source `compileall`, Monitor 전체 pytest 172 tests가 통과했다. 첫 `git diff --check`에서 파일 끝
  추가 공백 줄을 확인해 제거했고 재검사도 통과했다.
- 남은 문제: 실제 allowlist Service active check request/timeout/success_field E2E는 이번 구조 이동에서
  재실행하지 않았다. 다음에는 남은 250~300줄 coordinator 중 분리 가치가 있는 후보를 재평가한다.

## 2026-08-10 - Interface Registry 경로와 Multipart Decoder 분리

- 작업: `management/registry.py`의 Registry/generated package env 경로와 표시 경로 정책을
  `registry_paths.py`, multipart/form-data file payload 해석을 `multipart_upload.py`로 이동했다.
- 이유와 기준: 배포 경로 해석과 HTTP body decoding은 Registry lock/CRUD 및 interface 설치/apply 상태와
  독립적이다. Registry coordinator에는 single upload 설치, YAML 변경과 apply/import 조정을 유지했다.
- 정책 보존: `INTERFACE_REGISTRY_PATH`, `INTERFACE_PACKAGE_NAME/PATH`의 기본값과 상대/절대 처리, workspace 밖
  표시 경로 fallback, content type/비정상 multipart/파일 없음 오류 문구, 첫 filename part와 decoded bytes를
  유지했다.
- 호환: Router와 테스트가 사용하는 `registry.default_registry_path`, `default_interface_package`,
  `extract_multipart_file`, `_display_path` 경로는 import/re-export로 유지했다.
- 결과: `registry.py`는 285줄에서 238줄로 감소했고 경로 모듈은 34줄, multipart decoder는 24줄이다.
- 검증: Monitor source `compileall`, Registry/Manual 관련 18 tests, Monitor 전체 pytest 172 tests가 통과했다.
  첫 `git diff --check`에서 파일 끝 추가 공백 줄을 확인해 제거했고 재검사도 통과했다.
- 남은 문제: 실제 HTTP multipart upload와 env override를 사용한 실행 E2E는 이번 이동에서 재실행하지 않았다.
  다음에는 남은 coordinator들의 복수 책임 여부를 계속 비교한다.

## 2026-08-10 - Monitor Action Result Client Pool 분리

- 작업: `ros2_action/result_runtime.py`의 Action type별 GetResult Service class/policy/reason cache와 Action 이름별
  ROS Service client 생성·재사용/cleanup을 `result_client_pool.py`의 `ActionResultClientPool`로 이동했다.
- 이유와 기준: generated Result Service class 해석 및 client cache는 terminal Goal 탐색, future pending/completion,
  subscription entry result 상태 반영과 독립적인 resource lifecycle이다.
- 정책 보존: 빈 action type cache key, loader의 service class/policy/reason tuple, `<name>/_action/get_result` 경로,
  services default QoS, node 없음 오류, 이름별 client 재사용과 stale Action cleanup을 유지했다.
- 호환: `result_runtime.py`의 `_action_result_client`, `_result_service_class` private seam은 pool delegate wrapper로
  유지했고 `support`, `update`, bind/clear 공개 계약을 변경하지 않았다.
- 결과: `result_runtime.py`는 265줄에서 233줄로 감소했고 Result Client Pool은 54줄이다.
- 검증: Monitor source `compileall`, Monitor 전체 pytest 172 tests와 `git diff --check`가 모두 통과했다.
- 남은 문제: 실제 외부 Action의 terminal status 후 GetResult Service request E2E는 이번 이동에서 재실행하지
  않았다. 다음에는 남은 250줄대 runtime/coordinator를 계속 책임 기준으로 검토한다.

## 2026-08-10 - Monitor Action Message Preview 분리

- 작업: `ros2_action/subscriptions.py`의 ROS Action feedback/result Message 깊이 제한 JSON-safe 변환을
  `message_preview.py`로 이동하고 `result.py`는 새 모듈을 직접 import하도록 변경했다.
- 이유와 기준: ROS Message 직렬화는 status/Goal/result 관찰 상태 전이와 독립적인 표시 데이터 변환이다.
  subscriptions에는 entry 생성과 Goal별 상태 timestamp/result 동기화를 유지했다.
- 정책 보존: primitive 직접 반환, 기본 최대 깊이 3, list/tuple 최대 10개, `__slots__` 순회와 `_` prefix 제거,
  깊이 초과 및 미지원 객체 문자열 fallback을 유지했다.
- 호환: 기존 `ros2_action.subscriptions.message_to_preview` import는 re-export로 유지했고 실제 Result decoder는
  순환 가능성을 줄이기 위해 새 모듈을 직접 사용한다.
- 결과: `subscriptions.py`는 직전 271줄에서 235줄로 감소했고 preview 모듈은 37줄이다.
- 검증: Monitor source `compileall`, Monitor 전체 pytest 172 tests가 통과했다. 첫 `git diff --check`에서 파일 끝
  공백 한 줄을 확인해 제거했고 재검사도 통과했다.
- 남은 문제: 큰 custom feedback Message의 실제 preview 깊이/배열 제한 E2E는 이번 이동에서 재실행하지 않았다.
  다음에는 Frontend와 Monitor의 남은 coordinator 중 실제 복수 책임 후보를 계속 검토한다.

## 2026-08-10 - Interface Upload View Props Adapter 분리

- 작업: 구 `model/interfaceUploadViewProps.js`의 Topic/Service/Action 실행 adapter를
  `executionViewProps.js`, Receive adapter를 `receiveViewProps.js`, 관리 adapter를
  `managementViewProps.js`로 이동하고 구 파일을 제거했다.
- 이유와 기준: 실행, Receive, Registry/Package/Manual/Toolbar 관리는 서로 다른 controller와 View가 함께
  변경되는 독립 adapter다. `InterfaceUploadControl`은 controller/lifecycle/panel coordinator 조립 역할이므로
  유지했다.
- 정책 보존: 모든 View prop key와 field updater callback, expanded/open/showExpand, Topic 지속 Publish,
  Service Call/Action Goal, Receive start/stop/reset/refresh, 관리 toolbar/manual/package/registry/build failure
  mapping을 유지했다.
- 중복 정리: 구조가 같은 Service/Action Receive mapping은 `resourceProps(state, kind)`로 통합했으며 kind별
  state/callback 선택만 다르게 유지했다.
- 결과: 구 215줄 adapter 묶음을 제거하고 실행 79줄, 관리 72줄, Receive 53줄로 분리했다.
- 검증: 구 파일 참조 0건, Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다. Vite는
  316 modules를 변환했고 초기 bundle은 210.21KB(gzip 66.66KB), Interface Lab chunk는 127.63KB다.
- 남은 문제: 실제 Browser에서 모든 Interface Upload panel 전환과 Receive/Execution action E2E는 이번 adapter
  이동에서 재실행하지 않았다. 다음에는 전체 구조 후보를 재집계해 리팩토링 종료 조건을 판단한다.

## 2026-08-10 - 구조 리팩토링 종료 판단과 전체 회귀 검증

- 작업: Frontend/Backend/Monitor source 전체 줄 수와 현재 diff를 재집계하고, 300줄 이상 파일이 없으며 남은
  250~300줄 파일은 coordinator/runtime/page 등 책임 경계가 명확함을 확인했다. 추가적인 줄 수 중심 분리를
  중단하고 전체 회귀 검증을 수행했다.
- 판단 기준: `AGENTS.md`의 React 300+, Python 500+, 800+ 우선 조사 기준과 “의미 있는 짧은 파일을 줄 수만
  보고 합치거나 쪼개지 않는다”는 정책을 적용했다. 남은 Action Goal runtime, RosMonitor, manual interface,
  Interface Upload controller 등은 이미 하위 executor/state/pool/adapter가 분리된 조정 계층이다.
- Frontend 검증: `npm run lint`, `npm run build` 통과. Vite 316 modules, 초기 bundle 210.21KB(gzip 66.66KB),
  Interface Lab 127.63KB, Visualization 208.77KB이며 500KB 경고가 없다.
- Backend/Monitor 검증: Backend pytest 6 tests, Monitor pytest 172 tests와 Backend/Monitor source `compileall`,
  `git diff --check`가 통과했다.
- ROS workspace 검증: `colcon list`에서 5 packages를 확인했고 `colcon build --symlink-install`, `colcon test`,
  `colcon test-result --verbose`가 통과했다. 최종 결과는 177 tests, 0 errors, 0 failures, 0 skipped다.
- 완료 상태: 구조 리팩토링은 현재 기준 완료다. 이후에는 실제 기능 구현, 발견된 복수 책임, 성능/버그 근거가
  있을 때만 추가 분리한다.
- 남은 문제: 전체 실제 Browser E2E, 실제 ROS2 장비 QoS, Gazebo/Action/Interface Lab 통신 E2E는 이번 최종
  정적·자동 회귀 검증에 포함하지 않았다. 모든 변경은 기존 사용자 변경과 함께 미커밋 상태이며 commit/push를
  수행하지 않았다.

## 2026-08-10 - Stack 실행 E2E 시도와 Sandbox 네트워크 제한 확인

- 작업: 구조 리팩토링 완료 후 `scripts/run_dashboard_stack.sh`로 Monitor→Backend→Frontend health E2E를
  시도하고, 실패 원인을 `.runtime/monitor.log`와 프로세스 상태로 진단했다. 이어 동일 shell에서 health timeout을
  50초로 늘린 임시 실행으로 재시도했다.
- 결과: ROS workspace 5 package build는 성공했다. Monitor process는 Fast DDS 초기화 중 UDP socket과
  `getifaddrs`에서 반복적으로 `Operation not permitted`를 기록해 약 20초 이상 지연된 뒤 Uvicorn
  `127.0.0.1:8765` application startup까지 완료했다.
- 차단 원인: Codex sandbox가 network namespace/socket을 제한해 같은 실행 shell의 loopback curl도 Monitor
  health에 연결되지 않았다. 기본 stack script는 20초 health timeout 후 Monitor를 정상 종료했고, 연장 재시도도
  Monitor health 단계에서 종료되어 Backend/Frontend와 공개 REST endpoint까지 진행하지 못했다.
- 안전 정리: stack stop script와 임시 실행 trap이 생성한 Monitor process를 종료했으며 Backend/Frontend 신규
  process는 시작되지 않았다. 기존 외부 프로세스나 사용자 데이터는 변경하지 않았다.
- 판단: 자동 test/build 결과는 모두 통과하므로 이번 현상은 코드 회귀 증거가 아니라 sandbox 환경 제약이다.
  실제 Browser/API/ROS Graph E2E는 network/DDS가 허용된 일반 터미널에서 `scripts/run_dashboard_stack.sh`로
  재실행해야 한다.

## 2026-08-10 - Sandbox 외 Stack Health와 공개 API E2E 통과

- 작업: 승인된 sandbox 외 실행에서 Monitor, Backend, Frontend를 동일 shell에서 순차 시작하고 health 대기 후
  공개 resource API와 Frontend HTML을 확인했다. 검증 종료 시 trap으로 세 프로세스를 모두 종료했다.
- 결과: Monitor `127.0.0.1:8765/health`는 running, Backend `127.0.0.1:8000/health`는 running 및
  `monitor_connected: true`를 반환했다. Frontend `127.0.0.1:5173`은 631-byte HTML과 `#root`를 반환했다.
- 공개 API: `/ros/topics` 9개, `/ros/services` 2개, `/ros/actions` 1개, `/ros/nodes` 5개를 정상 JSON으로
  반환했다. 이는 별도 demo node를 시작하지 않은 당시 ROS Graph 기준이다.
- 판단: 이전 stack timeout은 sandbox network/DDS 제한에 의한 것이며, 일반 network namespace에서는 이번
  리팩토링 이후 Monitor→Backend polling과 Frontend serving 기본 경로가 정상 동작한다.
- 남은 범위: 실제 Browser UI interaction/WebSocket 재연결, demo communication, Interface Lab 명시 실행과
  실제 장비/Gazebo QoS E2E는 별도 기능 시나리오로 남아 있다.

## 2026-08-10 - Backend WebSocket Monitor 단절 상태 표시 수정

- 작업: 충돌 없는 임시 포트(8875/8012)에서 Monitor 중단·재시작 E2E를 수행하고,
  `backend/app/routers/monitor_websocket.py`가 Monitor 단절 후에도 마지막 정상 payload만 보내 연결 상태를
  노출하지 않는 문제를 수정했다.
- 원인과 기준: `MonitorCache.mark_error()`는 마지막 정상 snapshot을 의도적으로 보존하지만 WebSocket router가
  cache의 `connected/error`보다 보존된 `data.websocket`을 우선했다. Backend가 마지막 정상 snapshot과 현재
  연결 상태를 함께 제공해야 한다는 책임 경계를 적용했다.
- 주요 변경: `build_monitor_websocket_payload()`를 추가해 기존 `type/data/timestamp`를 유지하면서 모든
  payload에 `connected`와 `reason`을 덧붙였다. 단절 시에도 마지막 `data`는 유지한다.
- 검증: Backend pytest 7 tests, Backend compileall, `git diff --check`가 통과했다. 격리 E2E에서 WebSocket은
  Monitor 연결 시 `connected: true`, 중단 시 `connected: false`와 오류 사유 및 마지막 data, 재시작 시 다시
  `connected: true`를 반환했다. 기존 8765/8000/5173 Stack 프로세스는 식별만 하고 변경하지 않았다.
- 남은 문제: HTTPS reverse proxy와 실제 인증서를 사용한 WSS 운영 배포 검증, Browser 화면에서의 연결 상태
  표현 확인은 별도 배포/UI 시나리오로 남아 있다.
