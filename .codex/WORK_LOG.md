# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

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

## 2026-08-20 - 문서 디렉터리 재배치 방향 검토

- 루트에는 `README.md`, `AGENTS.md`와 package-local `frontend/README.md`만 진입 문서로 유지하고, 나머지 루트
  설명·운영·발표 문서는 `docs/`의 역할별 하위 디렉터리로 옮기는 구성을 권장했다. 실제 파일 이동은 수행하지 않았다.

## 2026-08-20 - 슬라이드 9 `/cmd_vel` Topic QoS 표시 경로 검수

- Topic 상세의 Publisher/Subscriber QoS 카드는 Monitor의 rclpy Graph endpoint API 결과를
  `publisher_qos`/`subscriber_qos`로 직렬화한 값이며, Backend는 이를 변환하지 않고 cache/REST/WebSocket으로
  전달하고 Frontend `QosDetails`가 endpoint의 `qos.history`와 `qos.depth`를 직접 표시함을 확인했다.
- 현재 실행 중인 `/cmd_vel` Graph를 같은 API로 조회한 결과 `ros_gz_bridge`를 포함한 endpoint의 원본
  `TopicEndpointInfo.qos_profile`이 이미 `history=UNKNOWN`, `depth=0`이었다. Fast DDS observer는 Service 계열
  Request/Response endpoint만 다루므로 이 Topic 표시에는 관여하지 않으며, 알려진 값이 전달 중 유실되는 버그도
  관련 snapshot 회귀 테스트로 부정했다.
- 현재 compatibility 경로의 rclpy `qos_check_compatible()`와 프로젝트 mismatch 요약은 History/Depth 차이를
  incompatible로 판정하지 않는다. Topic QoS 관련 21 tests가 통과했으며 이번 검수에서는 코드 변경을 하지 않았다.

## 2026-08-21 - Topic/Service/Action `compatible` 판정 의미 검수

- Topic Graph 상태는 rclpy endpoint API의 Publisher×Subscription 전체 조합을 `qos_check_compatible()`로 비교하며,
  Dashboard local entity가 없어도 양쪽 Graph endpoint에 ERROR가 없으면 `compatible`이 된다. Topic Auto 실행은
  선택 candidate와 반대편 remote endpoint를 실제 비교하지만 Manual 실행은 현재 Graph aggregate 상태에 local
  profile만 덧붙여 사전 local-vs-remote 비교를 하지 않고, 생성 뒤 RMW incompatible event로만 불일치를 보완한다.
- Service/Action Service 채널 Auto는 Fast DDS Request Reader/Response Writer의 공통 호환 범위를 계산해 profile을
  만든 뒤 계산 성공을 `compatible`로 기록하는 A 방식이며, 생성 후 같은 profile을 다시 비교하는 B 방식은 아니다.
  Manual은 `_is_service_profile_compatible()`로 local profile을 remote와 명시 비교한다. Call/Goal 성공 여부는
  compatibility 입력이 아니고 Client 생성 여부는 계산된 execution state를 공개 snapshot에 병합하는 gate다.
- Action Goal/Result/Cancel은 위 Service 방식, Feedback/Status는 Topic 방식이다. UI 대표 상태는 5채널 전부가
  compatible일 때만 compatible이다. 따라서 “QoS 호환은 항상 Dashboard local/remote 실제 비교 결과”라는 무조건적
  표현은 성립하지 않는다. 관련 QoS/lifecycle 테스트 43건이 통과했고 기능 코드는 변경하지 않았다.

## 2026-08-21 - Interface Lab 실행 전 QoS 선계산 trigger 구조 검수

- Service/Action QoS resolver는 Client 생성과 실제 Call/Goal 전송 전 호출되며 계산 자체는 entity 생성, DB 변경,
  observer 재시작 같은 side effect가 없다. 따라서 기본 Auto selection은 endpoint QoS signature 변경 시 미리 계산해
  state에 저장하는 구조로 옮길 수 있다. 현재 정기 Graph update에도 이미 Client가 있는 resource만 signature 변경 시
  재계산하는 `refresh_qos()`/`refresh_service_qos()` 패턴이 존재한다.
- 단순 호출 위치 이동만으로 끝나지는 않는다. 현재 Service `_last_state`와 Action `_qos_by_key`는 생성된 Client를
  기준으로만 보관하고, Manual 선택값은 실행 전까지 Frontend `useState`에만 있다. 실행 전 Auto 표시에는 Client와
  독립된 precomputed state cache가 필요하고, Manual까지 즉시 표시하려면 설정 변경 preview API 또는 선택값 동기화와
  selection fingerprint 기반 무효화가 필요하다.
- 최적 trigger는 remote endpoint QoS signature 변경이고 Manual은 설정값 변경 trigger를 함께 써야 한다. snapshot마다
  계산하는 방식은 기존 성능 회귀를 되살릴 수 있어 피해야 하며, 실행 직전에는 cached signature/selection을 확인해
  같으면 재사용하고 다르면 한 번 재계산하는 안전장치가 필요하다. 관련 QoS/lifecycle 테스트 43건이 통과했고 기능
  코드는 변경하지 않았다.

## 2026-08-24 - QoS 무제한 duration 표시 문구 변경

- 공통 `QosDetails.durationValue()`의 infinite duration 표시만 변경해 Deadline은 `주기 제한 없음`, Lifespan은
  `유효시간 제한 없음`, Lease duration은 `생존시간 제한 없음`으로 통일했다. QoS 값, 계산, 색상과 레이아웃,
  Backend/Monitor는 변경하지 않았다.
- Frontend `npm run test:unit`, `npm run lint`, `npm run build`가 통과했다. 프로젝트에는 `npm test` script가 없어
  최초 명령은 실행되지 않았고 등록된 실제 unit test script로 검증했다.

## 2026-08-24 - QoS duration 문구 운영 UI 미반영 원인 수정

- source와 새 `frontend/dist`에는 변경 문구가 있었지만 Nginx가 제공하는 `/var/lib/ros2-dashboard/frontend`에는
  이전 bundle이 남아 있어 운영 UI에 구 문구가 표시됐다. 새 production build를 실제 정적 제공 디렉터리에
  `rsync --delete`로 동기화했다.
- 배포 `index.html`이 새 `index-bOdV9drD.js`를 참조하고 배포 bundle에는 새 세 문구만 있으며 구 세 문구는 없음을
  확인했다. Frontend unit test, lint, production build를 다시 실행해 모두 통과했다.

## 2026-08-24 - Ubuntu 24.04 변형 환경 install.sh 안전성 검수 및 보완

- 설치 기준을 Ubuntu 24.04 amd64/arm64, ROS2 Jazzy, Ubuntu system Python 3.12, Node.js
  `^20.19.0 || >=22.12.0`로 코드·lockfile과 대조했다. 현재 장비의 MariaDB 10.11.14와 Nginx 1.24는 Ubuntu
  24.04 package이며 별도 고정 버전이 아니라 schema 검증과 `nginx -t`를 호환성 경계로 사용한다.
- Fresh 최소 설치에서 `universe` 활성화 전에 `python3-venv`와 MariaDB를 설치하던 순서를 교정했다. Jazzy package를
  실제 제공하지 않는 ROS apt source, 다른 ROS 환경변수 혼입, 변경된 `/usr/bin/python3`, 지원 밖 Node 또는 npm
  누락을 명시적으로 감지하고, 다른 ROS 배포판은 삭제하지 않은 채 Jazzy 빌드 환경만 격리하도록 보완했다.
- Nginx는 인증서/key 중 하나만 남은 상태를 덮어쓰지 않고 중단하며, 새 Dashboard 설정이 `nginx -t`에 실패하면
  직전 설정을 복구한다. 완료 검사는 단순 HTTPS 200이 아니라 Dashboard 고유 HTML을 확인해 기존 443 사이트를
  설치 성공으로 오인하지 않는다. MariaDB의 기존 schema/Alert와 project 전용 systemd/Nginx 백업 정책은 유지했다.
- 기존 venv가 system/user site package를 노출하면 재사용하지 않고 격리 venv로 재생성하며, Backend pip 실행에서
  외부 Python 환경변수를 제거한다. Node/npm도 root 검사 결과와 설치 사용자 login shell의 PATH가 달라지지 않도록
  검증된 실행 파일 경로를 build에 고정한다.
- 격리 테스트에서 Python 3.12 허용·3.11 차단, Node 20.19/22.12/24 허용·20.18/22.11 차단, npm 누락 차단,
  Jazzy apt package 유무, Humble/Rolling 탐지, 이동 venv 거부와 Humble 환경에서 Jazzy 격리를 확인했다. 현재 DB는
  schema 정상·Alert 22건, 관련 service는 active/enabled였다. 깨끗한 Python 3.12 venv의 최신 requirements 설치와
  Backend 16 passed·2 skipped, Frontend `npm ci`/lint/unit/build, ROS workspace 280 tests·0 failures·1 skipped를
  통과했다. 별도 Fresh VM은 없었고 현재 host는 sudo 암호가 필요해 수정 후 전체 installer 재실행은 수행하지
  못했으므로 acceptance의 Fresh Ubuntu 항목은 계속 미검증이다.

## 2026-08-24 - Dashboard 전용 Python/Node/ROS side-by-side 환경 구성

- 설치 차단 중심 정책을 기존 환경 보존 중심으로 변경했다. 시스템 기본 `python3`를 검사·교체하지 않고 Ubuntu의
  `/usr/bin/python3.12`와 `python3.12-venv`를 side-by-side로 확보해 Backend 전용 `.venv`를 만들며, venv의
  `_base_executable`이 해당 interpreter인지 설치 중 검증한다. 다른 Python 기반이거나 system site를 노출하는 기존
  venv만 Dashboard 생성물 범위에서 재생성한다.
- Backend systemd는 `.venv/bin/python`을 유지하면서 `PYTHONPATH`/`PYTHONHOME`/기존 venv·pip 환경을 최종 제거하고
  user site도 비활성화해 runtime이 외부 Python package를 끌어오지 않도록 고정했다.
- 전역 NodeSource apt 설정과 `nodejs` 교체를 제거했다. 공식 Node.js 22.23.2 tarball을 amd64/arm64별 고정 SHA-256으로
  검증해 `/opt/ros2-dashboard/toolchains` 아래에 설치하고 `node` symlink로 재사용한다. Frontend install/build와
  설치 후 개발 stack은 이 toolchain을 우선 사용하며 시스템 Node는 변경하지 않는다.
- 다른 ROS 배포판은 보존한다. installer, systemd Monitor, 개발 build/실행과 Interface Apply가 기존 ROS 환경변수를
  제거하고 Jazzy만 source하며 rosdep/colcon/Monitor를 `/usr/bin/python3.12`로 실행한다. Monitor는 `ros2` shebang을
  우회해 Python module을 직접 실행하고 rclpy가 Jazzy Python 3.12 경로에서 import되는지 시작 시 확인한다.
- Python 3.11 기본 모형과 Python 3.12 venv 공존, Humble 환경 주입 후 Jazzy/rclpy 격리, Node 22.23.2 checksum·실행·
  재사용 및 시스템 Node 20.20.2 보존을 확인했다. 전용 Node로 Frontend `npm ci`/lint/unit/build, Backend
  16 passed·2 skipped, Monitor 262 passed, ROS workspace 280 tests·0 failures·1 skipped를 통과했다. npm audit의
  기존 dependency 결과로 high 2건이 보고됐으며, 별도 Fresh VM과 sudo 전체 installer 재실행은 환경 제약으로 남았다.

## 2026-08-24 - install.sh 시작 1회 sudo 인증과 credential keepalive

- 기존 설치기는 `sudo ./scripts/install.sh`로 전체를 root 실행하면서 ROS dependency/build의 `run_as_user()`에서
  다시 `sudo -u`를 호출했다. 특히 step 5의 일반 사용자 `rosdep install`은 package 설치를 위해 내부에서
  `sudo -H apt-get`을 실행하므로, 앞 단계의 root 직접 명령 동안 갱신되지 않은 사용자 credential이 만료되면
  이 지점에서 처음 비밀번호를 다시 요구할 수 있었다.
- 설치기를 일반 사용자로 실행하고 시작 시 안내 후 `sudo -v`를 한 번 수행하도록 변경했다. 45초마다
  `sudo -n -v`로 credential을 유지하며 이후 시스템 변경과 rosdep 내부 sudo도 전부 `sudo -n`으로만 실행한다. Backend venv,
  ROS workspace, Frontend dependency/build와 project `.env`는 일반 사용자 작업으로 유지했다.
- keepalive는 외부 sleep 자식을 만들지 않는 FIFO timeout 방식이며 EXIT/ERR/SIGINT/SIGTERM에서 process와 임시
  control path를 정리한다. 정상 종료·명령 실패·SIGINT 모형 테스트, 전체 installer shell syntax, 기존 install environment test, 생성물 root 소유 여부 검사와
  `git diff --check`가 통과했다. 샌드박스 `no_new_privileges` 제한으로 실제 sudo 전체 설치·재설치는 수행하지 않았다.

## 2026-08-24 - Service Manual QoS 불일치 사전 판정 snapshot 반영

- Service는 실행 QoS를 계산해도 `ServiceClientPool.get_or_create()`가 성공한 뒤에만 `_last_state`에 저장했고,
  `assemble_service_snapshot()`도 `interface_client_created=true`일 때만 local 판정을 병합했다. 따라서 QoS 불일치로
  Client 생성/호출 전에 차단되면 이전 observed/compatible 배지가 남았다. Action은 client factory 전에 state와
  최신 key를 저장하므로 같은 공백이 없었다.
- Service QoS 판정을 resolve 직후 `record_qos_attempt()`으로 저장하고, client 생성 여부와 dashboard state를
  분리했다. 확정 incompatible은 `qos_preflight_incompatible`, `sent_to_server=false`로 기록한 뒤 Client lookup과
  `call_async()` 전에 차단한다. snapshot은 client가 없어도 compatible/partial/incompatible을 병합하며 endpoint
  signature 변경 refresh도 preflight-only state를 포함한다.
- compatible→incompatible→compatible 복구, client 미생성 incompatible snapshot 병합, 사전 차단 시 Client lookup과
  Call 미실행, Auto/Action 및 기존 QoS Alert 정책 회귀를 검증했다. 관련 43 tests, Monitor pytest 265 passed,
  colcon package 결과 283 tests·0 errors·0 failures·1 skipped, Frontend unit/lint/build와 `git diff --check`가
  통과했다. 새 사전 차단 history 상태는 `QoS 불일치`로 표시하고 Service 대표 상태/Alert 정책은 바꾸지 않았다.

## 2026-08-24 - Service QoS 불일치 운영 UI 반영 확인

- source와 `frontend/dist`는 최신이었지만 운영 Nginx 정적 경로 `/var/lib/ros2-dashboard/frontend`가 오전의 이전
  hash bundle을 계속 제공하고 있었다. 최신 dist를 운영 경로에 동기화하고 `ros2-dashboard-monitor.service`를
  재시작해 Python runtime 변경도 함께 반영했다.
- HTTPS가 최신 `index-CGzEXTtL.js`와 `servicePresentation-CTJVJ-5D.js`를 제공하고, Monitor는 14:45:26 KST부터
  active 상태이며 Backend health의 `monitor_connected=true`를 확인했다.
- `/RobotControl`에 Request/Response 모두 best-effort인 Manual profile을 적용한 검증 요청은 Client/서버 전송 전에
  HTTP 400으로 차단됐다. 직후 공개 Service API는 `qos_status=incompatible`, `call_status=qos_preflight_incompatible`,
  `sent_to_server=false`, `interface_client_created=false`를 반환했다. Frontend `QosStatusBadge`는 이 상태를
  `QoS 불일치`로 표시한다.
- `/ScheduleCrud`로 동일 검증을 반복해 이름별 하드코딩이 없음을 확인했다. Monitor history/state는 즉시
  incompatible을 저장했지만 Frontend Service 실행의 HTTP 400 catch 경로가 snapshot/history refresh를 생략해
  Interface Lab 화면만 `observed`에 머물 수 있었다. inline/기존 Service controller의 실패 경로도 refresh하도록
  수정하고 Frontend lint/unit/build를 통과한 뒤 최신 `index-DRdVeOQQ.js`를 운영 HTTPS 경로에 배포했다.
- Monitor 재시작 후 `/RobotControl`과 `/ScheduleCrud`가 모두 `observed`로 돌아가는 것도 확인했다. Service의
  `_last_state`, `_last_selection`, Client pool과 Call history는 Monitor process 메모리 상태이며 영속 저장하지 않는다.
  재시작하면 적용 local profile과 비교 결과가 없어지고 Fast DDS가 다시 발견한 remote endpoint 사실만 남으므로
  `local_qos=null`, `call_status=not_called`, `qos_status=observed`가 되는 것이 현재 lifecycle 의미다.
- 재시작 후 실제 UI 버튼 POST들이 400을 반환했지만 history가 비어 있던 원인은 Request/Response profile fingerprint가
  다를 때 `resolve_split_service_execution_qos()`가 `record_qos_attempt()`보다 먼저 예외를 던졌기 때문이다. 이 경우도
  두 채널 계산 결과를 `qos_status=incompatible`, `qos_error_type=service_profile_mismatch`, top-level local profile 없음으로
  반환해 기존 preflight 저장/Call 차단/snapshot merge 경로를 타도록 수정했다.
- 새 Monitor PID 264020에서 `/ScheduleCrud`와 `/RobotControl`을 모두 검증했다. HTTPS proxy 기준 서로 다른 split
  profile은 두 Service 모두 `observed→incompatible`, `sent_to_server=false`, Client 미생성이었고, 같은 reliable
  profile 실행은 둘 다 응답 성공 후 `compatible`, `sent_to_server=true`로 복구됐다. 관련 47 tests, Monitor 전체
  266 passed, colcon 결과 284 tests·0 errors·0 failures·1 skipped를 통과했다.

## 2026-08-24 - System QoS와 Interface Lab Execution QoS 분리 구현성 검수

- 일반 Topic QoS는 rclpy Graph의 Publisher×Subscriber를 비교하지만 Dashboard endpoint를 제외하지 않고, 자동
  monitoring subscription state가 top-level 상태를 덮는다. Service는 Fast DDS server endpoint만 Python cache에
  남긴 뒤 Interface Lab Client 판정을 snapshot에 병합하며, Action도 3개 Service와 2개 Topic 관찰 상태에 monitoring/
  Interface Lab Client 상태를 합쳐 일반 배지와 QoS Alert가 System/Execution 의미를 혼용함을 확인했다.
- Fast DDS C++ observer는 Client Request Writer/Response Reader와 Server Request Reader/Response Writer를 이미
  모두 수집하고 역할·service name·channel·GUID·QoS를 제공한다. 실행 중 snapshot 130개 중 client 8개/server 122개,
  `/ScheduleCrud`와 `/RobotControl` 양방향 Client endpoint를 확인했다. 다만 Python `_replace_snapshot()`이 client를
  버리며 observer에는 ROS node identity가 없다.
- Dashboard DDS GUID participant prefix는 rclpy Topic Graph에서 `dashboard_owned=true`인 Monitor participant ID와
  구두점만 제거하면 실제로 일치했다. 따라서 외부 endpoint 제외와 signature 변경 시 resource별 재계산은 가능하지만,
  participant 정규화·동일 participant 보장과 node label 한계를 먼저 통합 테스트로 고정해야 한다. 코드는 수정하지
  않았으며 권장안은 nested `system_qos`/`execution_qos` 분리와 legacy top-level System alias의 단계적 전환이다.

## 2026-08-24 - install.sh 다른 LAN IP·포트 처리 검수

- 제품 외부 진입점은 Nginx HTTPS/WSS뿐이며 `0.0.0.0/[::]:443`에 listen한다. Monitor 8765, observer 8766,
  Backend 8000과 MariaDB는 localhost 내부 연결이므로 이 주소 하드코딩은 다른 LAN PC 접속을 막는 원인이 아니다.
  Frontend production build도 API base를 비워 현재 page origin의 REST/WSS를 사용한다.
- 실제 주소 `192.168.1.123`에서 self-signed 인증서를 CA로 지정한 HTTPS Frontend 200, Backend `/health`, TLS IP SAN,
  WSS `101 Switching Protocols`를 확인했고 Backend 8000은 LAN 주소에서 직접 연결되지 않았다. Nginx는 IPv4/IPv6
  전체 interface에 listen했으며 Monitor/Backend/observer는 127.0.0.1에만 listen했다.
- Fresh 단일-NIC 설치는 현재 IP를 인증서 SAN과 기본 server_name에 넣어 동작하지만, `hostname -I` 첫 주소 선택,
  기존 인증서의 새 IP SAN 미검사·무조건 보존, 복사된 ignored `config/nginx/dashboard.env`의 stale server_name,
  localhost만 확인하는 설치 완료 검사, custom HTTPS port를 무시하는 완료 URL/status.sh를 위험으로 확인했다.
  별도 VM은 guest agent·주소·SSH가 없어 전체 타 장비 설치는 미검증이며 애플리케이션 코드는 수정하지 않았다.

## 2026-08-24 - 설치기 네트워크/IP 자동 선택과 TLS 검증 개선

- `hostname -I` 첫 주소 대신 공통 `scripts/lib/network_env.sh`에서 명시 `DASHBOARD_LOCAL_IP`, default-route
  interface IPv4, 허용된 활성 IPv4, `hostname -I` fallback 순으로 선택한다. docker/Podman/libvirt/container
  bridge와 loopback/link-local은 자동 후보에서 제외하고, 추가 물리/VPN IPv4는 SAN 후보로 유지한다. IPv6 자동
  SAN은 현재 지원하지 않는다.
- `install_local_https.sh`는 stale auto IP를 현재 주소로 교체하고 선택 결과를
  `/etc/ros2-dashboard/network.env`에 저장한다. 기존 인증서의 SAN과 key pair를 검사해 모두 맞으면 재사용하고,
  fingerprint marker가 일치하는 installer 관리 인증서만 백업 후 재생성한다. marker가 없는 custom/legacy
  인증서에 SAN이 부족하면 덮어쓰지 않고 조치 안내와 함께 중단한다.
- Nginx listen, 완료 URL, `status.sh`, HTTPS/health/WSS 검증이 같은 custom port를 사용한다. UFW active 상태에서
  allow rule이 확인되지 않으면 네트워크 정책을 바꾸지 않고 경고한다. Frontend의 current-origin REST/WSS와 내부
  localhost 8000/8765/8766 경계는 유지했다.
- 합성 A~H 테스트와 install environment/sudo session 테스트, shell syntax, scoped diff check, Frontend unit/lint/build가
  통과했다. 현재 장비에서는 `192.168.1.123`을 default-route 주소로 선택했고 LAN HTML/health 200, TLS SAN,
  WSS 101, 내부 port localhost bind와 LAN 8000 차단을 확인했다. sudo가 필요한 변경 installer 전체 재실행과
  별도 물리 PC/VM Fresh 설치는 수행하지 않았으므로 코드/현재 runtime 검증과 구분한다.

## 2026-08-25 - 통신 상세 요청형 최근 데이터 history

- Topic 자동 Subscription callback이 실제 수신한 lightweight preview를 resource별 `deque(maxlen=100)`에 최신순으로
  보존하도록 했다. `topics.history_limit`은 1~500 범위 설정이며 Camera Image/CompressedImage는 원본 binary나
  data URL 대신 기존 metadata와 `payload_size_bytes`만 저장한다. append에서 deepcopy하지 않는다.
- Service와 Action은 새 payload 관찰기를 만들지 않고 기존 Interface Lab 실행 history를 재사용한다. Service는
  Request/Response/success/error/timeout/duration, Action은 Goal/accepted/Feedback/Result/final status/duration을
  이름·타입으로 필터링한다. 외부 Service payload와 외부 Action Goal payload를 Graph/Fast DDS 정보로 합성하지 않는다.
- `/ros/topics/history`, `/ros/services/history`, `/ros/actions/history`를 Monitor에 추가했고 Backend의 기존 async
  catch-all proxy를 그대로 사용한다. Frontend 공통 `CommunicationHistory`는 각 상세의 접힌 로그를 처음 열거나
  새로고침할 때만 호출하며 Service/Action은 `Interface Lab 실행 이력`임을 명시한다. 정기 transport/WebSocket
  snapshot에는 history가 추가되지 않았다.
- 임시 Monitor 8875의 실제 ROS Graph에서 `/cmd_vel` 100건이 최신순으로 bounded되고 `/RobotControl` Call의
  Request/Response, `/CanControl` Goal의 Feedback/Result와 `succeeded`가 상세 API에 기록됨을 확인했다. 일반
  snapshot의 Topic/Service/Action에는 history key가 없고 WebSocket JSON은 896 bytes였다.
- 소형 Topic preview 20,000회 benchmark에서 기존 callback 7.931µs/message, history 포함 7.986µs/message로 증분
  0.054µs였고, 100건 retained memory 증분은 44,450 bytes였다. 100건 상세 JSON은 7,385 bytes, 직렬화는 호출당
  약 0.046ms였으며 snapshot 크기는 history 유무 모두 125 bytes였다.
- Monitor 전체 271 passed, Backend 16 passed·2 skipped, Frontend unit/lint/build, Monitor package colcon
  271 tests·0 failures와 compileall/diff check를 통과했다. 운영 Frontend 동기화와 Monitor restart는 운영 변경
  위험으로 승인되지 않아 수행하지 않았으며 source와 production build까지만 완료했다.

## 2026-08-25 - HTTPS 운영 UI 미반영 원인 재확인

- 소스의 최신 `frontend/dist/index.html`은 11:43 KST 빌드의 `index-ejcbpnGB.js`를 참조하지만, Nginx 운영 경로
  `/var/lib/ros2-dashboard/frontend/index.html`은 8월 24일 14:53 KST의 `index-DRdVeOQQ.js`를 계속 참조했다.
  따라서 최근 데이터 UI가 보이지 않는 직접 원인은 브라우저 캐시나 React 조건 분기가 아니라 최신 production
  build가 HTTPS 정적 경로에 배포되지 않은 것이다.
- 현재 검사 namespace에서는 localhost 8765와 HTTPS 응답을 직접 확인하지 못했다. 새 history route는 Monitor
  Python 변경이므로 정적 파일 동기화와 함께 `ros2-dashboard-monitor.service` 재시작이 필요하다. Backend/Nginx
  재시작은 필요하지 않다.
- 기존 파일을 삭제하지 않는 `rsync -a` 동기화와 Monitor 단독 재시작을 요청했으나, 운영 변경에 대한 사용자의
  명시적 승인이 필요하다는 정책 검토로 실행 전 차단됐다. 운영 파일이나 서비스는 변경되지 않았다.

## 2026-08-25 - 로컬 HTTPS 환경과 반영 용어 명확화

- 사용 환경은 외부 production 배포가 아니라 Dashboard와 ROS2가 같은 장비에서 실행되고 Browser가 localhost/LAN
  IP의 Nginx HTTPS/WSS로 접속하는 로컬 환경임을 AGENTS, README, HTTPS 문서와 CURRENT_STATUS에 명시했다.
- 앞으로 `frontend/dist`를 `/var/lib/ros2-dashboard/frontend`에 맞추는 작업은 “운영 배포”가 아니라 “로컬 HTTPS
  실행 파일 동기화/반영”으로 표현한다. 사용자가 원격 서버를 명시하지 않으면 별도 production 배포를 전제하지 않는다.
- UI 변경 검증은 Vite나 source build만 보지 않고 source dist, 로컬 HTTPS 정적 경로, 실제 HTTPS 응답의 asset hash를
  대조한다. 이번 문서 작업에서는 정적 파일 동기화나 service 재시작을 수행하지 않았다.

## 2026-08-25 - 최근 데이터 UI 로컬 HTTPS 반영 완료

- 사용자 승인 뒤 최신 `frontend/dist`를 같은 장비의 `/var/lib/ros2-dashboard/frontend`에 동기화하고
  `ros2-dashboard-monitor.service`만 재시작했다. Backend와 Nginx는 설정 변경이 없어 재시작하지 않았다.
- source dist와 설치 정적 경로의 `index.html` SHA-256이
  `0920cf8cab9ebfa989bfa646f6a8531813a91cdcea970a74e07dab8c46655b66`로 일치하고 실제
  `https://127.0.0.1/`도 새 `index-ejcbpnGB.js`와 `index-IT3d-VQn.css`를 HTTP 200으로 제공했다. 제공 bundle에
  최근 데이터 UI와 Interface Lab 이력 문구가 포함된 것도 확인했다.
- 재시작된 Monitor는 PID 118016, 11:52:26 KST부터 active/running이다. Topic/Service/Action History는 Monitor
  직접 경로와 HTTPS Backend proxy에서 모두 HTTP 200이었다. `/cmd_vel`은 최신 2건 payload를 반환했고 재시작 직후
  Service/Action Interface Lab 메모리 이력은 설계대로 빈 배열이었다. HTTPS health는
  `monitor_connected=true`를 반환했다.

## 2026-08-25 - 최근 데이터 로그 연속 스크롤 UI

- Interface Lab Topic Receive의 즉시 `<pre>` JSON 표시, dark color, `pre-wrap`/word-break 표현을 참고해 공통
  `CommunicationHistory`의 항목별 `<details>` 카드와 클릭 펼치기를 제거했다. Topic/Service/Action 모두 하나의
  `role=log` 영역에서 최신순 timestamp·상태·pretty JSON을 바로 표시한다.
- 로그 영역은 `height: min(52vh, 520px)`, 최소 180px와 내부 세로 스크롤을 사용한다. 각 항목은 별도 카드 대신
  구분선으로만 나뉘며 긴 JSON은 가로 스크롤보다 줄바꿈한다. 새로고침, 빈 상태, 요청형 API와 저장 정책은 유지했다.
- `buildHistoryRows()`가 timestamp/status/payload JSON을 만들고 React `useMemo`가 items/kind 변경 때만 계산한다.
  소형 Topic 100건 포맷 benchmark는 평균 0.047ms/100건(0.4702µs/row)이었다. Topic 최신순 100건과
  Service Request/Response, Action Goal/Feedback/Result 즉시 표시 model test를 추가했다.
- Frontend unit 전체, oxlint, Vite build와 `git diff --check`가 통과했다. 최종 build를 로컬 HTTPS 경로에 동기화해
  source/install index SHA-256이 일치했고 HTTPS는 `index-D-owj5Ln.js`, `index-BDTxWnW4.css`를 HTTP 200으로
  제공했다. CSS의 고정 높이·내부 scroll·pre-wrap과 Backend `monitor_connected=true`를 확인했다.
