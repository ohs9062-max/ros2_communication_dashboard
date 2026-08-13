# CURRENT STATUS

마지막 갱신: 2026-08-13

이 문서는 현재 상태만 요약한다. 최근 작업은 `.codex/WORK_LOG.md`, 오래된 이력은
`.codex/archive/`에서 확인한다. 문서와 코드가 다르면 실제 코드와 실행 결과를 우선한다.

## 현재 프로젝트 상태

- ROS2 직접 접근은 `ros2_dashboard_monitor`, 공개 REST/Browser WebSocket과 cache는 순수 FastAPI
  `backend`, 화면은 React `frontend`가 담당하는 분리 구조다.
- 구조 리팩토링은 완료됐다. 이후 분리는 줄 수가 아니라 실제 복수 책임이나 기능 변경이 생길 때만 진행한다.
- 로컬/LAN HTTPS/WSS는 Nginx TLS 종료 방식이다. Browser 구간은 HTTPS/WSS이고 Nginx는 localhost의
  Vite와 FastAPI에 HTTP/WS로 전달하며 인증서/private key는 Git에 포함하지 않는다.
- Topic QoS는 rclpy Graph endpoint 정보를 표시하고 Monitor Subscription 생성 시 외부 Publisher와 호환되는
  profile을 우선 적용한다. fallback은 실제 관찰값과 구분한다.
- Service와 Action 내부 Service QoS는 Fast DDS passive observer가 제공한다. QoS 확인을 위해 Service Call,
  Action Goal 또는 사용자 데이터 endpoint를 만들지 않는다.
- Interface Lab의 Topic/Service/Action 실행은 Auto/Manual QoS를 지원한다. Topic Auto는 Graph endpoint의
  전체 profile, Service Auto는 Fast DDS Request Reader/Response Writer에서 발견한 Reliability, Durability,
  Deadline, Lifespan, Liveliness, Lease Duration을 Client 관점에서 적용한다. History/Depth만 local Service
  기본값을 사용하며, Action은 이 Service Auto와 Topic Auto로 5개 내부 채널 QoS를 각각 전달한다.
- Alert DB 정책은 단일 MariaDB `alert` 테이블의 자동 증가 `id`와 8개 업무 컬럼(총 9개 컬럼)으로 확정됐다.
  동일 `alert_key`의 미해결 row는
  중복 INSERT하지 않고, 정상 복귀 시 `resolved_at`을 기록하며, 해결 뒤 재발하면 새 row를 만든다. DB는 전체
  이력을 보존하고 이전 Alert UI는 `name` 검색과 해결 최신순 50개 페이지 조회를 사용한다.
- Backend `AlertHistoryService`와 MariaDB Repository가 위 정책을 실제 연결한다. 현재/이전 Alert는 DB에서
  조회하고, DB 장애 시 Monitoring을 중단하지 않고 메모리 fallback과 재연결을 사용한다.
- Alert의 `detected_at`과 `resolved_at`은 MariaDB `DATETIME(6)`에 KST 벽시계 값으로 저장하고, 조회 시
  KST로 해석해 기존 API epoch timestamp로 반환한다.
- 로컬 Backend의 `backend/.env`에 Monitor와 MariaDB 실행 설정이 구성됐고 실제 `ros2_dashboard.alert` 접근과
  DB 기반 Alert API를 확인했다. 실제 credential은 Git에서 제외되며 `.env.example`에는 placeholder만 둔다.
- 현재 작업 트리는 기존 사용자 변경과 최근 기능 변경이 함께 있는 dirty 상태이며 commit/push되지 않았다.

## 현재 핵심 구조

```text
ROS2 Graph / Fast DDS Discovery
├─ ros2_dashboard_dds_observer (C++, optional, 127.0.0.1:8766)
└─ ros2_dashboard_monitor (rclpy, 127.0.0.1:8765)
   → FastAPI Backend Runtime Cache (127.0.0.1:8000)
Browser → Nginx HTTPS/WSS (local PC)
        ├─ `/` → Vite/React (127.0.0.1:5173 HTTP/HMR WS)
        └─ REST·`/ws/monitor` → FastAPI (127.0.0.1:8000 HTTP/WS)
```

```text
backend/                         순수 FastAPI, Monitor client/cache, REST/WS, 사용자 정책
ros2_ws/src/ros2_dashboard_monitor/
                                 ROS2 Graph, 상태/QoS, Interface Lab 실제 통신
ros2_ws/src/ros2_dashboard_dds_observer/
                                 Fast DDS Service endpoint passive QoS helper
ros2_ws/src/ros2_dashboard_interfaces/
ros2_ws/src/ros2_dashboard_demo_nodes/
ros2_ws/src/uploaded_interfaces/ 사용자 Interface package
frontend/                        Vite/React UI
config/nginx/                    로컬 Nginx template/example
docs/                            설계·운영 문서
.codex/archive/                  오래된 AI 작업 기록
```

생성물은 `ros2_ws/build/`, `ros2_ws/install/`, `ros2_ws/log/`, `frontend/node_modules/`,
`frontend/dist/`, `.runtime/`이며 소스처럼 수정하거나 Git에 포함하지 않는다.

## 최근 완료 작업

- Dashboard가 생성하는 Topic·Service·Action·Node·QoS Alert과 수신 진단, Interface Lab
  실행/관리, Backend 연결, Frontend fallback의 warning/error 본문을 짧은 영어 문장으로
  통일했다. 한국어 UI 라벨·상태/레벨 badge와 내부 status/code/enum, Alert lifecycle,
  MariaDB schema는 변경하지 않았다. 외부 `MonitorStatus.message`는 장비가 보낸 원문을 유지한다.
- Service/Action은 각 `graph_missing_timeout_sec` 기본 5초, Node는 기존 `nodes.stale_timeout_sec`
  기본 5초 동안 Graph 이탈이 유지된 뒤에만 disconnected로 확정한다. 첫 누락 poll은 직전 상태를 유지하고
  재등장은 즉시 정상 복귀한다. Node `node_stale` Alert code는 DB 호환을 위해 유지하되 실제 Alert는 주요·감시
  대상이면서 내부/tool Node가 아닌 경우에만 생성한다.
- Topic missing/stale에는 기존 Publisher/Subscription/QoS/RMW 근거를 조합한 `reception_diagnosis`를 추가했다.
  Subscription 생성 실패를 최우선 확정 원인으로, 실제 RMW incompatible event를 확정 QoS 원인으로,
  Graph incompatible를 원인 후보로 구분한다. compatible/unknown/observed도 QoS 외 수신 경로 점검 또는 판단 불가로
  안내하며 stale은 Publisher 존재 중 데이터 중단과 Publisher Graph 이탈을 구분한다. 기존 missing/stale와 QoS
  Alert code/lifecycle은 유지하고 관련 Alert id와 진단 근거만 함께 제공한다.
- `AGENTS.md`의 최신 내용 추가/구 내용 병렬 구조를 제거하고 실제 코드 기준의 단일 현재 문서로 교체했다.
  현재 폴더와 Monitor/Backend/Frontend 책임, 21종 Alert와 QoS confirmation/channel 정책, MariaDB 단일
  `alert` 테이블의 정확한 9개 컬럼 및 migration 미구현, 요청형 Camera Preview, HTTPS/WSS, Interface Lab과
  설정 source를 통합했다. Alert 문서에 남아 있던 18종 표기와 migration 표현도 현재 구현에 맞췄다.
- Frontend/Backend/Monitor의 대형 기능을 feature/runtime 단위로 분리하고 전체 회귀 검증을 완료했다.
- 로컬 Nginx self-signed HTTPS/WSS 설치와 `/ws/monitor` reverse proxy를 적용하고 Browser WSS snapshot을 확인했다.
- Interface Lab 첫 ActionClient 생성 시 발생하던 non-reentrant Lock deadlock을 수정하고 실제 Goal 실행을 검증했다.
- Topic endpoint QoS 표시, Graph 기반 자동 Subscription profile 선택, 확인 가능한 mismatch 구분을 연결했다.
- Fast DDS `rq`/`rr` endpoint를 관찰하는 C++ passive observer와 Service/Action 채널별 QoS 화면을 추가했다.
- stale ament 환경에서도 설치된 sibling Fast DDS observer helper를 찾도록 resolver를 보강하고, 기존 demo
  `/RobotControl`·`/CanControl`의 DDS QoS가 Monitor와 Backend API까지 연결됨을 확인했다.
- Interface Lab의 1초 background polling을 Receive 상태 4개 API로 축소하고, DDS Service endpoint 인덱스와
  transport snapshot 재사용으로 대규모 Graph의 API 응답 지연을 줄였다.
- Interface Lab Topic Publish/Subscribe와 Service Request/Response는 실행/수신 UI에서 서로 독립된 Auto/Manual
  QoS 상태를 사용한다. Action은 Goal/Result/Cancel Service와 Feedback/Status Topic의 5개 QoS를 각각 독립
  선택하며 실행 화면과 수신 화면은 서로 독립된 QoS UI state를 가진다. 각 Action UI는 QoS Mode 하나만 제공하고
  Manual일 때 Service/Topic 그룹 아래 5개 채널 설정을 개별 accordion으로 연다. 현재 Action 수신 화면은 이력
  관찰 UI이며 별도 ActionClient를 생성하지 않는다. Topic/Service/Action 실행·수신 QoS는 리소스별
  `실행/수신 연동` 체크로 Mode와 대응 Manual 세부값을 선택적 동기화할 수 있고, 해제하면 다시 독립 동작한다.
  Manual QoS는 기존 Reliability/Durability/History/Depth와 접힌 고급 설정의 Deadline/Lifespan/Liveliness/
  Lease Duration을 지원하며 비어 있는 고급 duration은 Jazzy QoSProfile 기본값을 유지한다. Auto는 발견값을
  기본값보다 우선하며 Service 한 방향만 발견된 경우에도 확인된 정책을 버리지 않는다.
  rclpy ServiceClient는
  Request/Response에 단일 profile만 받으므로 두 선택으로
  계산된 profile이 다르면 호출 전 오류로 안내하며, 같을 때만 QoS fingerprint 기준 Client를 재사용한다.
- `ros2_dashboard_demo_nodes`에 TurtleBot3 Gazebo World, 별도 keyboard teleop 터미널, Nav2를 순서대로 시작하는
  통합 launch 파일을 추가했다.
- Camera Topic `sensor_msgs/msg/Image`/`CompressedImage`를 기존 Topic QoS·latest·Hz·stale 경로로
  감시하고, 선택한 상세 화면에서만 요청형 PNG/JPEG data URL preview를 제공한다. Demo node는
  외부 이미지 없이 320x180 RGB 패턴의 raw Image와 PNG CompressedImage를 1 Hz로 발행한다.
  상세 preview 이미지를 누르면 데스크톱 화면의 76.8vw/89.3vh를 사용하는 다크 테마 확대 modal이 열리며 화면 맞춤,
  25~400% 확대·축소, 원본 크기와 overflow scroll을 지원한다. Esc·배경 클릭·닫기 버튼으로 닫힌다.
- Topic·Service·Action 목록과 상세에 기존 계산 결과를 사용하는 QoS 상태 badge/안내를 추가했다.
  Fast DDS/Graph에서 endpoint profile을 찾았지만 적용 QoS와의 호환성 판정 전인 `observed`는 작은 회색
  `QoS 발견` 보조 badge로 표시해 정상 안내의 시각 비중을 낮추고, `unknown`은 `QoS 확인 불가`로 구분한다.
  QoS Alert는 주요 감시 대상의 확정 `incompatible`만 기본 3회 연속 관찰 후 생성하고, Graph 일부 조합
  불일치는 warning, 실제 RMW 이벤트나 전체 상대 endpoint와 통신 불가능이 확인되면 error로 분류한다.
  Action은 Goal/Result/Cancel/Feedback/Status 채널별 Alert key와 상세 이동을 사용하며 `partial`·`unknown`은
  화면 안내만 하고 Alert로 만들지 않는다.
- Topic·Service·Action·Node 화면은 빠른 진단에 필요한 핵심 열을 목록에 표시한다. Topic은 외부 Node Pub/Sub,
  Hz, compact JSON Latest와 마지막 수신, Service는 Server/Client, 실제 마지막 Request/Response·응답 시간·마지막 호출,
  Action은 Server/Client, Goal 상태·실제 Feedback/Result·실행 시간·최근 Goal, Node는 namespace와 Topic/Service/Action의
  역할별 수를 제공한다. 행을 선택하면 390px 상세 패널이 열리며 닫기 버튼으로 목록 전체 폭을 즉시 복원한다.
  마지막 값/Request/Response/Feedback/Result는 공통 compact formatter와 한 줄 ellipsis를 사용하며, 기존
  JSON preview 버튼을 누르면 pretty JSON modal로 전체 payload를 확인한다. 이름·타입도 한 줄 ellipsis와 title을
  사용하고, endpoint·Graph·raw 실행 metadata는 기존 접이식 상세에 유지한다. 빈 Alert는
  한 줄로 축소했고 Sidebar 라벨, 주요 리소스 요약 용어와 대표 영문 상태 문구를 정리했다.
  Service `최근 응답`은 헤더와 preview를 가운데 정렬하고, Action은 Feedback/Result 내용 열 오른쪽에
  Feedback·Result 중 더 최근 수신 시각을 표시하는 `마지막 응답 시간` 정렬 열을 제공한다.
- Topic·Service·Action 기본 목록의 Pub/Sub·Server/Client 수는 정책에 따라 Dashboard 내부 Node를 제외한 고유
  `*_node_count`를 표시한다. 구 API 응답에만 원본 count를 fallback으로 쓰며, Dashboard를 포함한 원본 endpoint
  수는 기존 상세 패널의 Endpoint 진단값으로 유지한다. Node 탭은 기본 필터에서 내부 Node를 제외하고
  `숨김 포함`에서만 Dashboard Node와 그 역할 수를 표시한다.
- Interface Lab은 등록/실행 가능/build 필요/오류와 Interface 목록을 첫 화면 중심으로 표시한다. 관리와 주의사항은
  목록 검색·종류·상태 필터를 제공한다. 관리 영역은 항상 펼쳐지고 주의사항만 기본 접힘이다. 선택 상세는 데스크톱 420~460px 우측 패널로 열리고,
  Topic Publish/Receive/History, Service Call/History, Action Goal/History와 고급 정보 탭으로 실행 흐름을 분리한다.
  목록 행 선택 시에는 `통신 상세`가 기본으로 열려 type, Graph 연결, 서버/실행 상태와 endpoint QoS를 먼저
  보여준다. Publish/Receive/Service Call/Goal 실행 탭은 우측 상세에서 제거했고 공통 `실행` 버튼이 선택 kind에
  맞는 관리 영역의 Topic/Service/Action 실행 workspace를 연다.
  실행 workspace를 열면 같은 kind의 수신 패널도 함께 열리며 실행·수신 QoS와 닫기 동작은 각각 유지한다.
  우측 상세 탭은 통신 상세/History/고급 정보/실행 순서이며 공통 History 관리에서 Topic 전체 Publish/Subscribe,
  Service 전체 Call, Action 전체 Goal 이력을 확인 후 초기화할 수 있다. 모든 kind의 우측 상세 닫기는 같은 dark
  secondary `닫기 ×` 버튼을 사용한다.
  History 관리에는 현재 Interface 범위의 파란 `선택 이력 초기화`와 종류 전체 범위의 빨간 `전체 이력 초기화`가
  공통 제공된다. 목록의 실행 가능 상태 문구는 Graph/등록 출처와 무관하게 `실행 가능`으로 통일한다.
  History UI는 이력 유무와 Graph/등록 출처에 관계없이 동일한 제목·빈 상태·관리 badge 구조를 사용한다.
  관리 실행 badge는 Topic 초록/Service 노랑/Action 보라, 목록 종류 badge는 msg 파랑/srv 노랑/action 보라/pkg 빨강이다.
  QoS·timeout·Graph·schema/raw 정보는 기본 화면에서 접힌 고급 영역으로 이동했다.
  관리 영역에는 Topic/Service/Action 실행 진입점이 있으며, 선택 상세의 실행·수신 QoS `Auto / Manual` 선택은
  상대 장비 QoS에 맞출 수 있도록 각 기본 통신 화면에 노출한다. timeout·Hz·Graph·schema/raw만 고급 영역에 둔다.
  관리 영역에서 연 Topic/Service/Action 실행 패널은 제목 우측 `×`로 닫을 수 있으며 닫아도 이력·결과·QoS 값은 유지한다.
  실행과 수신 workspace 모두 눈에 보이는 `닫기 ×` 버튼을 사용하며 수신 패널을 닫아도 활성 Subscription은 유지한다.
- Overview 상태 분포 그래프는 접기 UI 없이 항상 펼쳐진다.
- AI 작업 로그를 최근 기록과 `.codex/archive/`의 과거 기록으로 분리했다.

## 현재 검증 기준

마지막 기능 변경 기준 확인 결과:

```text
Monitor pytest: 236 passed
Backend pytest: 15 passed, 2 skipped
격리 MariaDB exact-schema E2E: 1 passed
실제 MariaDB Alert UI 조회 E2E: 1 passed
전체 workspace colcon test-result: 254 tests, 0 failures, 1 skipped
Frontend oxlint/build: 통과
Python compileall: 통과
git diff --check: 통과
```

격리 ROS domain의 실제 Graph E2E에서 BEST_EFFORT publisher와 RELIABLE endpoint 조합이 기본 3회 연속
확인된 뒤 `topic_qos_incompatible` warning으로 생성되고, 불일치 endpoint 제거 후 동일 Alert가 resolved로
전환되는 것을 확인했다.

Interface Lab demo E2E에서 Topic Auto/Manual Publish·Subscribe, `/RobotControl` Service Auto와 Manual
RELIABLE(depth 7→8), `/CanControl` Action Auto와 채널 그룹별 Manual Goal이 모두 성공했다. Service/Action
Service 채널은 Fast DDS, Topic과 Action Feedback/Status는 Graph 관찰값을 사용한 실제 실행 QoS를 확인했다.

Fast DDS passive E2E에서는 Call/Goal/Client 생성 없이 Service request Reader/response Writer와 Action
Goal/Result/Cancel의 각 request Reader/response Writer를 발견했다. History/Depth는 `unknown`/`null`,
DataReader Lifespan은 `unknown`으로 유지했다. 테스트 프로세스는 종료했다.

## 현재 문제와 제한

- 작업 트리가 dirty 상태다. 기존 변경을 reset하거나 덮어쓰지 말고 작업별 diff를 구분해야 한다.
- Topic 수신 원인 진단에서 실제 RMW incompatible event와 Subscription 생성 실패만 확정 원인이다. Graph QoS
  비교, Publisher 존재 여부와 compatible 상태 기반 안내는 기존 관찰값을 조합한 원인 후보이며 실제 장비의
  발행 callback/transport 오류를 직접 증명하지 않는다.
- Fast DDS observer는 `rmw_fastrtps_cpp`와 Fast DDS 이름 규칙에 종속된다. 다른 RMW, DDS Security 또는
  Discovery 범위 밖에서는 Service/Action Service QoS가 `graph_unavailable`이 된다.
- DDS Discovery가 제공하지 않는 History/Depth와 DataReader Lifespan은 추정하지 않는다. Service Auto의
  Lifespan은 관찰 가능한 원격 Response Writer 값을 단일 Client profile에 전달하며 Request Reader 요구값으로
  해석하지 않는다.
- fallback으로 만든 Topic entity는 이후 Graph QoS 변화에 따라 자동 재생성되지 않는다.
- 다른 배포 환경에서는 각 환경의 MariaDB 접속 정보와 확정 `alert` 테이블을 별도로 준비해야 한다. Backend는
  테이블을 자동 생성하거나 변경하지 않으며, DB 연결 실패 중 생성된 메모리 fallback 이력은 재시작 시 사라질 수 있다.
- Gazebo TurtleBot 명령 preset은 아직 구현되지 않았다.
- 실제 기기 전체 통합 E2E는 남아 있다. 현재 Gazebo/demo 데이터 기반 Browser에서는 Overview, Topic,
  Service, Action, Node를 1440x1000으로 렌더링해 목록 밀도와 헤더를 확인했고, Topic 상세 패널의
  선택 전·열기·닫기와 목록 폭 복원을 Chrome DOM에서 검증했다.
- TurtleBot3 통합 launch는 build, launch argument 로드와 package test까지 확인했으며, 이미 실행 중인
  Gazebo/Nav2와 충돌하지 않도록 이번 작업에서 두 번째 GUI stack을 실제로 동시에 띄우지는 않았다.
- QoS 사유 배치는 source와 `frontend/dist`에서 전용 라벨/설명 2행 구조로 수정됐다.
- Action QoS UI는 기본 상태에서 Service(Goal/Result/Cancel)와 Topic(Feedback/Status) 두 요약만 표시하고,
  그룹과 개별 채널을 단계적으로 펼치는 구조다. 상태 badge와 세부 QoS 값은 정상/발견/일부/불일치/확인 불가
  색상을 사용하며 항목명 typography를 통일했다.
- 실제 시스템 Nginx는 저장소 템플릿과 일치하며 `/`를 Vite 5173으로,
  `/health`·`/ros`·`/ws/monitor`를 FastAPI 8000으로 proxy한다. HTTPS Vite 자산,
  Backend WSS `monitor_snapshot`, Vite HMR WSS upgrade를 2026-08-12에 재검증했다.
- 현재 self-signed Nginx 구성의 지원 범위는 localhost와 같은 LAN의 로컬 IP 접속이다. 인터넷 공개용 인증,
  방화벽/라우터 포트 개방, 접근 제어와 운영 정적 배포 구성은 포함하지 않는다.
- demo outcome server 종료 시 중복 shutdown traceback이 발생할 수 있다.
- 동일 PC의 격리 Graph 벤치마크에서 Monitor CPU는 최소 2 Nodes/7 Topics/14 Services에서 평균 4.83%,
  중간 14/19/114/4 Actions에서 6.57%, Gazebo/Nav2 25/120/313/17에서 78.43%였다. 큰 Graph의 80%대는
  재현됐으며 다음 성능 진단은 1초 Graph update의 runtime별 계측과 실제 기기 환경 재측정이 필요하다.
- Node `주요 항목`은 Backend의 최종 `is_primary`를 사용한다. disconnected 일반 Node는 주요로 유지하되,
  transform listener, launch helper, `_rclcpp_node`, `_action_client`는 `is_auxiliary=true`로 분류해 자동 주요에서
  제외한다. 명시적 `nodes.primary_names`와 사용자 별표는 보조 Node 제외보다 우선한다.

## 다음 우선 작업

1. 운영 MariaDB credential/table 준비 후 실제 배포 Backend의 영속 이력 확인
2. Alert DB 장기 보존량 기준 index/운영 성능 측정. 확정 스키마 변경은 별도 승인 필요
3. Gazebo TurtleBot 명령 preset과 실제 장비/Gazebo·Browser 통합 검증

신규 작업은 `AGENTS.md`의 현재 책임 경계와 안전 정책을 따르며, 미구현 항목을 완료된 기능으로 보고하지 않는다.
