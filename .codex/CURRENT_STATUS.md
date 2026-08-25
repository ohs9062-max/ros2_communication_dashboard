# CURRENT STATUS

마지막 갱신: 2026-08-25

이 문서는 현재 상태만 요약한다. 최근 작업은 `.codex/WORK_LOG.md`, 오래된 이력은
`.codex/archive/`에서 확인한다. 문서와 코드가 다르면 실제 코드와 실행 결과를 우선한다.

## 현재 프로젝트 상태

- AI 인수인계 로그는 `.codex/WORK_LOG.md`에 최근 20~30개 작업만 유지하고, 초과한 오래된 항목은
  `.codex/archive/WORK_LOG_YYYY-MM-DD.md`에 날짜별로 보관한다. 작업 시작에는 archive 전체를 읽지 않고 과거
  근거가 필요한 경우에만 검색한다.
- ROS2 직접 접근은 `ros2_dashboard_monitor`, 공개 REST/Browser WebSocket과 cache는 순수 FastAPI
  `backend`, 화면은 React `frontend`가 담당하는 분리 구조다.
- 구조 리팩토링은 완료됐다. 이후 분리는 줄 수가 아니라 실제 복수 책임이나 기능 변경이 생길 때만 진행한다.
- 제품 설치 경로는 `scripts/install.sh`와 Monitor/Backend systemd unit, MariaDB schema init, Nginx production
  static serving으로 구현됐다. 평상시 `start.sh`/`stop.sh`/`status.sh`가 target 수명주기와 API·DB 상태를 확인한다.
  설치기는 일반 사용자로 실행해 시작 시 `sudo -v`를 한 번 요청하고 45초 주기의 비대화형 keepalive를 유지한다.
  venv·ROS workspace·Frontend build는 일반 사용자, 시스템 변경만 `sudo -n`으로 실행하며 종료·실패·SIGINT 때
  keepalive를 정리한다. demo/Gazebo dependency는 기본 제품 rosdep/build에서 제외한다.
- 로컬/LAN 제품 HTTPS/WSS는 Nginx TLS 종료 방식이다. Nginx가 `/var/lib/ros2-dashboard/frontend`의 production
  build를 정적으로 제공하고 FastAPI REST/WSS만 localhost로 proxy한다. Vite는 개발 모드에만 사용하며
  인증서/private key는 Git에 포함하지 않는다. 설치기는 명시 IP 또는 활성 default route의 IPv4를 기본 주소로
  선택하고 container/libvirt bridge를 제외한 추가 활성 IPv4를 TLS SAN에 포함한다. 선택 주소와 HTTPS port는
  `/etc/ros2-dashboard/network.env`에 저장해 Nginx·설치 검증·`status.sh`가 함께 사용한다.
- 현재 사용·검증 기준은 별도 원격 production이 아니라 이 장비의 Nginx 로컬 HTTPS/WSS다. Frontend 변경은
  `frontend/dist` build만으로 실제 화면에 반영되지 않고 `/var/lib/ros2-dashboard/frontend`와 동기화돼야 한다.
  이 동작은 “운영 배포”가 아니라 “로컬 HTTPS 실행 파일 반영”으로 부르며, UI 미반영 시 source dist·설치 정적
  파일·HTTPS 응답의 asset hash를 먼저 대조한다.
- 좌측 `Domains` 화면은 0~232 Domain을 하나씩 추가·삭제하며, 감시 목록의 단일 source는
  `backend/config/user_preferences.yaml`의 `domains.ids`다. Monitor는 이 목록만으로 Domain별 rclpy
  Context/Node/Fast DDS observer runtime을 추가·종료·재시작 복원하고 `.env`/shell `ROS_DOMAIN_ID`, 99 또는 첫
  Domain을 multi-domain fallback으로 사용하지 않는다. Topic/Service/Action/Node snapshot, 상세·History·Latest·Hz·Preview,
  QoS·Alert·Overview와 Interface Lab 실행은 `domain_id`/`resource_key`를 유지해 동일 이름 리소스를 분리한다.
- Interface Lab 상세에서 실행을 열면 Graph에서 선택한 단일 Topic/Service/Action resource의
  `resource_key`·`domain_id`·이름·type을 실행 loader까지 전달해 해당 Domain runtime으로 자동 실행한다.
  수신 controller는 별도 callable 목록과 selected key를 보유하므로 수신 load/선택/시작은 Topic Publish,
  Service Call, Action Goal의 실행 목록·선택·busy state를 변경하지 않는다. 여러 동일 type 후보가 있으면 임의
  Domain을 선택하지 않고 기존 Domain 표기 selector를 유지한다.
- Topic 목록 Hz polling과 표시 cache는 `resource_key`로 구분하고 모든 Hz 요청에 선택 resource의 `domain_id`를
  전달한다. Monitor Hz 응답도 `domain_id/resource_key`를 반환해 같은 이름 Topic의 다른 Domain 응답을 섞지 않는다.
- Multi-domain Interface Lab 실행 목록에 Domain별 serverless placeholder가 앞서더라도 Service/Action controller는
  실제 `callable=true` 항목을 기본 선택한다. 서버가 없는 type만 있을 때는 기존처럼 실행을 차단한다.
- Interface Lab의 Topic Publish/Receive, Service Call, Action Goal/Cancel은 selected resource identity에서
  확정한 `domain_id`가 있을 때만 HTTP payload를 보낸다. 누락/범위 밖 값은 Browser에서 차단하며 multi-domain
  Monitor에 name-only 요청을 보내지 않는다.
- Topic QoS는 rclpy Graph endpoint 정보를 표시하고 Monitor Subscription 생성 시 외부 Publisher와 호환되는
  profile을 우선 적용한다. fallback은 실제 관찰값과 구분한다.
- Topic Monitor Subscription은 resource별 실제 수신 preview를 기본 100개 bounded memory history로 보존한다.
  Service 상세은 기존 Interface Lab Call 최대 30건만 조회한다. Action은 Interface Lab Goal 최대 30건과 실제
  monitoring Subscription/GetResult가 관찰한 Status·Feedback·Result를 합쳐 resource별 기본 100건을 조회한다. 외부
  Action Goal/rejected payload와 외부 Service Request/Response는 현재 discovery observer로 관찰하지 않는다. 전체 history는 정기
  snapshot/WebSocket에 넣지 않고 상세의 접힌 로그를 열 때 `/ros/topics|services|actions/history`로 가져온다.
  불러온 항목은 최신순 단일 고정 높이 영역에서 클릭 없이 pretty JSON으로 이어 표시하고 영역 내부만 스크롤한다.
  세 통신 History는 영역을 펼친 동안 기본 1초마다 자동 갱신하고 접으면 polling을 중단하며, 요청이 겹치지 않는다.
  각 JSON payload는 별도 높이 제한이나 scroll 없이 내용 높이로 펼치고 긴 값은 줄바꿈한다. Camera history에는
  binary/Base64 없이 metadata와 payload size만 남긴다.
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
- Fresh 설치는 MariaDB root unix_socket으로 전용 DB/계정, 랜덤 비밀번호와 schema를 자동 준비한다. 기존
  `.env` 비밀번호와 Alert 행은 재설치에서 유지하며 Backend 계정은 대상 DB의 CRUD 권한만 사용한다.
- Fresh clone venv 이식성 수정은 `46adc19`에 반영됐고 `new-origin/main`과 동일하다. 다른 절대경로의 로컬
  clone에서 생성물 미포함, 새 Backend venv/의존성 설치, Frontend clean install/lint/build를 확인했다.
  별도 Fresh Ubuntu VM에서 전체 `./scripts/install.sh` 재실행과 systemd/HTTPS 검증은 아직 남아 있다.

## 현재 핵심 구조

```text
ROS2 Graph / Fast DDS Discovery
├─ ros2_dashboard_dds_observer (C++, optional, 127.0.0.1:8766)
└─ ros2_dashboard_monitor (rclpy, 127.0.0.1:8765)
   → FastAPI Backend Runtime Cache (127.0.0.1:8000)
Browser → Nginx HTTPS/WSS (local PC)
        ├─ `/` → React production static build
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

- Domains sidebar/page와 `/ros/domains` GET/PUT를 추가했다. `99, 0, 1, 2, 3` 저장 시 `[0, 1, 2, 3, 99]`로
  중복 제거·정렬되고, 범위 밖 `233`은 HTTP 400으로 차단됨을 로컬 HTTPS API에서 확인했다. 실제 Monitor context의
  Domain 99만 `감시 중`이며, 여러 Domain 동시 감시나 UI 적용으로 Monitor runtime 변경은 구현하지 않았다.

- Action 상세 history에 Interface Lab Goal과 실제 외부 통신에서 관찰한 Status 전이·Feedback·terminal Result를
  합쳐 resource별 기본 100건까지 제공한다. 외부 `/CanControlFailure` 실행에서 Interface Lab 이력 0건인 상태로
  executing/aborted Status, Feedback 3건과 실제 실패 Result가 총 6건 기록됨을 HTTPS API에서 확인했다. Service는
  Fast DDS observer가 discovery/QoS만 수집하므로 외부 payload를 만들지 않고 Interface Lab Call 이력만 유지한다.
  Monitor pytest 274 passed, colcon 292 tests·0 failures·1 skipped, Frontend unit/lint/build를 통과했고 로컬 HTTPS
  실행 파일 동기화와 Monitor 재시작 후 새 asset 및 `monitor_connected=true`를 확인했다.

- Topic/Service/Action 공통 최근 데이터 로그를 펼친 동안 기존 Topic polling 주기인 기본 1초로 History API를
  자동 갱신하고, 접으면 timer를 정리한다. 이전 요청이 진행 중이면 다음 요청을 건너뛰어 느린 API 응답이 누적되지
  않는다. Frontend unit/lint/build를 통과했고 새 build를 로컬 HTTPS 경로에 동기화해 source/install index SHA-256,
  실제 HTTPS `index-D2YI1jPV.js`와 health `monitor_connected=true`를 확인했다.

- Topic/Service/Action 상세에 요청형 `최근 데이터 로그`를 추가했다. 실제 `/cmd_vel` 100건 bounded 수신과
  `/RobotControl` Request/Response, `/CanControl` Goal/Feedback/Result/succeeded를 임시 Monitor 8875에서 확인했고,
  일반 snapshot에는 history가 없었다. append 증분은 소형 preview 기준 약 0.054µs/message, 100건 메모리 증분은
  약 44.5KB, 상세 JSON 직렬화는 약 0.046ms였다. Monitor 271 tests, Backend 16 passed·2 skipped, Frontend
  unit/lint/build와 Monitor colcon 271 tests가 통과했다. 최신 build를 로컬 HTTPS 정적 경로에 동기화하고 Monitor를
  재시작했다. source dist·설치 정적 파일·실제 HTTPS 응답이 모두 `index-ejcbpnGB.js`로 일치하며 Topic/Service/Action
  History의 Monitor 직접 경로와 HTTPS proxy가 모두 HTTP 200이다.

- 설치기의 `hostname -I` 첫 주소 의존을 공통 network helper로 교체했다. 단일/다중 NIC, container bridge 제외,
  명시 IP, stale 자동 server name, 443/8443 URL, installer 관리 인증서 DHCP 갱신과 custom 인증서 보존을 합성
  테스트로 검증했다. 현재 장비에서는 default-route `192.168.1.123` 선택, LAN HTTPS/health 200, WSS 101과 내부
  8000/8765/8766 localhost bind를 확인했다. 변경된 installer 전체 실행과 별도 IP 장비 Fresh 설치는 미검증이다.

- Interface Lab Service는 실행 직전 QoS 판정을 Client 생성 성공 여부와 분리해 저장한다. Manual/Auto 판정이
  `incompatible`이면 Client lookup과 `call_async()` 전에 전송을 차단하고, client가 없어도 Service snapshot이
  해당 상태를 병합해 목록 배지를 불일치로 표시한다. 이후 compatible 실행이나 endpoint QoS signature 변경 시
  같은 state가 갱신된다. Monitor pytest 265건과 package test 283건이 통과했다.

- 설치 sudo UX를 일반 사용자 실행 → 시작 시 1회 `sudo -v` → 설치 중 `sudo -n`과 45초 keepalive 구조로
  변경했다. 기존 root 전체 실행과 ROS build의 `sudo -u` 전환을 제거했고, 정상·오류·SIGINT cleanup 모형 테스트와
  설치 환경 테스트, 전체 shell syntax를 통과했다. 샌드박스가 실제 sudo 상승을 차단해 전체 재설치는 미검증이다.

- 설치기는 시스템 기본 Python/Node와 다른 ROS 배포판을 교체하지 않는다. Dashboard는 side-by-side
  `/usr/bin/python3.12` 기반 Backend `.venv`, `/opt/ros2-dashboard/toolchains/node`의 검증된 Node 22.23.2,
  기존 환경변수를 제거한 ROS2 Jazzy/rclpy를 명시적으로 사용한다. installer·systemd·개발 실행·Interface Apply의
  interpreter 경로를 통일했고 환경 모형 및 전체 Backend/Frontend/ROS 회귀 검증을 통과했다.

- Ubuntu 24.04 변형 환경 설치 검수에서 Fresh 최소 설치의 `universe` 활성화 순서, Jazzy package가 없는 기존 ROS
  apt source, 다른 ROS 환경 혼입, 변경된 system Python, 지원 밖 Node/npm, 불완전 TLS pair와 잘못된 새 Nginx
  설정의 기존 설정 유실 위험을 최소 보완했다. 환경 분기 unit test와 전체 Backend/Frontend/ROS 회귀 검증은
  통과했으나 별도 Fresh VM과 수정 후 전체 installer 재실행은 아직 수행하지 못했다.

- `.codex`와 생성물 의존성 문서를 제외한 프로젝트 Markdown 38개를 현재 코드·설정·route·script와 다시 대조했다.
  ROS runtime 우선순위, Nginx 설정 경로, Service/Action QoS cache 갱신과 snapshot read 경계, Topic Publish 성공과
  Subscriber 수신의 구분, Action 5채널 전송 의미, Alert 재발 DB 정책, Camera/Fresh Ubuntu 실제 검증 범위를
  원문 구조 안에서 교정했다. 로컬 링크, 코드블록 균형과 `git diff --check`를 확인했다.

- Action Client Pool은 QoS profile별 Client의 삽입 순서가 아니라 `_last_key_by_resource`의 최신 실행 Client QoS를
  snapshot에 반영한다. compatible→incompatible→기존 compatible Client 재사용 시 Goal snapshot이 compatible로
  복귀하고 `action_qos_incompatible:goal`이 Monitor/Backend/DB에서 resolved 되는 것을 실제 `/CanControl`로 확인했다.

- 최근 Service/Action QoS resolve 보완 뒤 Action Client가 생성되면 snapshot이 non-reentrant lock을 재획득해
  무기한 대기하던 교착을 제거했다. snapshot은 저장된 Client QoS를 읽고, Service 계열 QoS는 정기 Graph update에서
  Fast DDS endpoint signature가 바뀔 때만 재계산하며 Action Feedback/Status는 기존 Graph cache를 사용한다.
  실제 `/transport/snapshot`은 17.5~30.3ms, Service Call/Action Goal과 Action 5채널 compatible을 확인했다.

- 전체 Git 추적 Markdown 40개 중 `start.md`를 완전히 제외한 39개를 실제 코드와 대조했다.
  구 `backend/` ROS workspace·Backend/rclpy 일체형 설명을 현재 `ros2_ws` Monitor → localhost transport →
  순수 Web Backend 구조로 교정했고, 설치 자동화·systemd·MariaDB·HTTPS/WSS·ROS Domain/RMW 흐름과
  docs2의 현재 함수 line range를 동기화했다. 과거 `.codex/archive` 기록은 당시 사실 보존을 위해 수정하지 않았다.
- Fresh clone 설치 실패 원인이 Git에 추적된 이식 불가능한 `backend/.venv` 539개 파일과 기존 venv의
  절대경로 pip shebang 재사용임을 확인했다. venv를 Git index에서 제거했고 설치기는 checkout 경로·machine id·
  Python ABI stamp와 prefix/pip 경로가 현재 환경과 다르면 venv만 재생성한 뒤 `python -m pip`를 사용한다.
  이동된 venv 실패 재현·재생성 판정, 빈 임시 venv requirements 설치와 핵심 import, Backend 15 passed·2 skipped,
  Frontend `npm ci`/build를 확인했다. 별도 Fresh Ubuntu VM의 installer 재실행 확인은 사용자 환경에서 남아 있다.
- ROS Domain과 RMW는 현재 shell의 `ROS_DOMAIN_ID`/`RMW_IMPLEMENTATION`, 프로젝트 `backend/.env`,
  runtime env(`/etc/ros2-dashboard/dashboard.env`), 기본값(`0`/`rmw_fastrtps_cpp`) 순으로 우선순위가 결정된다.
  `scripts/start.sh`는 shell에 명시된 값이 있으면 이를 최우선으로 적용해 `backend/.env`와
  `/etc/ros2-dashboard/dashboard.env`에 동기화하고 값이 변경되면 Monitor를 재시작한다. shell에 값이 없으면
  `backend/.env`의 마지막 저장값을 유지하며 재부팅 후에도 systemd는 마지막 저장값을 사용한다.
  `.env` 파서의 주석·공백·따옴표 정제와 정수 범위(0~232) 검증도 강화했다.
- Topic 목록·Overview·Alert는 ROS2 Graph cache에서 수집된 Topic만 사용한다. `required_stream_names`와
  `command_names`는 실제 발견된 Topic의 역할만 분류하며 설정 이름만으로 `not_discovered` placeholder를 만들지
  않는다. 임시 Monitor 실제 Graph에서 Topic 5건만 노출되고 미발견 설정 이름 6건과 관련 Alert가 모두 0건임을
  확인했다. 이전에 실제 발견된 뒤 Graph에서 사라진 Topic의 `disconnected` 보존 정책은 유지한다.
- `docs/docs2/**`, `start.md`, `.codex/archive/**`와 수정 금지된 L 관련 내용을 제외한 현재 Markdown 문서를
  실제 코드·설정·검증 결과에 맞춰 동기화했다. 기능 설명은 현재 책임 경계와 UI 동작으로 직접 고쳤고,
  제거된 구조나 완료 전 표현은 현재 문서에서 정리했다.
- Ubuntu 24.04 amd64/arm64용 멱등 설치기를 추가했다. 공식 ROS2 Jazzy apt source, rosdep/colcon, 지원 Node.js,
  Backend venv, Frontend production build, MariaDB schema, self-signed TLS, Nginx와 systemd를 한 진입점에서 준비한다.
  DB·Registry·기존 `.env`·runtime 설정·인증서는 재설치 시 보존하며 schema가 다르면 파괴적 migration 없이
  실패한다. 현재 Ubuntu 24.04 host에 최초 설치와 재설치를 실제 적용해 idempotency를 확인했다.
- product Monitor/Backend/observer, MariaDB, Nginx static HTTPS와 WSS를 systemd 경로로 실행 중이다. 설치 전후
  Alert 116건, Registry/Package/Apply 파일, `.env`, 사용자 설정과 TLS 인증서 해시가 동일했고 기존 systemd/Nginx
  설정 백업 두 건을 확인했다. `start/status/stop/start`에서 Monitor와 Backend가 모두 정지 후 새 PID로 재기동됐다.
- 실제 적용 중 기존 개발 스택의 8000/8765 응답을 설치 성공으로 오인하는 문제를 발견해 product unit 정지 후
  포트 소유 충돌을 거부하고 unit active와 health를 함께 검증하도록 설치기를 보강했다. 설치기가 Git 추적 venv의
  pip 자체를 변경하지 않도록 pip upgrade도 제거했다.
- 최신 개발 스택에서 Interface Lab Topic Publish, `/RobotControl` Service Call, `/CanControl` Action Goal,
  Camera raw PNG Preview와 Alert 발생→resolve를 확인했다. Gazebo `/cmd_vel` TwistStamped를 10Hz로 전진·회전한 뒤
  매 단계 zero velocity를 보냈으며 odom position/orientation 변화와 최종 지속 발행 inactive를 확인했다.
- Overview/Topics/Services/Actions/Nodes/Alerts/Interface Lab을 실제 Chrome 1440×1000으로 렌더링해 완료를 막는
  overflow나 헤더 겹침이 없음을 확인했다. E2E entity 정리를 위해 전체 스택을 다시 재시작했고 active Alert 0,
  `/cmd_vel` command `waiting_publisher`, Backend-Monitor 연결 정상으로 마감했다.

- 최종 통합 검수에서 command Topic `/cmd_vel`이 수신 stream처럼 `never_received` 오류로 승격되는 표시 공백을
  수정했다. `monitoring_role=command`는 Graph의 `waiting_publisher`를 대표 상태로 유지하고, latest·Hz·수신 진단은
  계속 제공한다. 따라서 정상적인 on-demand 대기는 노란 `발행자 대기`로 보이고 Topic 미수신 오류에는 포함되지
  않는다. command Alert 제외 정책은 그대로다.
- Dashboard 실행 프로세스를 구성요소별 독립 process group으로 기동하고 종료 스크립트가 해당 그룹 전체를
  종료하도록 보강했다. npm/ros2 wrapper만 종료되어 Vite·Monitor·Fast DDS observer가 포트를 점유하던 문제를
  실제 stop/start로 재현·해결했으며 5173/8000/8765/8766 네 포트 해제와 재기동을 확인했다.
- Overview의 빈 Alert는 공통 compact empty UI를 그대로 사용하되, 미리보기 CSS Grid의 기본 stretch에서만
  제외한다. Alert가 없을 때 `현재 Alert가 없습니다` 한 줄 높이로 표시되고, 실제 Alert 목록·클릭 동작과
  Node/Topic/Service/Action 미리보기 카드 높이는 유지된다. Frontend lint/build와 1440×1000 Browser 화면을
  확인했다.
- Service의 Graph 서버 상태와 사용자 명시 Call 상태·Request/Response·응답 시간·마지막 호출 시각은 공통
  `servicePresentation` selector가 파생한다. 목록·정렬·검색·필터·요약·상세·Visualization이 같은 판정을
  사용하며, 호출 이력이 없는 활성 Service는 `서버 있음`으로 구분한다. Frontend unit/lint/build와
  `/RobotControl`, `/ScheduleCrud`의 1440×1000 Browser 표시를 확인했다.
- Action의 최근 Goal·Feedback·Result·실행 시간·최근 시각은 Frontend 공통 `actionPresentation` selector가
  `last_goal_summary → runtime → 구 snapshot field` 우선순위로 파생한다. Action 목록·정렬·검색·상태 필터·
  요약 카드·상세 안내·Visualization이 같은 판정을 사용하며 summary/runtime 충돌, runtime-only, 미관찰,
  실패 결과 회귀 테스트를 추가했다. Frontend unit/lint/build와 `/CanControl` 1440×1000 Browser 표시를 확인했다.
- QoS 상세을 1440×1000 headless Chrome에서 Topic `/demo_cleaning_schedule`, Service `/RobotControl`, Action
  `/CanControl` 순서로 실제 행 선택·상세 열기·QoS 계층 펼치기까지 검수했다. 최신 격리 스택에서 Action
  Feedback/Status는 각각 동일 QoS Subscriber 3개, Topic은 Subscriber 2개로 그룹화됐고, 펼친 상세에는 서로
  다른 GUID/GID와 participant가 모두 유지됐다. 세 화면 모두 QoS 사유의 영어 잔존과 페이지 가로 overflow가
  없었으며 390px 상세 패널 안에서 긴 identity가 카드 내부에 표시됐다.
- Topic·Service·Action 상세의 QoS 사유와 상단 QoS 안내, Interface Lab 실행 QoS fallback 설명은 공통
  `qosDisplayText`를 통해 한글로 표시한다. Graph/Fast DDS/RMW가 제공하는 내부 영문 reason과 API payload는
  유지하고 화면 표현만 변환하며, 알려지지 않은 middleware reason도 QoS 상태·불일치 정책 기반 한글 안내로
  대체한다.
- 공통 `QosDetails`가 Topic·Service·Action endpoint를 role·통신 scope·QoS fingerprint별로 묶어 공통 QoS를
  한 번만 표시하고, GUID/GID가 다른 실제 endpoint identity는 기본 접힘 상세에 모두 유지한다. Topic Graph
  payload에는 GID와 DDS participant prefix를 추가했고 Fast DDS Service endpoint에도 GUID 기반 participant를
  명시했다. `/CanControl` live Graph에서 Feedback·Status 각각 동일 QoS Subscriber 3개가 서로 다른 GID로
  보존되면서 하나의 표시 그룹이 되는 조건을 확인했다.
- Monitor `/transport/snapshot`은 Topic·숨김 포함 Service·Action을 각각 한 번만 조립한다. 공개 Service 목록은
  같은 전체 Service snapshot에서 숨김 정책 view로 파생하고, Node 주요 판정에는 이미 만든 Topic·전체 Service·
  Action snapshot을 전달해 내부 재조립과 시점 불일치를 제거했다. 개별 `/ros/...` 조회 호환은 유지하며 Monitor
  pytest 243건과 ROS workspace 261 tests·0 failures를 확인했다.
- Topic snapshot에 Graph 원본 `status`를 보존하면서 기존 deep monitoring 수신 판정의
  `never_received`·`stale`을 반영한 `effective_status`를 추가했다. Topic 목록·상세·요약·필터·Overview와
  WebSocket meta가 같은 대표 상태를 사용하며, 구 snapshot은 `status` fallback으로 호환한다. Alert 조건과
  Graph 판정은 변경하지 않았다. Monitor pytest 241건, Frontend unit/lint/build와 ROS workspace
  259 tests·0 failures를 확인했다.
- Interface Lab Action Goal 실행이 Feedback payload별 callback 시각과 Result future 완료 시각을 별도로 기록한다.
  Action 목록의 `last_feedback_at`·`last_result_at`과 수신 History의 `received_at`은 새 실행부터 실제 응답 시각을
  사용하고, timestamp 필드가 없는 과거 이력은 기존 `sent_at` fallback으로 호환한다. Monitor pytest 239건과
  ROS workspace 257 tests·0 failures를 확인했다.
- Action runtime snapshot이 최상위 dict만 얕게 복사해 공개 snapshot 조립 중 nested QoS/runtime 변경이
  내부 cache에 역반영될 수 있던 문제를 수정했다. `ActionRuntime.snapshot()`은 lock 안에서 Action cache를
  깊은 복사하고, 반환값의 QoS profile·상태와 feedback preview를 변경해도 다음 snapshot 원본이 유지되는
  회귀 테스트를 추가했다. Monitor pytest 237건과 ROS workspace 255 tests·0 failures를 확인했다.
- Topic UI 리팩토링으로 `TopicDetailPanel`에 섞여 있던 Camera preview 표시·modal·확대·키보드·중앙 정렬을
  `features/topics/CameraTopicPreview.jsx`로 분리했다. 중심 scroll, 25~400% zoom clamp와 Camera type 판정은
  순수 model 및 test 4건으로 고정했으며 Frontend unit test는 총 36건이다.
- Topic 상세 `Camera Image Preview` 확대창에서 `원본 크기` 옆에 `중앙 정렬`을 추가했다. 버튼 클릭뿐 아니라
  확대·축소, 화면 맞춤·원본 크기 전환과 이미지 로드 후에도 scroll viewport의 수평·수직 중심을 다시 계산해
  이미지가 왼쪽으로 치우치지 않는다. Frontend unit 32건, lint/build와 diff 검증을 통과했다.
- 안정화 11차 전체 회귀 체크포인트에서 Frontend Interface Lab unit test 32건, oxlint와 Vite build,
  Backend pytest 15 passed·2 skipped, ROS workspace 6개 package build 및 254 tests·0 failures·1 skipped를
  다시 확인했다. 1~10차 변경으로 인한 Backend·Monitor·ROS package 회귀는 발견되지 않았다.
- 안정화·리팩토링 10차로 Interface Lab 전체 snapshot 새로고침을 shared-flight로 만들었다. 초기 로드,
  실행 후 `onStateChanged`, 수동 새로고침이 겹쳐도 진행 중인 15개 API 요청 묶음과 결과를 공유하며 완료 또는
  실패 후 다음 재시도가 가능하다. 관련 test 2건을 추가해 Frontend Interface Lab unit test는 총 32건이다.
- 안정화·리팩토링 9차로 Interface Lab 실행 패널 전환에 latest-request-wins 규칙을 적용했다.
  Topic·Service·Action loader 응답이 역순으로 끝나도 마지막 선택만 mode·feedback·busy와 후속 Receive refresh를
  반영하며, 닫기는 진행 중 요청을 무효화하고 busy를 해제한다. 관련 test 3건을 추가해 총 30건이다.
- 안정화·리팩토링 8차로 Interface Lab 수신 상태와 지속 Topic Publish 상태의 1초 polling에 공통
  single-flight guard를 적용했다. 느린 응답 중 다음 tick이 와도 동일 hook의 요청을 중복 실행하지 않고,
  성공·실패 뒤 lock 해제를 unit test 3건으로 고정했으며 Frontend Interface Lab unit test는 총 27건이다.
- 안정화·리팩토링 7차로 Interface Lab 실행 패널 loader lifecycle과 workspace 확대 판정을
  `panelCoordinatorModel.js`로 분리했다. 성공·실패·미지원 mode의 상태 변경 순서와 관리 패널 유지 옵션,
  실행/수신 mode별 확대 조건을 unit test 5건으로 고정했으며 Frontend Interface Lab unit test는 총 24건이다.
- 안정화·리팩토링 6차로 `InterfaceUploadControl`이 관리 controller의 수십 개 필드를 직접 펼쳐
  View props로 재조립하던 부분을 `interfaceManagementView` adapter로 분리했다. 기존
  `managementViewProps`와 패널 닫기·접기 순서, 편집 callback alias를 contract test 2건으로 고정했으며
  Frontend Interface Lab unit test는 총 19건이다.
- 안정화·리팩토링 5차로 `InterfaceUploadControl`의 Topic·Service·Action·Receive View props 조립을
  순수 `interfaceExecutionViews.js` adapter로 분리했다. Controller 값과 callback identity, 실행/수신 mode별
  확대 조건을 contract test 2건으로 고정했으며 Frontend Interface Lab unit test는 총 17건이다.
- 안정화·리팩토링 4차로 Interface 삭제 후 Topic·Service·Action 실행 후보를 병렬 갱신하는 lifecycle을
  `useInterfaceRemovalActions`와 순수 helper로 분리했다. 삭제 함수의 기존 refresh callback 계약과 오류
  전파를 unit test 3건으로 고정했으며 Frontend Interface Lab unit test는 총 15건이다.
- 안정화·리팩토링 3차로 `InterfaceUploadControl`의 Topic·Service·Action 실행/수신 QoS 연동 조립을
  `useInterfaceQosLinks`로 분리했다. Action channel profile/mode 변환은 순수 helper로 분리해 3건을
  테스트했고 Frontend Interface Lab unit test는 총 12건이다.
- 안정화·리팩토링 2차로 `WorkspaceDetailPanel`의 탭 구성, 초기 선택, Graph 연결 수와 Endpoint QoS
  요약 생성을 순수 `workspaceDetailModel.js`로 분리했다. package/Topic/Service/Action 표시 계약과
  payload 제외 규칙을 unit test 4건으로 고정했으며 Frontend unit test는 총 9건이다.
- 안정화·리팩토링 1차로 Interface Lab에 중복돼 있던 schema type 판정, 기본값 생성과 숫자 변환을
  `schemaValues.js` 한 곳으로 통합했다. 기존 `interfaceUploadModel.js` export 계약은 유지하고 Node 내장
  unit test 5건을 추가했다. Frontend lint/build, Backend 15 passed·2 skipped, Monitor 236 passed,
  전체 workspace 254 tests·0 failures를 확인했다.
- `docs/docs2/**`와 `start.md`, archive·dependency 문서를 제외한 프로젝트 Markdown을 현재 기능과
  대조했다. Electron·구 `backend/src` 기준의 `AGENTS_ohs.md`와 일회성 QoS 중복 조사 문서는 제거하고,
  완료된 `nextstep.md`, 실행·DB·DDS/QoS·책임 경계·Frontend 안내를 현재 정책으로 직접 교체했다.
- Interface Lab의 schema 기반 JSON/object 입력을 공통 `SchemaRequestField`로 통합했다.
  Topic Publish, Service Call Request, Action Goal의 상단 실행 화면과 우측 상세 실행 화면에서
  필드별 `크게 보기/줄이기`를 독립적으로 제공하며, 기본 200px·확대 450~600px(최대 62vh)로 표시한다.
  기존 JSON parsing, schema validation, payload 생성과 Auto/Manual QoS 실행 흐름은 변경하지 않았다.
- 현재 TurtleBot3 Jazzy Gazebo의 실제 이동 입력은 `/cmd_vel`
  `geometry_msgs/msg/TwistStamped`이며 `/ros_gz_bridge`가 RELIABLE/VOLATILE로 구독한다.
  Interface Lab에 설치 타입으로 등록해 Auto QoS Publish로 전진·회전·정지와 `/odom`
  변화를 실제 검증했으며, 전용 Backend/demo Node 로직은 추가하지 않았다.
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
Monitor pytest: 278 passed
Backend pytest: 17 passed, 2 skipped
격리 MariaDB exact-schema E2E: 1 passed
실제 MariaDB Alert UI 조회 E2E: 1 passed
전체 workspace colcon test-result: 262 tests, 0 failures, 1 skipped
Frontend oxlint/build: 통과
Frontend unit test scripts: 전체 통과
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

QoS endpoint 표시 E2E에서는 임시 Monitor를 별도 8875 포트로 실행해 `/CanControl` Feedback·Status의 동일 QoS
Subscriber가 채널별 3개씩 존재하고 GID가 모두 다름을 확인했다. Topic endpoint에는 16-byte GID와 12-byte
participant prefix가 공개되고, Goal/Result/Cancel Fast DDS endpoint에는 GUID 기반 participant가 공개된다.

## 현재 문제와 제한

- 작업 트리가 dirty 상태다. 기존 변경을 reset하거나 덮어쓰지 말고 작업별 diff를 구분해야 한다.
- 현재 host의 제품 설치, 재설치, lifecycle, production HTTPS/WSS와 실제 OS 재부팅 후 systemd 자동 복구를
  검증했다. 아무 구성도 없는 별도 Fresh Ubuntu 장비의 최초 설치만 acceptance 미검증 항목으로 남아 있다.
- Topic 수신 원인 진단에서 실제 RMW incompatible event와 Subscription 생성 실패만 확정 원인이다. Graph QoS
  비교, Publisher 존재 여부와 compatible 상태 기반 안내는 기존 관찰값을 조합한 원인 후보이며 실제 장비의
  발행 callback/transport 오류를 직접 증명하지 않는다.
- Fast DDS observer는 `rmw_fastrtps_cpp`와 Fast DDS 이름 규칙에 종속된다. 다른 RMW, DDS Security 또는
  Discovery 범위 밖에서는 Service/Action Service QoS가 `graph_unavailable`이 된다.
- DDS Discovery가 제공하지 않는 History/Depth와 DataReader Lifespan은 추정하지 않는다. Service Auto의
  Lifespan은 관찰 가능한 원격 Response Writer 값을 단일 Client profile에 전달하며 Request Reader 요구값으로
  해석하지 않는다.
- fallback으로 만든 Topic entity는 이후 Graph QoS 변화에 따라 자동 재생성되지 않는다.
- 제품 설치기는 `backend/.env`의 MariaDB credential을 최초 준비하고 확정 `alert` schema를 멱등 적용한다.
  Backend runtime 자체는 테이블을 변경하지 않으며, DB 연결 실패 중 생성된 메모리 fallback 이력은 재시작 시
  사라질 수 있다.
- `nextstep.md`의 핵심 범위는 현재 요구 기준으로 완료했다. 원문에 있던 TurtleBot 전용 preset,
  Alert ACK/발생 횟수와 같은 후속 후보는 현재 진단 목적에 불필요한 추가 범위로 분류한다.
- 현재 검증 범위는 단일 기기의 Gazebo/demo와 연결된 ROS2 Graph다. 이 범위의 Browser에서는 Overview, Topic,
  Service, Action, Node를 1440x1000으로 렌더링해 목록 밀도와 헤더를 확인했고, Topic 상세 패널의
  선택 전·열기·닫기와 목록 폭 복원을 Chrome DOM에서 검증했다. 물리 장비별 인증은 배포 환경 검증이며
  미완료 제품 기능으로 분류하지 않는다.
- TurtleBot3 통합 launch는 build, launch argument 로드와 package test까지 확인했으며, 이미 실행 중인
  Gazebo/Nav2와 충돌하지 않도록 이번 작업에서 두 번째 GUI stack을 실제로 동시에 띄우지는 않았다.
- QoS 사유 배치는 source와 `frontend/dist`에서 전용 라벨/설명 2행 구조로 수정됐다.
- Action QoS UI는 기본 상태에서 Service(Goal/Result/Cancel)와 Topic(Feedback/Status) 두 요약만 표시하고,
  그룹과 개별 채널을 단계적으로 펼치는 구조다. 상태 badge와 세부 QoS 값은 정상/발견/일부/불일치/확인 불가
  색상을 사용하며 항목명 typography를 통일했다.
- 2026-08-24 Service Manual QoS 사전 불일치 변경은 운영 Frontend 정적 경로와 Monitor service에도 배포했다.
  `/RobotControl`과 `/ScheduleCrud` end-to-end 검증에서 실제 Call 없이 `qos_status=incompatible`,
  `call_status=qos_preflight_incompatible`, `sent_to_server=false`가 공개 API에 반영됨을 확인했다. Service 실행의
  HTTP 400 catch 경로도 snapshot/history를 갱신해 Interface Lab의 이전 `observed` 표시가 남지 않도록 했다.
- Service/Action Interface Lab의 적용 QoS, Client pool과 실행 history는 Monitor process 메모리 상태다. Monitor가
  재시작되면 local profile과 비교 결과를 복원하지 않으므로 원격 endpoint만 다시 발견한 Service는 `observed`로
  시작한다. 이전 `compatible/incompatible`을 영속 복원하면 stale 판정이 될 수 있어 현재는 저장하지 않는다.
- 재시작 후 Interface Lab Service 실행에서 Request/Response profile이 달라도 비교 전에 버리지 않는다. 단일 rclpy
  Client에 적용할 수 없는 split selection을 `service_profile_mismatch`의 확정 `incompatible`로 preflight state/history에
  저장하고 Call은 보내지 않는다. 이후 같은 compatible profile 실행은 Client를 생성·호출하고 `compatible`로 복구한다.
- 제품 Nginx template은 `/`와 `/assets`를 production static Frontend에서 제공하고
  `/health`·`/ros`·`/user-preferences`·`/ws/monitor`만 FastAPI 8000으로 proxy한다. 개발용 Vite/HMR은
  별도의 개발 스택 경로에 남아 있다.
- 현재 self-signed Nginx 구성의 지원 범위는 localhost와 같은 LAN의 로컬 IP 접속이다. 인터넷 공개용 인증,
  방화벽/라우터 포트 개방과 접근 제어는 포함하지 않는다.
- demo outcome server 종료 시 중복 shutdown traceback이 발생할 수 있다.
- 동일 PC의 격리 Graph 벤치마크에서 Monitor CPU는 최소 2 Nodes/7 Topics/14 Services에서 평균 4.83%,
  중간 14/19/114/4 Actions에서 6.57%, Gazebo/Nav2 25/120/313/17에서 78.43%였다. 큰 Graph의 80%대는
  재현됐으며 다음 성능 진단은 1초 Graph update의 runtime별 계측과 실제 기기 환경 재측정이 필요하다.
- Node `주요 항목`은 Backend의 최종 `is_primary`를 사용한다. disconnected 일반 Node는 주요로 유지하되,
  transform listener, launch helper, `_rclcpp_node`, `_action_client`는 `is_auxiliary=true`로 분류해 자동 주요에서
  제외한다. 명시적 `nodes.primary_names`와 사용자 별표는 보조 Node 제외보다 우선한다.
- Multi-domain child `RosMonitor`는 각 rclpy `Context`에 결합된 전용 `SingleThreadedExecutor`로 spin한다.
  `rclpy.spin(node)`의 global executor를 사용하지 않으므로 Domain별 Topic callback, Service future와 Action
  feedback/result가 선택 resource의 Context에서 처리된다.

## 다음 우선 작업

기능 구현, 개발 스택 통합 검수와 현재 Ubuntu 24.04 host의 최초 설치·재설치·lifecycle·HTTPS/WSS 검증은
완료됐다. Monitor 장애 시 Backend last-snapshot 유지와 격리 MariaDB 장애 후 memory fallback/reconnect도 실제
프로세스로 확인했다. 실제 OS 재부팅 후 Monitor, Backend, MariaDB, Nginx와 target 자동 복구도 확인했다.
설치 acceptance에서 남은 단계는 별도 Fresh Ubuntu 장비의 완전 신규 설치 확인이다.

Alert 행 focus helper, shared DetailLine, `QosDetails` 표시 파일 분리는 현재 기능 완료를 막지 않는 선택적
유지보수로 분류한다.

신규 작업은 `AGENTS.md`의 현재 책임 경계와 안전 정책을 따른다.
