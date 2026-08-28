# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

## 2026-08-26 - Camera Topic live Preview

- 기존 1초 상세 polling과 callback의 0.5초 encode 간격을 Camera Preview 전용 100ms polling과 0.1초 minimum
  encode interval로 바꿨다. callback은 기존처럼 최신 metadata를 계속 갱신하며, live lease가 있을 때만 최신
  frame 하나를 Base64로 보관·응답한다. frame history, snapshot, Backend cache와 WebSocket에는 binary/Base64를
  넣지 않았다.
- `DELETE /ros/topics/image-preview`를 추가해 Camera 상세를 닫거나 다른 resource로 전환할 때 해당
  `domain_id/resource_key` runtime의 lease, encoded frame과 timestamp를 즉시 제거한다. 3초 lease는 browser가
  비정상 종료된 경우에만 cleanup fallback으로 남겼으며 MultiDomain 응답에도 Domain/resource key를 명시한다.
- Camera/Monitor config/router pytest 24건, Frontend unit·oxlint·Vite build, Monitor symlink build와 diff check를
  통과했다. GUI `pkexec` 인증으로 local HTTPS 실행 파일을 동기화하고 Monitor를 재시작했다. host에서 Monitor와
  Nginx가 모두 `active`이며 실제 Domain 99 `/image_raw`가 HTTPS GET에서 `ready` Base64 frame과
  `resource_key=99:/image_raw`를 반환하고 DELETE로 cache 해제 응답을 반환함을 확인했다.

## 2026-08-26 - 목록 Domain 검색

- Topic·Service·Action·Node의 기존 검색 값에 공통 `matchesResourceSearch()`를 적용했다. `D99`/`D5`처럼
  `D`+정수 전체를 입력하면 `domain_id`가 같은 resource만 남기고, 그 밖의 입력은 기존 이름/type 및 화면별
  보조 필드 substring 검색을 그대로 사용한다. Domain ID가 누락된 legacy resource가 `D0`으로 오인되지 않게
  명시적으로 제외했다.
- 네 목록의 검색 placeholder를 `이름 또는 타입, Domain 검색`으로 통일했다. 상태/주요/숨김·대기 등의 기존
  필터와 resource 선택 경로는 변경하지 않았다.
- 새 helper의 D99/D5·name/type·legacy D0 case unit test를 포함해 Frontend unit, oxlint, Vite build와 diff check를
  통과했다. GUI `pkexec` 인증으로 새 build를 local HTTPS 정적 경로에 동기화했다.

## 2026-08-26 - Domains 페이지 레이아웃 정렬

- Domain 설정 페이지의 기능과 JSX는 변경하지 않고, Topics와 같은 `padding: 18px` page container 규칙으로
  맞췄다. 별도 중앙 `max-width` 제한을 제거해 Sidebar 오른쪽 가용 폭 전체를 사용하며, 두 카드는 동일 폭을
  유지한다. 입력 행은 가용 폭을 사용하고 감시 목록은 Domain·상태·삭제의 3열 grid로 정렬했다. 좁은 화면에서는
  입력 행과 목록 grid가 한 번만 자연스럽게 줄어든다.
- Frontend `npm run lint`, `npm run test:unit`, `npm run build`, `git diff --check`를 통과했다. GUI `pkexec`
  인증으로 최종 build를 로컬 HTTPS 정적 경로에 동기화했다. 이 sandbox에서는 `127.0.0.1:443` listener가 없어
  실제 HTTPS 응답 asset 확인은 수행하지 못했다.
- 같은 페이지 범위에서 추가 버튼만 녹색, 삭제 버튼만 붉은 색조·hover·disabled 상태로 구분했다. 다른 버튼과
  동작은 변경하지 않았고, Frontend lint/build와 diff check 후 GUI `pkexec` 인증으로 로컬 HTTPS 정적 경로를 다시
  동기화했다.

## 2026-08-26 - 실제 브라우저 실화면 기반 전수 UX/UI 정밀 검수

- Headless Chrome 및 CDP(Chrome DevTools Protocol)를 통해 실제 구동 중인 로컬 HTTPS(`https://192.168.1.123/`)의
  9개 전체 페이지(`/overview`, `/topics`, `/services`, `/actions`, `/nodes`, `/visualization`, `/alerts`,
  `/domains`, `/interface-lab`)를 1920×1080 및 1440×900 해상도, 상세 패널 오픈/인터랙션 상태에서 전수 캡처 및 검수했다.
- 검수 결과 코드는 수정하지 않고 실제 화면 기준의 개선점을 우선순위(P0 긴급, P1 주요, P2 개선)별로 정리하여
  `gemini_ui.md`에 저장했다. 주요 발견 결함은 1440×900 노트북 해상도에서의 상단 카드/Alert 수직 과밀로 인한
  메인 테이블 가림, 상세 패널 오픈 시 테이블 컬럼 겹침 및 가로 스크롤 버그, Visualization 노드 그래프 오버랩,
  입력 폼 가로 폭 과다 및 상세 패널 이중 스크롤 등이다.
- 후속 공통 UI 작업으로 기능·레이아웃은 유지한 채 CSS theme 변수와 공유 panel selector를 navy/cyan 계열로 정리했다.
  전체 배경은 저대비 42px grid와 radial blue depth를 사용하고, Overview·통신 목록·상세·Alerts·Domains·Interface Lab은
  같은 얇은 cyan border, 미세 gradient와 shadow를 적용한다. Visualization의 흰색 React Flow 컨트롤도 다크 톤으로
  통일했다. Frontend lint/unit/build와 diff check를 통과했고 GUI `pkexec` 인증으로 로컬 HTTPS static 경로에 동기화했다.
- Topic/Service/Action의 목록·상세 연결 수 표기를 `Pub 노드`·`Sub 노드`·`Server`·`Client`로 축약하고, table heading과
  안내/연결 label에 한글 단어 중간 줄바꿈을 막는 CSS를 적용했다. 최근 데이터 로그를 열면 상세 패널의 별도 max-height
  scroll을 해제해 로그 stream만 bounded scroll을 유지하도록 정리했다. Frontend lint/unit/build와 diff check 후
  GUI `pkexec` 인증으로 local HTTPS static 경로에 다시 동기화했다.
- Service/Action 상세 History의 500은 `CommunicationHistory`가 `(name, type, domain_id)`로 호출하면서 API의 세 번째
  positional 인자인 `limit`에 Domain 값을 넣고 실제 `domain_id`를 생략한 것이 원인이다. 각 요청을 Service
  `limit=30`, Action `limit=100`과 선택 resource의 `domain_id`를 네 번째 인자로 명시하도록 한 파일만 수정했다.
  Backend proxy와 Monitor route는 query를 그대로 전달하고 name/type/domain으로 runtime을 선택하므로 변경하지 않았다.
  Frontend lint/unit/build·diff check를 통과했고 GUI `pkexec` 인증으로 local HTTPS static 경로에 동기화했다. 이
  sandbox에서는 Backend/Monitor 8000 listener가 없어 실제 HTTP 재현은 하지 못했다.
- Topic·Service·Action 전용 탭 Alert preview만 기본 3건과 `펼치기`/`접기`로 변경했다. 세 탭은 펼친 상태에서
  `maxItems=Infinity`로 전체 Alert를 표시하고 source 분류 label을 숨겨 상태 배지·resource 이름·메시지만 남긴다.
  Overview/전체 Alerts는 기존 source label, 개수와 동작을 유지한다. 전용 compact class로 항목 padding·badge·문자
  크기만 줄였으며 Alert 생성/Backend는 변경하지 않았다. Frontend lint/unit/build·diff check 후 GUI `pkexec`
  인증으로 local HTTPS static 경로에 동기화했다.
- Topic·Service·Action 상세의 `상태 요약`을 기본 펼침, 나머지 기존 주요 section(QoS, 연결, Node, 실행/측정,
  상세 데이터, History, 원본 JSON 등)을 기본 접힘으로 통일했다. 공통 `DetailSection`의 toggle callback만 확장해
  기존 데이터 요청·표시 구조는 바꾸지 않았다. Camera `Image Preview`도 같은 section으로 바꾸고, 선택 resource의
  Preview polling은 그 section을 실제로 열었을 때만 시작하며 닫기/상세 전환 때 기존 release API로 즉시 정리한다.
  Frontend lint/unit/build·diff check를 통과했고 GUI `pkexec` 인증으로 local HTTPS 정적 파일에 동기화했다.
- Node 탭도 Topic·Service·Action과 같은 Alert preview 옵션(기본 3건, 전체 펼치기/접기, compact item,
  source 분류 라벨 숨김)을 사용하게 했다. 공통 toggle 버튼은 네 탭에 함께 적용되는 cyan accent·32px 최소 높이·
  동일 문구/위치로 조정했으며 Alert 데이터와 1열 목록 구조는 변경하지 않았다. Frontend lint/unit/build·diff check를
  통과했고 GUI `pkexec` 인증으로 local HTTPS 정적 파일에 동기화했다.
- Action 상세 화면은 제목 아래에 `상태 요약`을 바로 두고, 상단의 결과 조회 정책·관찰 Goal/피드백/결과 안내문과
  `상세 데이터`, 마지막 Goal/Feedback/Result·History·피드백/결과 JSON 미리보기 section을 제거했다. QoS, 연결,
  실행/측정, 최근 데이터 로그는 유지하며 Monitor/Backend의 수집·저장·API는 변경하지 않았다. Frontend
  lint/unit/build·diff check를 통과했고 GUI `pkexec` 인증으로 local HTTPS 정적 파일에 동기화했다.
- Topic·Service·Action·Node 탭의 compact Alert item을 공통 3열 grid(상태 배지, 180~280px 이름, 나머지 메시지)로
  정렬했다. resource 이름은 title hover와 말줄임을 적용하고, Alert 메시지는 넓은 화면에서 한 줄을 유지한다. 700px
  이하에서만 이름/메시지를 같은 내용 열 안에서 자연스럽게 줄바꿈한다. Alert 데이터·접기/펼치기·Overview 표시에는
  변경이 없으며, build 중 확인된 기존 여분 CSS 중괄호도 제거했다. Frontend lint/unit/build·diff check를 통과했고
  GUI `pkexec` 인증으로 local HTTPS 정적 파일에 동기화했다.
- 네 통신/Node 탭의 compact Alert에서 상태 배지는 12→16px, resource 이름은 14→18px, 메시지는 13→17px로
  약 30% 확대했다. grid·말줄임·접기/펼치기와 Alert 데이터는 그대로이며, Frontend lint/build·diff check를 통과한 뒤
  GUI `pkexec` 인증으로 local HTTPS 정적 파일에 동기화했다.
- Alert 공통 표시가 snapshot/DB API의 실제 `domain_id`를 우선 읽어 resource 이름 뒤에 ` · D99`처럼 붙인다.
  domain_id가 없는 이전 형식은 `resource_key`의 숫자 Domain 접두사만 사용하며 임의 기본 Domain을 만들지 않는다.
  이름+Domain 열은 220~340px으로 넓혀 같은 이름의 다른 Domain Alert를 한 줄에서 구분한다. Alert 생성/Backend는
  변경하지 않았고, Frontend lint/unit/build·diff check 후 GUI `pkexec` 인증으로 local HTTPS 정적 파일에 동기화했다.
- 공통 `QosDetails`에서 `qos_status=observed`의 표시 tone을 파란 `info`로 통일했다. 따라서 Action의
  `DDS Discovery 관찰됨`과 `Graph 관찰됨`을 포함한 Service/Topic의 같은 관찰 상태는 파란 배경·테두리·텍스트를,
  `compatible`/정상은 기존 초록을 유지한다. QoS 판정값·문구·API는 변경하지 않았고 Frontend lint/unit/build·diff
  check 후 GUI `pkexec` 인증으로 local HTTPS 정적 파일에 동기화했다.
- Camera Topic의 큰 보기 modal은 좌측 image와 우측 embedded `최근 데이터 로그`를 함께 표시한다. modal History는
  기존 Topic History fetcher·최신순 formatter·수동 새로고침·내부 stream scroll을 재사용하고, 선택 camera의
  `domain_id/name/type`을 그대로 전달한다. 큰 보기를 닫으면 component와 1초 History polling도 함께 정리되며,
  일반 Topic 상세 History와 Camera 10 FPS frame polling은 바꾸지 않았다. 넓은 화면은 2열, 960px 이하는 세로로
  자연스럽게 전환한다. Frontend lint/unit/build·diff check 후 GUI `pkexec` 인증으로 local HTTPS 정적 파일에 동기화했다.
- Domains UI는 등록 Domain/감시 중 Domain 요약, 최대 400px의 추가 입력, 최대 980px 4열 표(Domain·상태·발견된
  리소스·관리)로 정리했다. `/ros/domains`는 Backend cache의 실제 snapshot만 Domain별로 집계한 `resource_counts`를
  반환하며 resource가 0이면 UI는 `없음`으로 표시하되 runtime 상태와 섞지 않는다. GUI `pkexec` 인증으로 Frontend를
  local HTTPS 정적 파일에 동기화하고 checkout 소스를 쓰는 Backend service를 재시작했다. 실제 API에서 D5
  `Topic 9 · Service 3 · Action 1 · Node 6`, D99 `Topic 139 · Service 106 · Action 17 · Node 32`를 확인했다.
  Backend pytest 17 passed·2 skipped, Frontend lint/unit/build·diff check를 통과했다.

## 2026-08-26 - 최근 UI 수정사항 반영 결과 실화면 2차 정밀 재검수

- Headless Chrome 및 CDP를 통해 최신 로컬 HTTPS(`https://192.168.1.123/`) 환경의 9개 전체 페이지를
  1920×1080 및 1440×900 해상도, 상세 패널 오픈/인터랙션 상태에서 재검수했다.
- 최근 패치로 Alert 3열 그리드 및 접기/펼치기, 상세 패널 기본 접힘/상태 요약 노출, Camera 큰 보기 2열 모달,
  1920px 테이블 헤더 축약이 정상 개선됨을 확인했다.
- 코드는 수정하지 않고 실제 화면 기준의 잔여 결함(1440×900 Services/Actions 상세 오픈 시 가로 스크롤, Overview
  카드 타이틀 한글 쪼개짐, 상단 누적 높이, Domains 입력 폭 과다 등)을 우선순위별로 정리하여 `gemini_ui2.md`에 저장했다.

## 2026-08-26 - Domains 감시 중 Domain 테이블 가로폭 및 레이아웃 최적화

- Domains 페이지의 `감시 중 Domain` 테이블이 카드 가로폭 전체를 자연스럽게 사용하도록 `App.css`를 수정했다.
- 컬럼 비율을 `Domain 15% (15fr)`, `상태 20% (20fr)`, `발견된 리소스 50% (50fr)`, `관리 15% (15fr)`로 설정하여
  `발견된 리소스` 컬럼을 가장 넓게 배치하고, 삭제 버튼은 우측 끝 정렬, 상태는 일정한 위치에 정렬되도록 했다.
- 잉여 여백을 자연스럽게 채우기 위해 행 패딩(`18px 20px`), 컬럼 간격(`24px`), 행 최소 높이(`62px`)로 간격을 더욱
  넓히고, Domain 이름(18px mono bold), 상태(15px semibold, 10px dot), 리소스 요약(15px), 헤더(14px), 삭제 버튼(14px,
  min-height 36px)으로 폰트와 컨트롤을 확대했다.
- 페이지 전체 max-width 제한을 두지 않고 다크 테마 및 추가/삭제 로직을 온전히 유지했다.
- Frontend lint/unit/build 및 diff check를 통과했으며, GUI `pkexec` 인증으로 로컬 HTTPS 정적 파일에 동기화한 뒤
  Headless Chrome CDP로 1920×1080 및 1440×900 실화면 렌더링을 재검증했다.

## 2026-08-26 - 실사용성 핵심 UI/UX 결함 6개 항목 집중 개선

- Services/Actions 화면에서 1440×900 상세 패널 오픈 시 발생하던 테이블 가로 스크롤 결함을 해결했다.
  테이블의 하드코딩된 min-width(1300px, 1540px)를 제거하고 컬럼 폭을 유연화해 주요 데이터가 한 화면에 보이도록 했다.
- Overview 요약 카드 제목(`Node 미리보기`, `Topic 미리보기`)에 `white-space: nowrap; word-break: keep-all; font-size: 20px;`를
  적용하여 1440×900에서 한글 단어 중간 줄바꿈 깨짐을 제거했다.
- Topics/Services/Actions/Nodes의 상단 설명·요약 카드·Alert 패딩과 간격을 컴팩트화해 1440×900에서 테이블의
  첫 화면 가시성을 추가 확보했다.
- Visualization 화면에서 본문 우측 상단의 중복 WebSocket 상태 표시를 제거하고, 상단 툴바를 검색/필터 행과 화면 조작
  버튼 행으로 시각적 2단 분리하여 검색창 잘림을 해소했다.
- Interface Lab에서 `Message full_type`, `Message import됨만 보기` 등 내부 변수명 스타일 라벨을 `메시지 타입`,
  `import된 메시지만 보기` 등 직관적인 한글 명칭으로 정제했다.
- Frontend lint/unit/build 및 diff check를 통과했으며, Nginx 정적 파일 동기화 후 실화면을 검증했다.

## 2026-08-26 - 문서 코드 라인 번호(Lxx-Lxx) 전수 대조 및 최신화

- `git diff`와 현재 실제 코드를 기준으로 문서 내 함수 위치 및 라인 번호(`Lxx-Lxx`)를 전수 대조·수정했다.
- `docs/docs2/` 전체 문서 (01~08 및 계산.md)에서 `RosMonitor`, `assemble_*_snapshot`, `update_subscription_entry`, `_elapsed_time_ms`, `ServiceCallRuntime`, `ActionGoalRuntime`, `monitoring` router, `topic/service/action_execution` router, Frontend Hook/Page의 변경된 라인 번호를 최신 코드 위치로 갱신했다.
- `AGENTS.md`, `README.md`, `monitor_backend_transport.md`, `frontend/README.md`에서 multi-domain (`MultiDomainRosMonitor`) 및 snapshot `domains` 필드, Domains 화면 관련 설명이 실제 구현과 일치하도록 정정했다.
- `start.md`를 포함한 설정·코드 파일은 일체 수정하지 않고 오직 `.md` 문서만 수정했다.

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
