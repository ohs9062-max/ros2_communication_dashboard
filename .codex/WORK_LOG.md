# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

## 2026-08-18 - Monitor Ctrl+C 이후 8765 점유 원인 조사

- 코드 수정 없이 `stop.sh`, 설치된/source systemd unit, `run_monitor.sh`, ROS2 `ros2 run` 구현, Monitor FastAPI
  lifespan과 DDS observer child lifecycle, 실제 systemd journal·PID를 대조했다.
- 재부팅 직후 08:50:35부터 systemd Monitor가 실행 중이었고 `ros2 run` parent PID 1638 아래 실제 Uvicorn Monitor
  child PID 2085가 8765를 계속 소유했다. 수동 터미널의 Ctrl+C는 이 별도 systemd cgroup에 전달되지 않으므로,
  당시 남아 있던 listener는 수동 실행의 orphan이 아니라 기존 제품 service였다.
- `stop.sh`는 target과 Monitor/Backend unit을 명시적으로 `systemctl stop`한다. Monitor unit의
  `KillMode=control-group`이 parent, 실제 Monitor child와 DDS observer를 함께 종료하며, 09:19 journal에서 child
  PID 2085의 Uvicorn shutdown 완료와 service deactivation 후 8765 해제를 확인했다.
- 설치형 제품은 프로젝트 루트의 `./scripts/start.sh`와 `./scripts/stop.sh`를 공식 lifecycle로 사용한다.
  `ros2 run ros2_dashboard_monitor monitor`는 Monitor만 단독 확인하는 개발·진단용이며 제품 service와 동시에
  실행하지 않는다.
- 개발 모드는 제품 stack을 먼저 중지한 뒤 `run_dashboard_stack.sh`/`stop_dashboard_stack.sh`를 권장한다.
  수동 실행 시에는 Monitor만 `ros2 run`, Backend는 `uvicorn`, Frontend는 `npm run dev`로 각각 실행한다.

## 2026-08-18 - start.md 제품 lifecycle 명령 정리

- 기존 수동 개발 실행, 통합 개발 stack, Demo·Gazebo 명령은 유지했다. 하단 새 Ubuntu 환경 명령을 최초 설치,
  제품 실행, 상태 확인, 접속, 종료, 재실행과 로그 확인으로 구분하고 남아 있던 conflict marker를 제거했다.

## 2026-08-18 - Overview Topic 상태 분포와 빈 Alert DB 대조

- 코드 수정 없이 현재 Backend Topic/Alert API와 Overview 집계 코드를 대조했다. MariaDB Alert row와 API Alert는
  모두 0건이지만 Overview 상태 분포는 DB가 아니라 실시간 Monitor snapshot의 주요 ROS2 resource를 집계한다.
- 현재 주요 Topic 9개는 정상 0, `no_subscriber` 주의 3, `not_discovered` 비활성 6으로 정확히
  `Topic 0 / 3 / 6 / 9`에 대응했다. 오류·비활성 열은 Alert 수가 아니므로 Alert 0건과 모순되지 않는다.
- systemd Monitor/Backend는 inactive지만 수동 개발 Monitor PID 44223, Backend PID 44257과 DDS observer PID
  44243이 각각 8765/8000/8766을 제공 중인 상태도 확인했다.

## 2026-08-18 - Overview 상태와 Topic Alert 대상 불일치 확인

- Overview의 주의/오류·비활성 집계와 실제 Topic Alert builder 입력을 추가 대조했다. `no_subscriber` 3개는
  Subscriber 부재를 장애로 보지 않는 정책에 따라 Alert가 아니며, command `/cmd_vel`, `/cmd_vel_smoothed`도
  명시적으로 Alert에서 제외된다.
- 반면 `required_stream_names`의 `/imu`, `/joint_states`, `/odom`, `/scan`은 문서와 builder 조건상 Publisher가
  없으면 `waiting_publisher` 대상이다. 공개 Topic snapshot은 이들을 `not_discovered` placeholder로 추가하지만,
  `alert_snapshot()`은 Graph cache `_topics`만 전달해 한 번도 발견되지 않은 placeholder가 Alert 계산에 들어가지
  않는다. 따라서 현재 Alert 0건에는 필수 스트림 4개의 구현 공백이 포함돼 있다.
- 코드는 수정하지 않았다. Overview의 빨간 열도 실제 error뿐 아니라 Alert가 아닌 `inactive/not_discovered`를
  함께 합산하므로 사용자에게 Alert 수처럼 보일 수 있음을 확인했다.

## 2026-08-18 - 미발견 필수 Topic waiting_publisher Alert 연결

- `RosMonitor.alerts()`가 raw Graph cache 대신 이미 생성된 공개 Topic snapshot을 Alert와 QoS 조립에 재사용하도록
  수정했다. 따라서 snapshot이 추가한 미발견 `required_stream_names` placeholder도 기존 `waiting_publisher`
  builder 조건을 통과하며 새 Alert code나 별도 판정 로직은 추가하지 않았다.
- command Topic의 조기 제외와 일반 `no_subscriber` 비Alert 정책을 유지했다. 공개 snapshot 재사용 경로를 고정하는
  회귀 테스트를 추가했고 관련 20건과 전체 Monitor pytest 245건이 통과했다.
- 기존 수동 8765 Monitor는 건드리지 않고 최신 코드를 임시 8875에서 실제 Graph로 실행했다. `/imu`,
  `/joint_states`, `/odom`, `/scan`의 `waiting_publisher` warning 4건만 생성되고 `/cmd_vel`,
  `/cmd_vel_smoothed`는 제외됨을 확인한 뒤 임시 Monitor를 정상 종료했다.

## 2026-08-18 - Gazebo 미실행 필수 Topic 주의 원인 확인

- live 설정과 API를 대조한 결과 `/imu`, `/joint_states`, `/odom`, `/scan`은 실제 Graph 발견 여부와 무관하게
  기본 `topics.required_stream_names`에 들어 있다. 따라서 Gazebo가 꺼져도 필수 Publisher 부재로
  `waiting_publisher` warning 4건이 생성되는 것이 현재 설정 의미와 일치한다.
- Topic 상세의 `There is not enough information to determine the reception issue.`는 별도 표시 문제다.
  `effective_status=not_discovered`, `reception_diagnosis=null`이어도 latest API의 `received=false`만으로
  `ReceptionDiagnosis` fallback을 렌더링해 Graph 미발견 상태를 수신 문제처럼 보이게 한다.
- 코드와 설정은 수정하지 않았다. 이 네 이름이 Gazebo/demo에서만 필요한 경우 전역 기본 필수 목록에서 제거하고
  실제 기기별 설정에서만 지정하는 것이 현재 단일 기기 진단 목적에 맞다.

## 2026-08-18 - 실제 Graph 기반 Topic 목록·Alert로 정정

- 직전 구현을 사용자 정책에 맞게 정정했다. `build_topic_snapshot()`이 `required_stream_names`와
  `command_names`만 보고 미발견 Topic placeholder를 추가하던 경로를 제거해 목록·Overview·Alert가 실제 ROS2
  Graph cache에서 수집된 Topic만 사용하도록 했다. 설정 이름은 발견된 Topic의 역할과 Alert 대상만 분류한다.
- Topic 상세는 실제 `never_received` 상태일 때만 수신 원인 안내를 표시한다. Graph 미발견/null 진단에
  `There is not enough information to determine the reception issue.` fallback을 표시하던 조건을 제거했다.
- 관련 26건과 전체 Monitor pytest 245건, Frontend unit/lint/build가 통과했다. 최신 코드를 임시 8875 Monitor로
  실행한 실제 Graph에서 Topic 5건만 반환됐고 `/imu`, `/joint_states`, `/odom`, `/scan`, `/cmd_vel`,
  `/cmd_vel_smoothed` 미발견 설정 이름은 0건, Alert도 0건임을 확인했다. 기존 수동 8765 Monitor는 변경하지 않았다.

## 2026-08-18 - 제품 start.sh ROS Domain 불일치 복구

- `start.sh` 제품 Monitor가 비어 보인 원인은 Demo Node 터미널은 `ROS_DOMAIN_ID=99`, 설치된
  `/etc/ros2-dashboard/dashboard.env`는 Domain 0이어서 서로 다른 DDS Graph를 본 것이었다. 변경 전 Monitor는
  자기 Node 1개와 Topic 0개만, 같은 시점의 터미널은 Demo Node 4개를 확인했다.
- `start.sh`는 실행 터미널에 유효한 `ROS_DOMAIN_ID`가 명시된 경우 제품 설정과 비교해 다를 때만 동기화하고
  Monitor를 재시작한다. 값이 없으면 기존 설정을 보존한다. `status.sh`에는 실제 제품 Domain 표시를 추가했고,
  최초 설치는 `ROS2_DASHBOARD_ROS_DOMAIN_ID`로 Domain을 명시할 수 있게 했다.
- 실제 제품 설정을 Domain 99로 갱신하고 systemd Monitor/Backend를 재기동했다. 제품 API에서 Demo Node 4개와
  Monitor Node, Topic 3개, `/demo_cleaning_schedule` payload/Hz를 수집했고 Backend health와 HTTPS, DDS observer,
  기존 MariaDB schema 및 Alert row 11건이 유지됨을 확인했다. shell syntax와 `git diff --check`가 통과했다.

## 2026-08-18 - Fresh clone Backend venv 이식성 수정

- Fresh Ubuntu의 `/home/hs/ros2_dashboard`에서 Backend 설치가 실패한 원인은 `backend/.venv` 539개 파일이 Git에
  추적돼 기존 `/home/hs/rang/ros2_dashboard` shebang과 `pyvenv.cfg`가 clone에 복원됐기 때문이다. `install.sh`는
  동적 `PROJECT_DIR`을 이미 사용했지만 실행 가능한 `bin/python`만 보고 이식 불가능한 venv를 재사용했으며
  절대경로 shebang의 `bin/pip`를 직접 실행했다.
- `.gitignore`의 기존 `.venv/` 규칙은 유지하고 추적 중이던 venv 파일만 Git index에서 제거했다. ROS build/install/
  log와 Frontend node_modules/dist도 Git 추적 0건임을 확인했다. 설치기는 checkout 경로, `/etc/machine-id`, Python
  executable/ABI stamp와 venv prefix·pip shebang을 검증해 불일치 venv만 재생성하며 의존성은
  `backend/.venv/bin/python -m pip`로 설치한다. 기존 `.env`, DB, Registry, 인증서는 건드리지 않는다.
- 임시 venv를 다른 경로로 이동해 pip launcher 실패와 `installer_would_reuse=false`를 재현했다. 별도의 빈 임시
  경로에서 venv 생성, Backend requirements 전체 설치와 FastAPI/httpx/uvicorn/dotenv/yaml/PyMySQL import가
  성공했다. 현재 Backend pytest 15 passed·2 skipped, Frontend `npm ci`와 production build, install.sh
  `bash -n`이 통과했다. 별도 Fresh Ubuntu VM에서 7~10단계를 포함한 installer 재실행은 아직 확인 전이다.

## 2026-08-18 - 커밋 HEAD Fresh clone 재검증

- `46adc19`와 `new-origin/main`이 동일함을 확인하고 `/tmp`의 다른 절대경로에 `--no-local` clone했다. 새 clone에는
  Backend `.venv`, ROS build/install/log, Frontend node_modules/dist가 없었고 작업 트리도 clean이었다.
- 새 clone에서 Backend venv를 생성한 뒤 requirements 설치와 필수 모듈 import가 성공했다. pip shebang과
  `sys.prefix`는 모두 새 clone 경로를 가리켰으며 개발환경 `/home/hs/rang/ros2_dashboard` 경로는 설치·애플리케이션
  대상 파일에서 발견되지 않았다.
- Frontend `npm ci`, lint, production build와 Python compileall, `install.sh` shell syntax가 통과했다. 실제 Fresh
  Ubuntu VM의 apt/rosdep/colcon/systemd/MariaDB/Nginx를 포함한 전체 installer 재실행은 환경에서 계속 확인해야 한다.

## 2026-08-18 - ROS Domain/RMW 프로젝트 .env 단일화

- 전체 검색 결과 실행 코드에 Domain 99 하드코딩은 없었고, 기존 제품 흐름은 설치 전용/현재 shell 값을 최초
  `/etc/ros2-dashboard/dashboard.env`에만 기록한 뒤 `start.sh`가 shell Domain으로 덮는 구조였다. Monitor는 rclpy
  context 환경값을 사용하고 Fast DDS observer도 그 context Domain을 전달받는 구조임을 확인했다.
- 기존 `backend/.env`를 ROS runtime 기준으로 확장하고 공통 shell helper에서 설치 전용 변수, 프로젝트 `.env`,
  현재 shell, 기본값 순으로 Domain/RMW를 해석한다. `install.sh`는 최종값을 프로젝트와 systemd env에 기록하고,
  `start.sh` 및 개발 통합 실행도 프로젝트 값을 사용한다. 기존 `.env`에 key가 없으면 설치된 runtime 값을 한 번
  이관해 기존 Domain/RMW를 보존한다.
- 우선순위, 잘못된 Domain 거부, 기존값 migration, 99→42 격리 동기화, shell syntax를 확인했다. Backend
  15 passed·2 skipped, Monitor 245 passed가 통과했다. 실제 systemd unit은 EnvironmentFile을 사용하며 실행 중
  Monitor PID 환경이 `ROS_DOMAIN_ID=99`, `RMW_IMPLEMENTATION=rmw_fastrtps_cpp`임을 확인했다. 비대화형 sudo 제약으로
  실제 시스템의 42 전환·복구는 수행하지 않고 temp runtime env에서 동일 동기화 경로를 검증했다.

## 2026-08-18 - MariaDB 무인증이 아닌 무인 설치 경로 확정

- 기존 설치기는 이미 MariaDB 설치/시작, `backend/.env` 랜덤 비밀번호 생성, root unix_socket 기반 DB·계정 생성,
  schema 적용과 검증을 자동 수행했고 Backend/status도 `.env`로 연결해 사용자 DB 로그인이 필요 없었다. 실제 로컬
  계정은 과거 설정 때문에 대상 DB에 ALL PRIVILEGES가 남아 있어 최소 권한 유지 공백을 확인했다.
- 초기화 스크립트는 관리·시스템 계정/DB를 거부하고 지정된 전용 계정의 기존 권한을 정리한 뒤 대상 DB의 SELECT,
  INSERT, UPDATE, DELETE만 부여한다. 기존 `.env` 비밀번호는 유지하고 비어 있을 때만 48자리 hex secret을 생성한다.
  root socket 접근 불가와 Backend 빈/잘못된 비밀번호 오류도 비밀번호를 노출하지 않고 명확히 보고한다.
- 네트워크를 끈 `/tmp` 독립 MariaDB에서 계정/DB/schema를 두 번 적용해 기존 Alert 행 1건 보존과 CRUD-only grant를
  확인했다. 실제 DB는 전용 계정으로 Alert 11건과 schema 정상, `.env` 0600을 확인했고 잘못된 설정 실패 후 정상
  설정 복구도 통과했다. Backend 16 passed·2 skipped와 shell/Python 문법 검사가 통과했다. 현재 운영 계정의 기존
  과권한 축소는 다음 `sudo ./scripts/install.sh` 적용 시 반영된다.

## 2026-08-18 - 전체 Markdown 실제 코드 동기화

- Git 추적 Markdown 40개를 수집하고 요청대로 `start.md`는 내용 조회·수정에서 제외했다. 나머지 39개를 현재
  source와 대조했으며 `.codex/archive` 3개는 과거 기록 보존 정책에 따라 수정하지 않았다.
- `docs/docs2`의 구 `backend/` workspace, Backend/rclpy 일체형 구조, 제거된 함수·경로·line range를 현재
  `ros2_ws` 독립 Monitor, localhost transport, 순수 Web Backend, feature별 Frontend 구조로 교정했다.
  설치·venv·MariaDB·systemd·Nginx/HTTPS/WSS·ROS Domain/RMW 문구와 README 설정 반영 명령도 현재 script와 맞췄다.
- 추적 문서 로컬 link, 남은 구 경로/API 표현과 line range를 재검사했다. Backend 16 passed·2 skipped,
  Monitor 245 passed, Frontend unit script가 통과했고 `git diff --check`를 확인했다. 코드 파일은 수정하지 않았다.

## 2026-08-18 - Alert 전체 목록 사용자 표현 정리

- `docs/alert_policy/00_total_alert.md`의 21개 실제 code와 level을 source별 Alert builder에 다시 대조했다.
- warning은 지연·일부 조건 불일치, error는 연결·실행·통신 실패 확인으로 짧게 구분하고 Topic/Service/Action/
  Node 항목을 사용자 현상명으로 교체했다. source별 01~04 정책 문서에도 같은 사용자 상태명을 추가하고 기술적
  판정 조건은 별도 설명으로 유지했다. 내부 code, level, alert_key와 판정 로직은 변경하지 않았다.
- warning/error가 모두 가능한 QoS 3종과 단일 level Alert 목록, Alert가 아닌 정상·확인 불가 상태를 분리했다.
- 전체 문서에 DB 생명주기 요약을 추가해 최초 발생은 행 추가, 지속 중에는 기존 행 유지, 해결 시 해결 시각 기록,
  해결 후 재발 시 새 행 추가라는 동작과 해결 행의 이력 보존을 명시했다.

## 2026-08-19 - MonitorStatus Alert 판정·필터 조사

- `MonitorStatus`는 Dashboard가 수치 임계값을 계산하는 상태가 아니라, 실제 Graph에서 발견하고 자동 구독한
  `ros2_dashboard_interfaces/msg/MonitorStatus`의 최신 payload `level`을 trim/lowercase한 뒤
  warning/error/critical만 그대로 Alert로 변환하는 구조임을 확인했다.
- Topic include/exclude/type 및 supported type·자동 구독 조건은 적용되지만 required/등록/primary/command,
  device/status allowlist와 confirmation 필터는 적용되지 않는다. info·빈 값·기타 level은 제외된다.
- `last_received_at`과 `age_sec`은 기록만 하며 최신 MonitorStatus의 만료 판단에는 사용하지 않는다. 새 정상
  메시지가 없으면 과거 warning/error/critical preview가 subscription 정리 전까지 Alert로 남을 수 있는 정책
  공백을 확인했으며 코드는 수정하지 않았다.

## 2026-08-19 - 사내 압축 배포의 개발환경 잔존 위험 조사

- 현재 개발 폴더를 그대로 압축하면 Git에서 제외되는 Backend `.env`/`.venv`, Frontend `node_modules`/`dist`,
  ROS `build`/`install`/`log`, `.runtime` 약 188MB와 편집기 임시 파일까지 함께 전달되는 것을 확인했다.
- 설치기는 다른 머신의 `.venv`를 판별해 재생성하고 Frontend를 다시 빌드하지만 기존 `.env`는 보존하며 ROS
  생성물을 사전에 제거하지 않으므로, 전체 폴더 압축은 비밀값 전달·Domain 설정 상속·절대경로 build 실패 위험이 있다.
- Git 추적 Interface Registry/Apply 상태에도 현재 개발 경로의 `absolute_path`, `workspace_path`, install Python
  path가 남아 있고 일부 상태 판정이 이를 읽는다. 사내 전달 전에는 Git 추적 소스만 담는 별도 배포 archive와
  Registry의 이식 가능한 상태 정리가 필요함을 확인했으며 코드는 수정하지 않았다.

## 2026-08-19 - ROS_DOMAIN_ID 처리 우선순위 및 파싱 취약점 개선

- Fresh 설치 및 일상 실행 환경에서 사용자 shell의 `export ROS_DOMAIN_ID=...` 설정이 `backend/.env`의 이전
  저장값에 의해 무시되던 우선순위 역전 문제와, `.env` 값의 인라인 주석/공백/따옴표 미정제로 인한 정수 검증(0~232)
  실패 문제를 해결했다.
- `scripts/lib/ros_runtime_env.sh`에 `ros_dashboard_trim_env_value()`를 추가하여 주석, 앞뒤 공백, 따옴표(`"`, `'`),
  `\r`을 안전하게 정제하도록 파서를 개선하고, 우선순위를 shell 환경변수 → `backend/.env` → runtime env → `0` 순으로
  교정했다.
- `scripts/start.sh` 및 `scripts/run_dashboard_stack.sh`에서 shell에 명시된 값이 결정되면 `backend/.env`에도
  동기화 저장하도록 하여 영속성을 보장했으며, 값이 변경되면 systemd Monitor가 자동으로 재시작되도록 연결했다.
- `scripts/install.sh` step 7에서 sudo 실행 시 `INSTALL_USER`의 shell 환경변수 fallback을 보강했다.
- 시나리오 1~6(쉘 우선 반영, 미설정 시 기존값 유지, 새 값 변경, 재부팅 후 영속성, 정수 범위 초과 거부, 기본값 0)
  테스트 스크립트를 작성하여 전체 통과를 확인했고, Backend pytest 16 passed, Monitor pytest 249 passed,
  Frontend test/lint/build 통과를 검증했다.

## 2026-08-20 - Service 및 Action Client 생성 시 QoS 호환(compatible) 상태 반영

- Interface Lab에서 Service Client 또는 Action Client가 생성되어 호환되는 `local_qos` 프로파일이 적용되었음에도
  Service 및 Action 목록 배지가 `QoS 발견(observed)`에 머물던 문제를 해결했다.
- `qos_profiles.py`의 `_execution_state()` 및 `_split_service_state()`에 `_is_service_profile_compatible()` 헬퍼를
  연결하여 Auto 및 Manual 모드에서 Server 엔드포인트와 호환되는 경우 `qos_status: 'compatible'` 및
  `qos_detection_source: 'fastdds_discovery'`를 정상 산출하도록 보완했다.
- `service_snapshot.py`, `action_snapshot.py`, `subscription_lifecycle.py`에서 `client_created == True`일 때
  `applied_qos`의 `qos_status`(`compatible`/`partial`/`incompatible`)를 snapshot에 정상 병합하도록 조건을 보완했다.
- Client 미생성 상태에서는 기존대로 `observed`(`QoS 발견`)를 유지하여 불필요한 Alert를 유발하지 않으며, 기존
  Frontend의 `QosStatusBadge` `['QoS 호환', 'good']` 배지를 100% 재사용했다.
- 검증: Monitor pytest 251 passed (0 failure), Frontend unit test (Node test runner) 14개 suite 전체 통과,
  Frontend oxlint 및 production build 통과를 확인했다.

## 2026-08-20 - Topic / Service / Action QoS Incompatibility Alert 복구 후 해제(resolve) 생명주기 보완

- Topic, Service, Action 3개 통신에서 QoS 불일치(`*_qos_incompatible`) 발생 후 정상 QoS로 복구되었음에도
  이전 불일치 근거(stale incompatible evidence / latch)가 잔존하여 Alert가 영구 active 상태로 남던 문제를
  전수 조사하고 최소 수정으로 해결했다.
- **원인 분석**:
  1. Topic: `ensure_subscription`에서 동일 type subscription 존재 시 조기 반환되어, 외부 Publisher의 QoS가
     변경/복구되거나 RMW incompatible event가 발생한 후 `entry['qos']` 및 `subscription`의 QoS profile이
     갱신되지 않아 snapshot의 `topic.qos_status`가 `incompatible`로 고정됨.
  2. Action: `ActionSubscriptionFacade._ensure_subscriptions`에서 동일 type 존재 시 조기 반환되어 feedback/status
     subscription의 `entry['qos']`가 갱신되지 않아 stale incompatible 상태가 `action.qos[channel]`에 계속 병합됨.
  3. Service/Action Client Pool: `dashboard_state()` 호출 시 최신 DDS observer 결과를 반영하지 않아 remote
     서버 QoS 변경/복구 상태가 `_last_state` / `_qos_by_key`에 즉시 반영되지 않음.
- **수정 내용**:
  1. `ros2_topic/subscriptions.py` & `subscription_lifecycle.py`: `ensure_subscription`에서 `qos_profile` 변경 시
     subscription을 재생성하고, 동일 profile 유지 상태에서 호환성 복구 시 `entry['qos']`를 in-place 갱신.
  2. `ros2_action/subscription_lifecycle.py` & `subscription_facade.py`: `update_action_topic_subscriptions`를 추가해
     feedback/status subscription의 QoS 변경 시 재생성 및 호환 복구 시 `entry['qos']` 갱신.
  3. `service_client_pool.py`, `service_call_runtime.py`, `action_client_pool.py`: `dashboard_state()`에서 최신
     DDS discovery 및 Topic QoS를 재평가하여 remote 서버 복구 시 `qos_status`가 `compatible`로 갱신되도록 보완.
  4. `qos_alerts.py`: `_qos_observation_token`에 `updated_at` 및 `detected_at` fallback을 추가하여 Service/Action
     QoS confirmation count가 매 갱신 주기마다 정상 동작하도록 보완.
- **검증 결과**:
  - Topic: incompatible 발생 → active Alert 확인 → compatible 복구 시 Alert 자동 resolve → 재발 시 새 row 생성 확인.
  - Service: Fast DDS observer incompatible → active Alert 확인 → compatible 복구 시 Alert 자동 resolve 확인.
  - Action: 5개 채널(goal, result, cancel, feedback, status) 각각 독립 Alert 생성/해제, 다중 채널 부분 복구 및 전체 복구 확인.
  - Monitor pytest 258 passed (7개 신규 테스트 추가), Backend pytest 16 passed (2 skipped), Frontend build 통과.

## 2026-08-20 - Service/Action QoS 수정 후 snapshot 교착 및 반복 계산 제거

- 최근 QoS resolve 보완에서 `ActionClientPool.dashboard_state()`가 non-reentrant Monitor lock을 잡은 채
  `RuntimeClientPool.keys()`와 `qos_state()`를 통해 같은 lock을 다시 획득해, Action Client 생성 뒤
  `/transport/snapshot`이 무기한 대기하는 직접 원인을 확인했다. 실제 기존 프로세스는 30초 timeout을 재현했다.
- snapshot hot path의 Client QoS 재평가를 제거했다. Service/Action Service 채널은 정기 Graph update에서 Fast DDS
  endpoint signature가 바뀐 경우에만 재계산하고, Action Feedback/Status는 기존 Action Graph/subscription cache를
  사용한다. Fast DDS Observer HTTP polling은 기존 별도 thread 1개만 유지하고 Backend cache/WebSocket 구조는 바꾸지 않았다.
- 실제 `/RobotControl` Service Call과 `/CanControl` Action Goal이 성공했고 Service 및 Action 5채널 모두
  `compatible`을 확인했다. 수정 후 `/transport/snapshot` 5회는 17.5~30.3ms, Backend `/ros/*`는 1.0~4.3ms,
  5초 CPU 표본은 Monitor 4.4%, Backend 10.2%였다. Backend CPU는 기존 1초 cache polling/Alert consume을 포함한다.
- 회귀 검증: ROS workspace build/test 278 tests, 0 failures, 1 skipped; Backend 16 passed, 2 skipped. non-reentrant
  lock 교착 및 동일 QoS snapshot 무조회 회귀 테스트 2건을 추가했다.

## 2026-08-20 - Action QoS 정상 실행 후 incompatible Alert 잔존 원인 진단

- 실제 `/CanControl` 최신 실행 History는 Goal/Result/Cancel 모두 `compatible`이고 Goal local QoS도 원격과 같은
  RELIABLE/VOLATILE였지만, 공개 Action snapshot은 과거 BEST_EFFORT/TRANSIENT_LOCAL Goal Client 상태를 선택해
  `action_qos_incompatible:goal` warning을 계속 생성하는 것을 확인했다.
- 원인은 `ActionClientPool.dashboard_state()`가 profile별 Client key 전체를 resource key 하나로 dict 변환하면서
  삽입 순서상 마지막 key를 선택하는 데 있다. 과거 incompatible profile이 나중에 처음 생성된 뒤 기존 compatible
  Client를 재사용하면 compatible key의 삽입 순서는 갱신되지 않아 `_last_key_by_resource`와 무관하게 과거
  incompatible state가 snapshot을 덮어쓴다. Alert/Backend resolve 로직은 해당 snapshot을 정상적으로 따르고 있다.
- 이번 요청은 로직 확인으로 진단만 수행했으며 코드는 변경하지 않았다. 최소 수정 지점은 `dashboard_state()`가
  전체 Client key를 순회하지 않고 이미 관리 중인 `_last_key_by_resource`의 최신 실행 key만 반환하도록 하는 것이다.

## 2026-08-20 - Action 최신 실행 QoS 선택 및 incompatible Alert 해제 수정

- `ActionClientPool.dashboard_state()`와 Service 채널 QoS refresh가 profile별 전체 Client 삽입 순서를 사용하지 않고
  `_last_key_by_resource`가 가리키는 최신 실행 Client만 사용하도록 수정했다. compatible Client 최초 생성 후
  incompatible Client 생성, 다시 기존 compatible Client 재사용 순서에서도 과거 incompatible state가 snapshot을
  덮어쓰지 않는다.
- 해당 순서를 non-reentrant lock 회귀 테스트와 함께 추가했고 Interface QoS 관련 21 tests가 통과했다. 전체 ROS
  workspace는 280 tests, 0 failures, 1 skipped를 확인했다.
- 실제 `/CanControl`에서 compatible→incompatible→기존 compatible Client 재사용을 실행했다. Goal snapshot이
  `compatible`로 복귀했고 Monitor Alert는 `active=false`, Backend 현재 Alert 0건, DB history의 `resolved_at`
  기록을 확인했다.

## 2026-08-20 - Topic/Service/Action QoS 불일치 시 전송 의미 확인

- Interface Lab 실행기는 계산된 `qos_status=incompatible` 자체를 공통 사전 차단 조건으로 사용하지 않는다.
  Topic은 `Publisher.publish()`가 로컬 writer에 샘플을 넘기면 `sent_to_topic=true`로 기록하므로 호환 Subscriber가
  실제 수신했다는 뜻이 아니다. QoS 불일치면 DDS matching이 되지 않아 상대 callback에는 전달되지 않는다.
- Service는 `client.service_is_ready()`가 false이면 `call_async()` 전에 종료해 `sent_to_server=false`가 된다.
  Action도 Goal Service가 불일치하면 `client.server_is_ready()`가 false여서 실제 이력에서
  `sent_to_server=false`, `goal_send_failed`, `Action server is not available`을 확인했다.
- Action은 5채널이 독립이므로 Goal Service가 compatible이면 Result/Cancel/Feedback/Status 중 다른 채널이
  incompatible이어도 Goal 요청 자체는 전송될 수 있다. 이후 accept/result timeout, feedback 미수신 또는 cancel
  실패로 나타나며, 이는 Goal 전송과 다른 채널의 전달 성공을 구분하는 정상적인 Action 구조다. 코드 변경은 없었다.

## 2026-08-20 - WORK_LOG 분할 방식 검토

- `WORK_LOG.md`가 1,352줄·약 116KiB로 커졌고, 현재 규칙인 최근 20~30개 작업 유지 범위를 넘은 것을 확인했다.
- 날짜별 원본 로그와 짧은 최근 작업 인덱스를 분리하는 방식을 권장했다. 실제 분할과 규칙 변경은 아직 수행하지 않았다.

## 2026-08-20 - WORK_LOG 날짜별 archive 규칙 명문화

- `AGENTS.md`에 작업 시작 시 archive 전체를 읽지 않고 필요할 때만 검색하도록 명시했다.
- 현재 `WORK_LOG.md`는 최근 20~30개 작업만 유지하고, 초과분은 날짜별
  `.codex/archive/WORK_LOG_YYYY-MM-DD.md`로 옮기는 규칙을 추가했다. 실제 기존 로그 분할은 다음 작업부터 적용한다.
- 인수인계 정책 변경을 `.codex/CURRENT_STATUS.md`에도 반영했다.

## 2026-08-20 - 프로젝트 Markdown 전체 코드 대조 및 최소 갱신

- `.codex`를 제외한 실제 프로젝트 Markdown 38개를 코드, 설정, API route, 실행 script와 대조했다. `.venv`,
  `node_modules`, pytest cache에서 발견되는 59개 Markdown은 생성물/외부 의존성이므로 수정 대상에서 제외했다.
- ROS runtime shell 우선순위와 Nginx 설정 파일명, 최근 Service/Action QoS cache·snapshot 구조, Topic Publish의
  로컬 성공과 Subscriber 수신 차이, Service/Action readiness와 Action 5채널 전송 의미를 기존 문서 위치에 반영했다.
- 구 발표 문서의 resolved 60초/재활성화 설명을 MariaDB 해결 이력·재발 새 row 정책으로 교정하고, Demo Camera와
  현재 host 설치 검증을 실제 확인 범위보다 넓게 표현한 문구를 바로잡았다. `nextstep.md` 표와 `start.md` 코드블록,
  SQL/clone 명령도 원본 구조를 유지하며 수정했다.
- 최근 WORK_LOG 25개만 남기고 이전 112개를 날짜별 archive 4개로 원문 이동했다. Markdown 로컬 링크와 코드블록
  균형 검사, stale 문구/경로 검색, `git diff --check`가 통과했다. 기능 코드는 변경하지 않아 전체 build/test는
  실행하지 않았다.
