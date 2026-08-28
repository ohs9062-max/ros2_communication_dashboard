# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

## 2026-08-27 - Camera node 종료 Alert의 Topic 탭 표시 경로 점검

- 코드만 점검했다. `TopicsPage`의 Topic Alert preview는 `source`가 `topic` 또는 `monitor_status`인 Alert만
  표시하고, Overview/Alerts 탭은 전체 Alert를 표시한다. 따라서 camera node 종료로 발생한 `node_stale`
  (`source=node`) Alert는 Overview와 Alerts에는 보이지만 Topic 탭에는 의도적으로 나타나지 않으며 Nodes 탭의
  Alert preview 대상이다. 실행 중인 local Backend가 없어 당시 활성 Alert payload의 source/code는 API로 재확인하지
  못했다.

## 2026-08-27 - Node 종료 Alert를 관련 Topic Alert에 표시

- Topic 탭은 `node_stale` Alert를 마지막으로 보존한 해당 Node의 Topic Publisher/Subscriber 관계에 투영해
  함께 표시한다. 표시 항목은 연결된 Topic의 `resource_key`와 Domain을 사용하므로, 클릭하면 그 Topic 상세가
  열리고 같은 이름의 다른 ROS Domain Topic으로 섞이지 않는다. Monitor/Backend Alert 원본과 Alert DB lifecycle은
  변경하지 않았다.
- Camera node 종료 및 multi-domain 분리 단위 test를 추가했고 Frontend `npm run test:unit`, `npm run lint`
  (기존 VisualizationPage 미사용 인자 warning 1건), `npm run build`, `git diff --check`를 통과했다.
- 빌드 산출물의 `/var/lib/ros2-dashboard/frontend` 동기화는 현재 세션에서 sudo 인증 TTY가 없어 완료하지 못했다.

## 2026-08-27 - 네 통신 목록 Domain 필터

- Topic·Service·Action·Node 목록에 공통 Domain 필터 그룹(기본 `전체`, `D<id>` 버튼)을 추가했다. 목록은 선택한
  resource의 `domain_id`만 남기며 기존 이름·타입·`D<number>` 검색, 상태/숨김 필터는 그대로 함께 적용된다.
- Frontend는 YAML을 읽지 않고 App-level `/ros/domains` polling의 `configured_domain_ids`로 버튼을 만들며,
  Domains 화면에서 추가/삭제한 ID는 다음 polling에서 자동 반영된다. 선택된 Domain이 삭제되면 `전체`로 복귀한다.
  Monitor·Backend·multi-domain runtime 로직은 변경하지 않았다.
- Domain 필터 단위 test를 추가했고 Frontend `npm run test:unit`, `npm run lint`(기존 VisualizationPage warning 1건),
  `npm run build`, `git diff --check`를 통과했다.

## 2026-08-27 - Local HTTPS 정적 파일 반영

- GUI `pkexec` 인증으로 절대 source 경로
  `/home/hs/rang/ros2_dashboard/frontend/dist/`를 `/var/lib/ros2-dashboard/frontend/`에 rsync 동기화했다.
  첫 상대경로 시도는 권한 상승 후 working directory가 `/root`가 되어 실패했으며, 두 번째 절대경로 반영은 성공했다.
- source build의 entry asset은 `assets/index-BQEhk09P.js`다. 당시 `https://localhost/` 응답은 없어서 Nginx 실행 여부에
  따른 실제 HTTPS asset 대조는 수행하지 못했다.

## 2026-08-27 - Topic·Service·Action·Node 상태 필터 단순화

- 상태 판정, Alert와 개별 상태 배지를 바꾸지 않고 목록 필터 UI만 큰 분류로 정리했다. Topic은
  `주요 항목/전체/대기 중/정상/문제`, Action은 `주요 항목/전체/실행 중/성공/실패·취소`, Service는
  `주요 항목/전체/대기 중/정상/문제`, Node는 `주요 항목/전체/정상/문제`로 표시한다.
- Topic의 `전체`는 기존 숨김 포함 동작까지 합치고, `문제`는 active가 아닌 상태와 미지원 type을 모두 포함한다.
  Service의 전체/상태 그룹은 기존 internal 포함 fetch를 사용하며, Node의 전체/상태 그룹도 내부 Node를 포함한다.
  Domain 필터와 이름/type/Domain 검색은 그대로 조합된다.
- Frontend unit test, lint(기존 VisualizationPage warning 1건), build, diff check를 통과했고 GUI `pkexec`으로
  새 `frontend/dist`를 `/var/lib/ros2-dashboard/frontend/`에 동기화했다.

## 2026-08-27 - Alert 영문 원문 표시 복구 및 오류 필터 표기 통일

- 네 목록의 aggregate filter label `문제`를 모두 `오류`로 변경했다. 내부 filter ID와 상태 판정은 바꾸지 않았다.
- Monitor의 Topic/Service/Node Alert source가 영어 `message`를 생성하는 것을 확인했다. 회귀 원인은 Node 종료
  Alert를 Topic 탭에 투영할 때 Frontend가 새로운 한글 message를 덮어쓴 것이었다. 해당 mapping은 원본
  `alert.message`를 그대로 보존하도록 고쳤고, Alert preview와 Alert 목록도 message에 `displayText` formatter를
  적용하지 않고 raw Alert message를 렌더링하도록 수정했다. source/level 표기, Domain 표기와 3건+펼치기 UI는 유지했다.
- mapping 원문 보존 unit test를 포함한 Frontend unit test, lint(기존 VisualizationPage warning 1건), build, diff
  check를 통과했고 GUI `pkexec`으로 build를 로컬 HTTPS 정적 경로에 동기화했다.

## 2026-08-27 - 네 목록 Filter toolbar 한 줄 배치

- Topic·Service·Action·Node 공통 toolbar CSS만 변경했다. 검색 input은 좌측, Domain group은 가운데의 남는 flex 폭,
  status group은 우측에 배치하며 Domain과 상태 사이에는 구분선·여백을 둔다. 760px 이하에서는 기존 반응형 세로
  전환과 Domain 상단 구분선을 유지한다.
- 필터 DOM/동작, Domain 목록 API/polling, resource filtering은 변경하지 않았다. Frontend lint(기존 VisualizationPage
  warning 1건), build, diff check를 통과했고 GUI `pkexec`으로 build를 local HTTPS 정적 경로에 동기화했다.

## 2026-08-27 - Alert message source 원문 직접 표시 재검증

- 최근 Alert 관련 diff와 `e8a4d5b`(`alert 영문통일, ui`) 이력을 대조했다. Monitor의 code별 Alert source가
  `Topic connection lost; it is no longer visible in the ROS2 graph.`,
  `Monitored Node is confirmed absent from the ROS2 graph.` 등의 message를 생성하고 Backend/DB가 이를 재작성하지
  않는 것을 확인했다.
- `AlertsPreview`와 `AlertsList`는 formatter와 fallback 없이 `alert.message`를 직접 렌더링한다. Node Alert를 Topic에
  투영하는 presentation mapping에서도 `message` key 재지정을 완전히 제거해 spread로 받은 원문만 유지한다.
  Alert code/lifecycle/DB와 상태 배지, resource+Domain, 한 줄 배치, 3건+펼치기 UI는 변경하지 않았다.
- Frontend unit test, lint(기존 VisualizationPage warning 1건), build, diff check를 통과했고 GUI `pkexec`으로
  build를 local HTTPS 정적 경로에 동기화했다.

## 2026-08-27 - Terra 이후 Topic Alert 중복 투영 원복

- git history와 `git blame`을 대조해 `topic_disconnected`의
  `Topic connection lost; it is no longer visible in the ROS2 graph.`와 `node_stale`의
  `Monitored Node is confirmed absent from the ROS2 graph.`가 각각 2026-07-24 이전부터 존재한 원본 source message임을
  확인했다. Monitor Topic/Service/Action/Node/QoS Alert 생성 문자열과 code/lifecycle은 수정하지 않았다.
- 최근 `5cc0349`에서 추가된 `topicAlertMapping`이 `node_stale` Alert를 관련 Topic마다 새 id/resource로 복제해,
  원래 `topic_disconnected`와 같은 Topic Alert preview에 함께 표시한 것이 중복 원인이었다. 이 mapping과 test,
  TopicPage 호출 및 불필요한 nodeItems 공개만 제거해 Topic 탭은 원래 `topic|monitor_status` source만 사용한다.
  UI에서 결과를 숨기는 조건이나 Alert source dedupe는 추가하지 않았다.
- Alert message renderer는 source의 `alert.message`를 그대로 사용한다. Frontend unit test, lint(기존 VisualizationPage
  warning 1건), build, diff check를 통과했고 GUI `pkexec`으로 local HTTPS 정적 경로에 동기화했다. 당시 localhost
  Backend/Nginx 응답이 없어 live Alert payload 재확인은 수행하지 못했다.

## 2026-08-27 - Alert 원복 build 재반영

- 사용자 요청에 따라 GUI `pkexec` 인증을 다시 받아 현재 `frontend/dist`를 local HTTPS 정적 경로에 재동기화했다.
  source/target `index.html` SHA-256이 `d681cda7107e0b9a9e62d822b0d752674565c4925504ec75b1e29fdf9965a722`,
  entry asset이 `assets/index-BAzpAJCn.js`로 일치함을 확인했다.

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

