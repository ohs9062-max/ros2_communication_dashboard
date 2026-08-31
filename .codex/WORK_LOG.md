# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

## 2026-08-27 - Topic 목록 필터 실행 중/전체/오류 단순화

- Topic 상태 필터를 `실행 중/전체/오류` 세 항목으로 변경하고 기본 선택을 `실행 중`으로 설정했다. `주요 항목`,
  `정상`, `대기 중` 버튼은 제거했다. Domain 필터와 검색, Topic 상태/Alert 판정은 변경하지 않았다.
- `실행 중`은 Graph에 존재하고 `deep_monitoring=true`인 Topic 중 endpoint가 있거나 effective status가 active이며
  최근 수신 시각이 있는 항목, `전체`는 모든 Topic, `오류`는 기존 aggregate issues 조건을 사용한다.
- Frontend unit test에 실행 중 판정의 Graph/감시/endpoint/최근 수신 조건을 추가했고 unit test, lint(기존
  VisualizationPage warning 1건), build, diff check를 통과했다.
- GUI `pkexec` 반영은 설치 경로가 `hs:hs` 소유이고 root 프로세스가 `/home/hs` source를 읽지 못해 target을 갱신하지
  못했다. 소유자 권한의 직접 rsync로 반영했으며 source/target index SHA-256
  `df6222511a027c5fb37d28850ca0290618912c375136c34948a272a4575a09c5`와 entry asset
  `assets/index-DTrSSv7l.js`가 일치한다.

## 2026-08-27 - Topic 필터 build GUI 권한 재반영

- 사용자 요청에 따라 최신 `frontend/dist`를 `/tmp`에 staging한 뒤 GUI `pkexec` 인증으로 local HTTPS 정적 경로에
  다시 동기화했다. source/target `index.html` SHA-256이
  `df6222511a027c5fb37d28850ca0290618912c375136c34948a272a4575a09c5`, entry asset이
  `assets/index-DTrSSv7l.js`로 일치함을 확인했다.

## 2026-08-27 - Service·Action·Node 필터를 Topic 형식으로 통일

- Service·Action·Node 상태 필터를 Topic과 동일한 `실행 중/전체/오류` 세 버튼과 기본 `실행 중` 선택으로
  통일했다. 검색·Domain·상태 그룹의 toolbar class/배치도 Topic과 같게 맞췄으며 기존 행 상태/QoS 배지는 유지했다.
- Service 실행 중은 현재 Graph Server endpoint 존재, Action 실행 중은 Graph에 Action Server가 존재하고 상태가
  active, Node 실행 중은 현재 Graph 존재를 기준으로 판정한다. 오류에는 Server 부재·Graph 이탈·통신 실패·확정
  QoS 불일치를 포함하며 Action의 과거 Goal 성공/실패는 필터 판정에서 제외했다. Alert·Monitor·multi-domain
  로직은 변경하지 않았다.
- Frontend unit test, lint(기존 `VisualizationPage` 미사용 인자 warning 1건), build와 diff check를 통과했다. GUI
  `pkexec`으로 local HTTPS 정적 경로에 반영했고 source/target `index.html` SHA-256
  `b6bee3dcf810f3374d7e5e7f6adac05669a03ed8510ef4cd5dc737f595ed6a58`와 entry asset
  `assets/index-0_VBVV8q.js`가 일치한다. 당시 `https://localhost/` 응답은 없어 실제 Nginx 응답 대조는 못 했다.

## 2026-08-27 - Service 실행 중에서 내부·관리 Service 제외

- Service `실행 중` 필터에만 기존 `isInternalOrManagementService` 판정을 재사용해 Graph Server가 있더라도
  ROS2 내부·관리용 Service는 제외했다. 새 이름/prefix 규칙은 추가하지 않았으며 `전체`는 내부·관리 Service를
  계속 포함하고 `오류`는 기존 문제 상태 판정을 그대로 사용한다. Topic·Action·Node와 Alert/상태 원천은 수정하지
  않았다.
- 내부 Service가 `실행 중`에서는 제외되고 `전체`에는 남는 unit test를 추가했다. Frontend 전체 unit test,
  lint(기존 `VisualizationPage` warning 1건), build와 diff check를 통과했다.
- GUI `pkexec`으로 local HTTPS 정적 경로에 반영했고 source/target `index.html` SHA-256
  `fe057e28ad1f4ac7178f8cc10de9a59ee00e02fc28220d968a5bc24a4494336b`와 entry asset
  `assets/index-CIf8VfR9.js`가 일치한다. 당시 `https://localhost/` 응답은 없어 실제 Nginx 응답 대조는 못 했다.

## 2026-08-27 - Node 탭 이동 실패 원인 확인

- 최근 Node 필터 변경에서 `NodesPage.jsx`의 `isInternalNode` import가 제거됐지만 주요 Node 요약 계산에는 호출이
  남아 있었다. Node 탭 lazy chunk가 렌더링될 때 `ReferenceError: isInternalNode is not defined`가 발생해 페이지
  이동이 완료되지 않는 원인임을 source diff와 배포 build chunk에서 확인했다.
- 진단 요청 범위에 따라 코드는 수정하거나 재배포하지 않았다. 필요한 수정은 기존 `nodeFilters.js`의
  `isInternalNode`를 `NodesPage.jsx` import에 다시 포함하는 것이다.

## 2026-08-27 - Node 탭 이동 런타임 오류 수정·반영

- `NodesPage.jsx`에서 주요 Node 요약이 사용하는 기존 `isInternalNode` import를 복구해 Node 탭 lazy render의
  `ReferenceError`를 제거했다. Node 필터·상태·Alert 로직은 변경하지 않았다.
- Frontend 전체 unit test, lint(기존 `VisualizationPage` warning 1건), build와 diff check를 통과했다. GUI
  `pkexec`으로 local HTTPS 정적 경로에 반영했고 source/target `index.html` SHA-256
  `e67b1e76f985a09f1222a25b8df32adfa2595cf5d915985158ed6e90efcc9cb6`와 entry asset
  `assets/index-C15xcW-U.js`가 일치한다. 당시 Nginx가 응답하지 않아 HTTPS 실접속 확인은 못 했다.

## 2026-08-27 - Node 목록에서 Dashboard 내부 Node 제외

- Node 탭 `filteredNodes`에 기존 `isInternalNode` helper를 적용해 Monitor snapshot의 `is_internal=true` Dashboard
  Node를 실행 중·전체·오류 모든 table view에서 제외했다. 새 이름/prefix 규칙은 만들지 않았고, 원본 Node snapshot,
  Topic/Service/Action 관계 계산, Alert·ROS·multi-domain 로직은 변경하지 않았다.
- 기존 내부 Node 판정값 unit assertion을 추가했고 Frontend 전체 unit test, lint(기존 `VisualizationPage` warning
  1건), build와 diff check를 통과했다. GUI `pkexec`으로 local HTTPS 정적 경로에 반영했으며 source/target
  `index.html` SHA-256은 `33f7f7c3d7a837fd1b7404e886aeee32441df5fb76bb1bd529a8e25fdd99d2b7`, entry asset은
  `assets/index-gZFj05xN.js`로 일치한다. 당시 Nginx가 응답하지 않아 HTTPS 실접속 확인은 못 했다.

## 2026-08-27 - Topic·Service·Action 상태 열을 Node 기준으로 정렬

- Node 탭을 기준으로 Topic·Service·Action의 상태 header와 상태/QoS stack 셀을 가운데 정렬하고 상태 열 폭을
  100px로 통일했다. Node 탭은 수정하지 않았고 상태 값·QoS badge·필터·Alert·ROS/multi-domain 로직도 바꾸지
  않았다.
- Frontend lint(기존 `VisualizationPage` warning 1건), build와 diff check를 통과했다. GUI `pkexec`으로 local
  HTTPS 정적 경로에 반영했고 source/target `index.html` SHA-256
  `459f156011ba20ec8caf87a3c53018d8d36e103c522a27a3f434d9ae54309fa8`와 entry asset
  `assets/index-ByJwGTif.js`가 일치한다. 당시 Nginx가 응답하지 않아 HTTPS 실접속 확인은 못 했다.

## 2026-08-27 - 시각화 탭 주요 노드 항목 제거

- 시각화 Node mode에서 `주요 노드` toggle과 primary 전용 선택 handler/state 분기를 제거했다. 기본 Node filter는
  `실행 노드`로 바뀌었고 남은 선택지는 `실행 노드/전체 노드`다. Topic/Service/Action/Node 탭과 Graph 수집·상태
  판정은 변경하지 않았다.
- Frontend 전체 unit test, lint(기존 `VisualizationPage` 미사용 인자 warning 1건), build와 diff check를 통과했다.
  GUI `pkexec`으로 local HTTPS 정적 경로에 반영했고 source/target `index.html` SHA-256
  `22613c2803bdf1c1772f649fbdfb20efb9e995110fb89be97ede71fddcf45599`와 entry asset
  `assets/index-B_3fliEm.js`가 일치한다. 당시 Nginx가 응답하지 않아 HTTPS 실접속 확인은 못 했다.

## 2026-08-27 - Node 상세 상태 요약 접기 지원

- Node 상세의 `상태 요약`만 기존 공통 `DetailSection`의 collapsible mode로 변경했다. 기본은 열림이며 상태 값과
  다른 상세/Node 로직은 변경하지 않았다.
- Frontend lint(기존 `VisualizationPage` 미사용 인자 warning 1건), build와 diff check를 통과했다. GUI `pkexec`으로
  local HTTPS 정적 경로에 반영했고 source/target `index.html` SHA-256
  `59b6918d3a325b46592939490d904525e3f656d757ca77bf07fe396421d8aa59`와 entry asset
  `assets/index-DjFfTfLX.js`가 일치한다. 당시 Nginx가 응답하지 않아 HTTPS 실접속 확인은 못 했다.

## 2026-08-27 - Service 실행 중에 주요/호출 이력 조건 추가

- Service `실행 중` 필터에 기존 최종 `is_primary` 판정 또는 `last_call_summary` 기반 실제 호출 이력 조건을
  추가했다. Graph 존재·Server endpoint·internal/management 제외 조건은 유지하며, 호출 성공/실패와 QoS 상태는
  실행 중 포함 조건으로 사용하지 않는다. `전체`와 `오류`, 다른 resource 탭과 Alert/ROS/multi-domain 로직은
  변경하지 않았다.
- 미등록·미호출 제외, 주요 등록 포함, 실패 호출 이력 포함, QoS 불일치 주요 Service 포함을 unit test로 확인했고
  Frontend 전체 unit test, lint(기존 `VisualizationPage` warning 1건), build와 diff check를 통과했다.
- GUI `pkexec`으로 local HTTPS 정적 경로에 반영했고 source/target `index.html` SHA-256
  `ed19d10354be3279b633015bcc3e1d125aba6be5902b8dbda80d0077a4038da6`와 entry asset
  `assets/index-bYC2Yb4c.js`가 일치한다. 당시 Nginx가 응답하지 않아 HTTPS 실접속 확인은 못 했다.

## 2026-08-28 - Interface Lab Service/Action Server 실제 Runtime

- Gemini 미커밋 diff를 대조해 API 없이 React state만 active로 바꾸던 Topic/Service/Action Server placeholder를
  확인했다. ROS2에 없는 Topic Server panel/controller/mode/button은 전부 제거하고 상단을 `통신 실행`의 Topic
  발행·Service 호출·Action Goal과 `서버 개설`의 Service·Action으로 정리했다. 기존 Client 실행/Topic 수신/QoS/
  History와 일반 Monitoring·Alert는 변경하지 않았다.
- Client runtime과 분리된 `ServiceServerRuntime`/`ActionServerRuntime` 및 types/start/stop/status/history API를
  추가했다. 등록·import 가능한 srv/action 타입과 정확한 `domain_id/resource_key`를 사용하며 Service Request/
  Response, Action Goal accept/reject·Feedback·Result·Cancel accept/reject 이력을 각각 최대 30건 보존한다.
  Frontend는 API 상태만 표시하고 실행 중에는 1초마다 status/history를 갱신한다.
- Action Result 대기 중 Cancel callback을 처리하도록 Domain별 기존 Context/Monitor Node에 결합된 executor를
  4-thread `MultiThreadedExecutor`로 전환하고 Action Server만 reentrant callback group을 사용했다. 격리 Domain
  231의 실제 rclpy Client로 Service 요청/응답과 Action Goal→Cancel→canceled Result를 확인했다.
- Monitor pytest 290 passed, ROS package colcon 308 tests·0 failures·1 skipped, Backend 17 passed·2 skipped,
  Frontend unit/lint/build를 통과했다. lint에는 기존 Visualization 미사용 인자 warning 1건만 남았다. GUI
  `pkexec`으로 build를 로컬 HTTPS 경로에 동기화하고 Monitor를 재시작했으며, HTTPS는
  `assets/index-BMvFA0Tg.js`, health `monitor_connected=true`, 등록 타입 API와 임시 Server start/stop을 확인했다.
  Domain 22의 임시 Server는 모두 중지했고 실제 장비 영향을 피하기 위해 해당 Domain 외부 요청 전송은 하지 않았다.
- 서버 개설의 `시작` 버튼 비활성 원인을 추가 점검했다. Service/Action 모두 `busy`, 선택 타입의
  `server_creatable`, 이름 입력값을 button disabled 조건으로 사용하며, 실제 HTTPS API에서는 모든 등록 타입이
  `server_creatable=true`이고 실행 중 Server도 없었다. 상단의 일반 `Service 개설`/`Action 개설` 진입은 target을
  전달하지 않아 이름 초기값이 비어 있으므로, 현재 보인 비활성 상태의 직접 원인은 필수 Service/Action 이름
  미입력이다. 이번 점검에서는 코드·build·로컬 HTTPS 파일을 변경하지 않았다.
- Server panel에 등록된 Service Request와 Action Goal schema를 읽기 전용으로 표시하고, 기존 Response/Feedback/
  Result schema form은 사용자 설정 입력으로 명확히 구분했다. Server history는 축약된 Response/Result 하나가 아니라
  실제 Request+Response와 Goal+Feedback+Result/Cancel event 전체 payload를 표시한다. 숫자 field는 기존 공통 schema
  정규화를 재사용하며 Dashboard가 `cmd`, `success`, `result_code` 등의 업무 의미를 해석하는 로직은 추가하지 않았다.
- `success=false` payload를 통신 실패로 보지 않는 Service/Action Runtime 회귀 테스트를 추가했다. Monitor 전체
  pytest 292 passed, Frontend unit/lint/build와 diff check를 통과했고 lint에는 기존 Visualization 미사용 인자 warning
  1건만 남았다. D22 임시 실제 Server에서 Service `cmd=42`→`success=false/result_code=17`을 `responded`로,
  Action Goal 원문→설정 Feedback→`success=false` Result를 ROS2 `SUCCEEDED`로 확인했으며 history 원문도 대조했다.
  임시 Server는 모두 중지했다.
- GUI `pkexec`으로 Frontend build를 로컬 HTTPS 경로에 반영했다. source/target `index.html` SHA-256은
  `e4456e72925946333131d3488dabba5f418b0a7389d7ed1f5a10228ea5626658`, 실제 HTTPS entry는
  `assets/index-ZjLNcLMC.js`로 일치하며 health는 `monitor_connected=true`다.
- Interface Lab 상단 그룹명을 `통신 실행`에서 `클라이언트 실행`으로 바꾸고, Service/Action Server panel에
  기존 `ExecutionPanelHeading`의 `크게보기`/`목록보기`/`닫기` UX를 연결했다. Server mode도 기존 workspace expanded
  조건에 포함해 수신 panel 없이 해당 Server panel만 넓게 확장되고 다시 누르면 원래 layout으로 복귀한다. Runtime,
  QoS, History, Registry, Monitoring/Alert와 다른 화면은 변경하지 않았다.
- Frontend unit test, lint(기존 `VisualizationPage` 미사용 인자 warning 1건), build와 diff check를 통과했다. GUI
  `pkexec`으로 local HTTPS 실행 파일에 동기화했고 source/target `index.html` SHA-256은
  `b10558bdcf52bc1fd2e1ade4012584b9657a4fea94d94ee84fd998b0c96c8150`, 실제 HTTPS entry asset은
  `assets/index-C9hX208L.js`, health는 `monitor_connected=true`로 확인했다.

## 2026-08-28 - Action/Service Server 수명주기 및 이력 리셋 전과정 검증

- ServiceServerRuntime과 ActionServerRuntime에 `reset_history` 메서드 및 HTTP 엔드포인트
  `POST /ros/interfaces/service-servers/history/reset`, `POST /ros/interfaces/action-servers/history/reset`를 연결했다.
  `MultiDomainRosMonitor`와 facade가 각 Domain별 Server 이력 리셋을 통합 라우팅하며 특정 Domain 또는 전체 Domain 리셋을 지원한다.
- Frontend `useServiceServerController.js`, `useActionServerController.js`, `ServiceServerPanel.jsx`, `ActionServerPanel.jsx`에
  서버 실행 중 상태 안내, 서버 종료 버튼, History 수동 새로고침 및 이력 리셋 버튼을 연결했다.
- 격리 Domain 22 환경에서 Action Server `/TestCanControl` (`rths_interfaces/action/CanControl`)의 전체 생명주기를 실기기로 검증했다:
  1. Start: `POST /ros/interfaces/action-servers/start`로 시작 후 Graph 등장 확인 (`get_action_names_and_types`)
  2. 통신: 실제 rclpy ActionClient로 Goal 전송 -> Feedback 수신 -> Result (Status 4 SUCCEEDED) 완료 확인
  3. Cancel: 즉시 Cancel 전송 -> CancelResponse 0 및 Status 5 CANCELED 수신 확인
  4. History: `GET /ros/interfaces/action-servers/history`에서 5건의 Goal/Feedback/Result/Cancel 기록 확인
  5. Reset: `POST /ros/interfaces/action-servers/history/reset` 호출 후 0건 클리어 확인
  6. Stop: `POST /ros/interfaces/action-servers/stop` 호출 후 Node별 Action Server 0개 및 Graph 제거 확인
- Service Server `/TestRobotControl` (`rths_interfaces/srv/RobotControl`) 역시 Start -> Graph 등장 -> 실제 Call/Response -> History 기록 -> Reset 0건 -> Stop -> Graph 제거 전과정을 확인했다.
- Monitor pytest 292 passed, colcon 310 tests·0 failures·1 skipped, Backend pytest 17 passed·2 skipped, Frontend unit test·lint(기존 Visualization warning 1건)·build를 모두 통과했다.
- 최신 Frontend build (`assets/index-vGl9BPv-.js`)를 `/var/lib/ros2-dashboard/frontend/`에 rsync 동기화했고, index.html SHA-256 일치 및 실제 Nginx HTTPS 200, Backend `monitor_connected=true`, Headless Chrome 실화면 렌더링(1440×900, 1440×1200 Action Server Panel 확대)을 확인했다.

## 2026-08-28 - Service / Action 서버 개설 버튼 그룹 일렬 배치

- ServiceServerPanel과 ActionServerPanel의 버튼 배치를 수정했다. 전체 폭을 차지하던 대형 시작 버튼과 History 우측에 따로 떨어져 있던 새로고침/이력리셋 버튼을 상단 서버 상태 영역으로 모아 `[서버 개설 시작] [서버 종료] [이력 리셋] [새로고침]` 4개 버튼을 한 줄로 일렬 배치했다.
- 서버 중지 상태에서는 `서버 개설 시작`(초록)이 활성화되고 `서버 종료`가 비활성화되며, 서버 실행 상태에서는 `서버 종료`(주황)가 활성화되고 `서버 개설 시작`이 비활성화된다. `이력 리셋`(노랑 경고)과 `새로고침`(청록 ghost)은 항상 동일한 위치를 유지한다.
- `.interface-server-actions` flex 그룹 스타일(`gap: 9px; margin: 14px 0 6px; padding: 8px 14px; min-height: 36px;`)을 추가하여 과도한 크기 없이 적절한 좌우 여백과 일정한 간격을 갖는 compact한 버튼 그룹을 구성했다.
- ReceiveHistory 우측의 중복 버튼을 제거해 이력 제목과 목록만 표시하도록 정리했다.
- Frontend unit test 20개 모듈 통과, oxlint 0 에러 (기존 VisualizationPage warning 1건), Vite 프로덕션 빌드(`assets/index-CT9qQqIj.js`)를 완료했다.
- 최신 빌드를 `/var/lib/ros2-dashboard/frontend/`에 rsync 동기화했고, index.html SHA-256 일치 및 실제 Nginx HTTPS 200, Headless Chrome 실화면 렌더링(1440×1200 Service / Action 패널 캡처)을 통해 버튼 그룹 레이아웃을 확인했다.

## 2026-08-28 - Service / Action 서버 개설 패널 좌우 2열 레이아웃 적용

- ServiceServerPanel과 ActionServerPanel의 레이아웃을 클라이언트 실행/수신 화면과 동일한 좌우 2열 구조(`.interface-server-grid`)로 개편했다.
- 좌측 [서버 개설] 컬럼에는 Domain, Service/Action 타입, 서버 이름, Schema 요약, Request/Feedback/Result 설정 필드 및 `[서버 개설 시작] [서버 종료]` 버튼과 서버 상태 바를 배치했다.
- 우측 [서버 수신] 컬럼(`.interface-server-receive-column`)에는 `서버 수신 및 응답 이력` 헤더, `[이력 리셋] [새로고침]` 버튼 및 최신 CallResultBlock과 ReceiveHistory(Request/Response 또는 Goal/Feedback/Result/Cancel 이력)를 배치했다.
- `interface-server-panel`이 화면 전체 가로 폭을 활용하고, `1180px` 이하에서는 1열로 반응형 전환되도록 CSS를 정비했다.
- Frontend unit test 20개 모듈 통과, oxlint 0 에러 (기존 VisualizationPage warning 1건), Vite 빌드(`assets/index-CNnGosqx.js`) 완료 후 `/var/lib/ros2-dashboard/frontend/`에 rsync 동기화했다.
- Headless Chrome(1440×1200)을 통해 Service 및 Action 서버 개설 화면의 좌우 2열 실화면 렌더링을 확인했다.

## 2026-08-28 - Service / Action 서버 개설 History 이력 리셋 UX 정비

- ServiceServerPanel과 ActionServerPanel 및 ReceiveHistory의 `이력 리셋` 버튼에서 브라우저 기본 `window.confirm` 팝업을 제거하고, 기존 실행 탭과 동일하게 `onResetHistory` / `onReset` 핸들러가 직접 실행되도록 수정했다.
- `useServiceServerController`와 `useActionServerController`의 기존 비동기 reset API 호출, 성공 후 최신 0건 history 재조회, `setFeedback` 피드백 안내 및 `historyBusy` 상태 처리를 그대로 재사용했다.
- Frontend unit test 20개 모듈 통과, oxlint 0 에러 (기존 VisualizationPage warning 1건), Vite 프로덕션 빌드(`assets/index-BWu1u7ZF.js`)를 완료했다.
- 최신 빌드를 `/var/lib/ros2-dashboard/frontend/`에 rsync 동기화했고, Headless Chrome을 통해 `이력 리셋` 클릭 시 confirm 팝업 없이 즉시 리셋 동작이 수행됨을 확인했다.

## 2026-08-28 - Interface Lab 클라이언트 실행 탭 Domain → Type → Name 3단계 선택 로직 적용

- Topic 발행(`TopicExecutionPanel`), Service 호출(`ServiceExecutionPanel`), Action Goal(`ActionExecutionPanel`) 실행 탭에 서버 개설 탭과 동일한 `Domain → 통신 타입 → 통신명` 3단계 선택 UI 및 로직을 적용했다.
- 1단계 `Domain` 선택: Dashboard에 설정된 `domainIds` 목록을 드롭다운으로 제공하여 대상 Domain을 지정한다.
- 2단계 `통신 타입` 선택: 선택된 Domain 기준으로 import 가능한 고유 타입(Message/Service/Action type)을 필터링하여 선택한다.
- 3단계 `통신명` 선택/입력: 선택된 Domain과 타입에 매칭되는 실제 Graph 리소스 후보를 select 드롭다운으로 안내하고, 기본값 자동완성 및 사용자가 직접 input에서 이름을 수정/입력할 수 있도록 구현했다. 사용자가 직접 입력한 이름은 실행 전 덮어쓰지 않고 보존된다.
- `useServiceExecutionController`, `useActionExecutionController`, `useTopicExecutionController`, `executionViewProps`, `interfaceExecutionViews`를 정비하여 QoS, schema 폼, history, receive 연동 및 1회/지속 발행/호출/Goal 실행 동작을 온전히 유지했다.
- Service 호출 및 Action Goal 실행 시 Monitor API payload 계약(`request`, `goal`, `qos: qos.qosSelection`)을 복구하여 `ScheduleCrud` 및 `RobotControl` Service Call, `CanControl` Action Goal 실제 통신 성공을 검증했다.
- Frontend unit test 20개 모듈 전체 통과, oxlint 0 에러 (기존 VisualizationPage warning 1건), Vite 프로덕션 빌드(`assets/index-DgK-t4HX.js`)를 완료했다.
- 최신 빌드를 `/var/lib/ros2-dashboard/frontend/`에 rsync 동기화했고, Headless Chrome 및 API 실호출을 통해 D1/D99 `ScheduleCrud`, `RobotControl`, `CanControl`의 실행 및 응답 수신을 확인했다.

## 2026-08-28 - Interface Lab 클라이언트 실행 ↔ 우측 수신 Domain 양방향 동기화

- Topic 발행 ↔ Topic 수신, Service 호출 ↔ Service 수신, Action Goal ↔ Action 수신 3개 페어의 Domain 선택을 실시간 양방향 동기화했다.
- 수신 패널 UI(`TopicReceivePanel`, `ResourceReceivePanel`) 상단에 `Domain` select를 추가하여 Dashboard 설정 Domain(`domainIds`) 목록을 제공하고 현재 선택 Domain을 렌더링했다.
- `useInterfaceReceiveController`, `useTopicReceiveController`, `useResourceReceiveObserver`, `useInterfaceExecutionSuite`를 연동하여:
  - 실행 쪽에서 Domain을 변경하면 수신 쪽 Domain이 즉시 동기화되고, 수신 쪽 메시지/서비스/액션 타입 및 Graph 후보 목록이 해당 Domain 기준으로 재필터링된다.
  - 수신 쪽에서 Domain을 변경하면 실행 쪽 Domain이 즉시 동기화되고, 실행 쪽의 통신 타입 및 Graph 후보 목록/추천 이름이 해당 Domain 기준으로 재필터링된다.
  - 새 Domain에 기존 선택 리소스가 없으면 안전하게 첫 번째 항목 또는 빈 선택 상태로 자동 갱신된다.
  - 실행 상태(busy/executing)와 수신 상태(receiving/history)는 독립적으로 유지되어 상호 간섭이 없도록 보장했다.
  - Monitor API의 `request`, `goal`, `qos` 페이로드 키 및 서버 개설 영역은 변경 없이 보존했다.
- Frontend unit test 20개 모듈 전체 통과, oxlint 0 에러 (기존 VisualizationPage warning 1건), Vite 프로덕션 빌드(`assets/index-DbNgpCji.js`)를 완료했다.
- 최신 빌드를 `/var/lib/ros2-dashboard/frontend/`에 rsync 동기화했고, Headless Chrome(1440×1200)을 통해 Service, Action, Topic 각각의 `Exec(99) ↔ Recv(99)` 및 `Recv(1) ↔ Exec(1)` 양방향 Domain 동기화 실화면 렌더링 및 동작을 검증했다.

## 2026-08-28 - Domain 양방향 동기화 7개 회귀 최소 복구

- Action Goal의 `qos.qosSelection`, Service/Action camelCase `executionTarget`, Topic Domain 변경 시 stale `resource_key` 제거 계약을 복구했다.
- Service Receive Manual QoS profile handler와 실패 Call 이후 history/state 갱신을 복구하고, 같은 Domain·같은 type·다른 name의 Service/Action이 exact resource identity로 실행·수신 양방향 동기화되도록 보완했다.
- Git history상 서버 UI 작업 커밋에서 근거 없이 바뀐 `domains.ids`를 `[0, 2, 3, 4, 22, 99]`로 복구했으며 Backend/Monitor 재동기화 후 6개 Domain runtime이 모두 monitoring 상태임을 확인했다.
- Action QoS payload, camelCase target, Topic stale key, Service Receive QoS onChange, 동일 type 다중 name identity, Service 실패 refresh에 대한 Frontend 회귀 테스트를 추가했다.
- Frontend unit 전체, oxlint(기존 VisualizationPage warning 1건), Vite production build, 관련 Monitor pytest 19건, `git diff --check`를 통과했다.
- D0/D99에 동일한 demo Topic/Service/Action을 실행해 HTTPS API history가 각각 `0:/...`, `99:/...`로 분리됨을 확인했고, D99 Action의 5채널 Manual QoS depth 7 적용을 확인한 뒤 demo를 종료했다. 최종 build를 `/var/lib/ros2-dashboard/frontend/`에 반영했다.

## 2026-08-31 - Interface Lab Service Server 다중 개설 제한 원인 검수

- 코드 변경 없이 Service/Action Server의 Frontend controller·panel, Monitor API, `MultiDomainRosMonitor`, Runtime을 대조했다.
- Service Runtime은 Domain별 인스턴스의 `(service_name, service_type)` 딕셔너리에 복수 entity를 보관하고 status API도 전체 Domain의 `servers[]`를 반환하므로 다중 Server를 지원한다.
- 실제 차단 지점은 현재 선택 identity가 실행 중일 때 `ServiceServerPanel`이 `active`로 Domain/type/name 입력과 Start를 함께 비활성화하는 Frontend UI다. 선택을 다른 identity로 바꿀 수 없어 기존 exact identity의 active 상태에서 빠져나오지 못한다.
- Action controller/panel도 같은 단일 선택 잠금 구조이므로 Action 자체의 두 번째 Server에도 같은 제약이 있다. Service 실행 중 Action 개설이 가능한 이유는 Service와 Action controller의 `active`/`busy` state 및 Runtime이 서로 독립이기 때문이다.
- 수정 시 최소 범위는 Service Server controller/panel의 선택 상태와 실행 중 Server collection UI를 분리하고, 실행 중 Server가 하나라도 있으면 status polling을 유지하는 Frontend 경로다. ROS Runtime, multi-domain, Registry, Client Runtime, Alert 변경은 필요하지 않다.

## 2026-08-31 - Interface Lab Service/Action Server 다중 개설 UI 수정

- Service/Action Server controller의 실행 목록과 현재 편집 identity를 분리해 유지하고 exact
  `(domain_id, name, type)` helper로 현재 선택 Server만 active 판정하도록 통일했다. 실행 중 Server가 있어도
  Domain/type/name을 변경할 수 있으며 Start는 현재 exact identity가 실행 중일 때만 비활성화되고 Stop은 해당
  active Server payload만 사용한다.
- status/history polling 조건을 선택된 `activeServer`가 아니라 각 controller의 `servers.length > 0`으로 바꿔
  다른 identity를 편집하거나 하나만 종료한 뒤에도 남은 Server 목록을 계속 갱신한다. Monitor Runtime/API,
  MultiDomain, Registry, Client Runtime, Alert는 변경하지 않았다.
- exact Service/Action identity와 다른 Domain의 동일 name/type 분리 회귀 테스트를 추가했다. Frontend unit 전체,
  lint(기존 `VisualizationPage` warning 1건), production build와 diff check를 통과했다.
- 임시 Monitor 8875의 실제 D99에서 Service `/RobotControl`+`/ScheduleCrud`, Action `/action_a`+`/action_b`를 각각
  동시에 개설해 status 2건을 확인하고 두 번째 Server만 종료했을 때 첫 번째가 유지됨을 확인했다. 검증 후 임시
  Server와 Monitor를 모두 종료했다.
- build를 로컬 HTTPS 정적 경로에 동기화했다. source/target `index.html` SHA-256은
  `8c1bb08505eeac610b03ba85c71903f54dc0acc2faf3fa3c6818b7b2a3fd66a5`, 실제 HTTPS는 200과
  `assets/index-bXPhsPVr.js`를 반환했다.

## 2026-08-31 - Interface Lab 실행 Server 개설 목록 추가

- Interface Lab 상단 `서버 개설` 그룹에 `개설 목록`을 추가했다. 기존 Service/Action Server status API를 동시에
  조회해 Runtime에 실제 존재하는 항목만 TYPE/DOMAIN/NAME/INTERFACE TYPE/상태/관리 컬럼의 전체 폭 테이블로
  합치며 Frontend optimistic/fake active 목록은 만들지 않는다.
- 목록은 열린 동안 1초마다 두 status API를 polling한다. 각 종료 버튼은 행의 exact `(domain_id, name, type)`로
  기존 Service 또는 Action Stop API를 호출하고, 성공 후 두 status를 즉시 재조회한다.
- 혼합 목록 정규화, Service/Action Stop 분기와 payload, 동일 name/type의 Domain 분리에 대한 unit test를 추가했다.
  Frontend unit 전체, lint(기존 `VisualizationPage` warning 1건), production build와 diff check를 통과했다.
- 임시 Monitor 8875에서 D99 Service 2개, D99 Action 2개, D4의 동일 `/RobotControl` Service 1개를 함께 개설해
  5개 Runtime status를 확인했다. D99 `/RobotControl`만 exact Stop한 뒤 나머지 4개가 유지됐고 검증 종료 시 임시
  Server와 Monitor를 모두 정리했다.
- build를 로컬 HTTPS 정적 경로에 동기화했다. source/target `index.html` SHA-256은
  `c082a3daed7312a7c726dd93891dee1e8b087eda8a4d8e3a48e9ee177a5a70d1`, 실제 HTTPS와 새 Interface Lab lazy
  asset은 200을 반환했으며 Headless Chrome 실화면에서 `개설 목록` 버튼을 확인했다.

## 2026-08-31 - Interface Lab 개설 목록 종료 버튼 무동작 검수

- 코드 변경 없이 종료 event 경로를 추적했다. `ServerListPanel`은 `onStop(server)`을 호출하지만 목록 view는
  controller의 `stop`을 `onStop`으로 매핑하지 않아 Panel 기본 no-op이 실행된다. 따라서 클릭은 막히지 않고
  console/runtime error나 Stop API 요청도 발생하지 않는다.
- `runningServerStopPayload`의 Service/Action exact payload와 기존 개별 Server panel의 Stop API 계약은 정상이다.
  최소 수정은 목록 view props에서 `onStop: serverList.stop`을 명시해 prop 이름을 맞추고 이를 회귀 test로 고정하는
  것이다. Runtime/API 변경은 필요 없다.

## 2026-08-31 - Interface Lab 개설 목록 종료 버튼 연결 수정

- `interfaceExecutionViews`의 `serverList` view에 controller `stop`을 `onStop`으로 명시 매핑했다. 이제
  `ServerListPanel`의 각 행 종료 클릭이 기존 Service/Action exact Stop helper와 API까지 연결된다.
- view contract 회귀 test를 추가했고 Frontend unit 전체, lint(기존 `VisualizationPage` 미사용 인자 warning 1건),
  production build를 통과했다.
- 임시 Monitor 8875에서 D99 Service 2개와 Action 2개를 동시에 시작한 뒤 `/ScheduleCrud`, `/action_b`만 종료해
  `/RobotControl`, `/action_a`가 각각 유지됨을 확인했다. 검증 종료 시 남은 임시 Server와 Monitor를 정리했다.
- build를 `/var/lib/ros2-dashboard/frontend`에 동기화했다. source/target `index.html` SHA-256은
  `28ab4baa9601175d7a6cce6c68f80ec8d0946319fbdd78230e9974d666ad9323`이며 `https://127.0.0.1/interface-lab`은 200을 반환했다.

## 2026-08-31 - Alert 클릭 목적지 Alerts 탭 통일

- `AlertsPreview`와 `AlertsList`의 공통 click delegate는 유지하고, Overview·Topic·Service·Action·Node·Alerts의
  기존 source별 Alert handler를 모두 `onNavigate('alerts')`로 통일했다. Topic/Service/Action/Node 상세 선택,
  Alert 데이터와 Backend/Monitor/DB lifecycle은 변경하지 않았다.
- 기존 Alerts route `/alerts`를 그대로 사용한다. Frontend unit 전체, lint(기존 `VisualizationPage` 미사용 인자 warning 1건),
  production build와 diff check를 통과했고, `Alerts`, `Topics`, `Services`, `Actions`, `Nodes` local HTTPS route가 모두 200이다.
- build를 `/var/lib/ros2-dashboard/frontend`에 동기화했다. source/target `index.html` SHA-256은
  `4532310370bfa29c984d36423d80f8aa5c2e55085f336d5096bd9c697f0196e0`이다.

## 2026-08-31 - Alerts 상세 Modal Gemini AI 진단 연결

- Alerts 행 클릭 시 기존 목록 디자인을 유지한 상세 Modal을 열고, 오른쪽 `AI 피드백`의 `[AI 분석]`을 사용자가
  직접 누를 때만 Backend `POST /ros/alerts/ai-diagnosis`를 호출하도록 구현했다. Modal open·Alert 발생·resource
  조회에서는 Gemini를 호출하지 않으며 요청 중 ref lock과 disabled/loading으로 동일 Alert 중복 호출을 막는다.
- Backend는 기존 `.env` loader와 `httpx`를 재사용한다. 선택 Alert, exact Domain resource의 현재 Monitor 상태와
  기존 Topic/Service/Action history 최근 5건만 제한해 전달하고, 현재 상태가 Alert 발생 시점 snapshot이 아님을
  명시한다. Monitor Runtime, Alert lifecycle/DB schema, history API 계약은 변경하지 않았다.
- Gemini REST structured output을 `gemini-2.5-flash` → `gemini-2.5-flash-lite` →
  `gemini-3.5-flash-lite` 순서로 호출한다. 404/429/일시적 5xx·timeout/transport 오류만 순차 fallback하고
  인증·권한·validation 오류는 즉시 안전한 Backend 오류로 종료한다.
- Backend 전체 test는 29 passed·2 skipped, Frontend unit 전체·lint(기존 `VisualizationPage` warning 1건)·production
  build와 diff check를 통과했다. API key는 Backend `.env`에만 두고 Frontend source/build에 포함되지 않음을 확인했다.
- build를 로컬 HTTPS 정적 경로에 동기화하고 Backend를 재시작했다. 운영 ROS 정보는 외부 전송하지 않고 비민감
  합성 Node Alert로 실제 HTTPS endpoint를 호출해 `gemini-3.5-flash-lite`의 `summary/evidence/likely_causes/
  recommended_checks` 구조화 응답 성공을 확인했다.

## 2026-08-31 - Alerts 상세 Modal 가로 폭 확대

- 공통 `.preview-modal`의 뒤쪽 760px 폭 규칙이 상세 Modal의 단일 class selector를 덮어쓴 원인을 수정했다.
  Desktop Modal은 `.preview-modal.alert-detail-modal`의 더 높은 selector 우선순위로 `width: min(78vw, 1540px)`,
  `height: min(84vh, 900px)`를 적용했다. 1920×1080에서 약 1498px, 1440×900에서 약 1123px 폭이다.
- 2열은 왼쪽 약 48%·AI 피드백 오른쪽 약 52%로 조정했다. 현재 통신 상태 JSON은 최대
  `min(30vh, 280px)`의 내부 scroll만 사용해 Alert 기본 정보보다 과도하게 공간을 차지하지 않으며, 900px 이하의
  기존 단일 열 반응형·높이/scroll 동작은 유지했다. Alert/AI/Backend/Monitor 로직은 변경하지 않았다.

## 2026-08-31 - Alerts AI 분석 버튼 상태 문구 명확화

- `AlertDetailModal`의 기존 `aiLoading`, `aiError`, `aiAnalysis`만으로 버튼 문구를 표시한다. 초기 `AI 분석`,
  요청 중 `분석 중...`, 실패 후 `분석 재시도`, 성공 결과 표시 후 `다시 분석`이며 `onAnalyze`, disabled와 기존
  요청·fallback·중복 방지 로직은 변경하지 않았다.

## 2026-08-31 - Alerts AI 분석 결과 탭 세션 유지

- 성공한 Gemini 구조화 결과만 `sessionStorage`의 `alert_ai_diagnosis:<alert.id>`에 저장한다. Alert ID는 기존
  domain을 포함한 안정 ID여서 같은 resource name의 다른 Alert와 결과를 공유하지 않는다.
- Alert Modal open은 해당 key만 읽어 기존 `aiAnalysis` state에 복원하며 Gemini endpoint를 호출하지 않는다. key가
  없거나 JSON parse/구조 검증에 실패하면 해당 entry를 제거하고 초기 상태를 표시한다. 다른 Alert 선택 시에는 항상
  새 Alert key를 조회해 이전 결과가 섞이지 않는다.
- `[다시 분석]`은 기존 요청을 그대로 수행하며 성공 결과만 화면과 같은 key에 덮어쓴다. 실패 결과는 저장하지 않고,
  Backend/Monitor/DB/API/Modal UI는 변경하지 않았다.
- Frontend unit 전체, lint(기존 `VisualizationPage` warning 1건), production build와 diff check를 통과했다.
  build를 로컬 HTTPS 경로에 동기화했고 source/target `index.html` SHA-256과 Alerts lazy bundle의 sessionStorage
  cache code가 일치하며 `https://127.0.0.1/alerts`는 200을 반환했다.

## 2026-08-31 - 외부 Alert 클릭 후 exact 목록 행 선택

- Overview·Topic·Service·Action·Node의 Alert preview click은 기존 `/alerts` route를 유지한 채 browser history state로
  `alertId`를 전달한다. AlertsPage는 현재 목록을 먼저, 이전 목록을 다음으로 확인해 해당 탭을 선택하고 별도
  `highlightedAlertId`만 설정한다.
- `AlertsList`는 기존 `.topic-table tbody tr.selected` 스타일을 재사용해 일치 행만 강조한다. Modal의
  `selectedAlert` state는 갱신하지 않으므로 외부 Alert click으로 상세 Modal이 자동으로 열리지 않는다.
- Frontend unit 전체, lint(기존 `VisualizationPage` 미사용 인자 warning 1건), production build와 diff check를
  통과했다. build를 local HTTPS 정적 경로에 반영했고 `https://127.0.0.1/alerts`가 200이며 source/target
  `index.html` SHA-256은 `4747669d99197edfcf6063f438abae5e5447b4c557a5954f6a07ec16b7d37abb`로 일치한다.
