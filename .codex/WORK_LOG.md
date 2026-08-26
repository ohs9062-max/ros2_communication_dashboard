# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

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

## 2026-08-25 - 최근 데이터 로그 payload 중첩 스크롤 제거

- Interface Lab Receive의 payload처럼 공통 History JSON `<pre>`에 `max-height:none`, `overflow-x/y:visible`,
  `pre-wrap`, word break를 명시했다. 각 payload는 내용 높이만큼 펼쳐지고 내부 세로·가로 scrollbar를 만들지 않는다.
  100% 폭과 padding이 상세 폭을 넘지 않도록 `box-sizing:border-box`도 적용했다.
- 실제 스크롤 대상인 `.communication-history-stream`만 `overflow-y:auto`를 유지하고 높이를 기존 52vh/520px에서
  64vh/640px, 최소 높이를 180px에서 260px로 넓혔다. Topic/Service/Action이 같은 공통 컴포넌트를 사용하므로
  세 화면에 일괄 적용되며 Backend/Monitor/API는 수정하지 않았다.
- Headless Chrome의 실제 `/cmd_vel` 100건 상세에서 로그 영역은 clientHeight 278px, scrollHeight 29,218px,
  `overflow-y:auto`였고, 앞 3개 JSON은 각각 clientHeight=scrollHeight 236px, clientWidth=scrollWidth 470px,
  `overflow-x/y:visible`, `max-height:none`이었다. payload 내부 scrollbar와 가로 overflow가 없음을 계산 스타일로 확인했다.
- Frontend unit 전체, oxlint, Vite build 341 modules/111ms와 `git diff --check`가 통과했다. 최종 build를 로컬 HTTPS에
  동기화했고 source/install index SHA-256 일치, HTTPS `index-EPe7zMci.js`와 `index-DjgbK4V3.css` HTTP 200,
  Backend `monitor_connected=true`를 확인했다. Frontend-only 변경이라 service 재시작은 하지 않았다.

## 2026-08-25 - Action 실제 관찰 데이터 상세 History 병합

- Service 외부 Request/Response는 Fast DDS observer가 `DomainParticipantListener`의 discovery endpoint/GUID/type/QoS만
  수집하고 DataReader·deserialization을 하지 않아 현재 구조로 관찰할 수 없음을 확인했다. Service 상세은 실제 값이
  있는 Interface Lab Call 최대 30건만 유지하며 외부 payload를 합성하지 않는다.
- Action 자동 Subscription의 실제 Status 전이와 Feedback callback, terminal Status 뒤 기존 GetResult future로 얻은
  Result를 resource별 bounded deque에 기록한다. Interface Lab Goal 이력과 최신순으로 합쳐 기본 100건을
  `/ros/actions/history`에서 반환하고 `monitor_observed` source, event type, goal ID를 명시한다. 외부 Goal payload와
  rejected 응답은 Service payload라 관찰할 수 없어 `goal=null`로 정확히 구분한다.
- 외부 demo client로 `/CanControlFailure`를 실행해 Interface Lab 이력 0건인 상태에서도 executing/aborted Status,
  Feedback 3건과 실제 실패 Result가 HTTPS API에 총 6건 기록됨을 확인했다. 정기 `/transport/snapshot`에는 history key가
  없었다. source/install index SHA-256은 동일했고 HTTPS 새 asset, health `monitor_connected=true`를 확인했다.
- Monitor targeted 33 passed, ROS overlay를 적용한 package pytest 274 passed, colcon 292 tests·0 failures·1 skipped,
  Python compileall, Frontend unit 전체, oxlint, Vite build 341 modules/133ms와 `git diff --check`를 통과했다. 첫 package
  pytest의 9 failures는 overlay 미적용으로 `rths_interfaces`를 import하지 못한 실행 환경 문제였고 source 후 전부 통과했다.
- 후속으로 Topic/Service/Action 공통 `CommunicationHistory`가 펼쳐진 동안 기본 1초마다 각 History API를 자동
  갱신하도록 했다. 접힌 동안에는 요청하지 않고, request in-flight guard로 응답이 느릴 때 polling 요청이 겹치지
  않으며 수동 새로고침은 유지한다. 정기 WebSocket snapshot에 history를 넣지 않는 경계도 그대로다.
- Frontend unit 전체, oxlint, Vite build 341 modules/123ms와 diff check를 통과했다. 최신 build를 로컬 HTTPS 실행
  경로에 동기화해 source/install index SHA-256 `b5ae862e29fb4a00ba1c4ea656388483f1b4c94cb8373ad451f121e4b2327327`가
  일치했고 실제 HTTPS는 `index-D2YI1jPV.js`를 HTTP 200으로 제공하며 health `monitor_connected=true`였다.
- `Domains` sidebar/page와 `/ros/domains` GET/PUT를 추가했다. 입력은 쉼표 기준 공백 허용, 정수 0~232 검증,
  중복 제거·정렬 후 Backend `user_preferences.yaml`에 영속한다. Monitor snapshot은 실제 rclpy Context의 단일
  `active_domain_id`와 상태만 제공하며, 저장 Domain 중 그 값만 `감시 중`, 나머지는 `저장됨 · runtime 미적용`으로
  표시한다. 다중 Domain runtime을 구현하거나 UI 적용으로 ROS runtime을 바꾸지는 않았다.
- 실제 HTTPS API에서 `99,0,1,2,3,99`가 `[0,1,2,3,99]`로 저장·재조회되고 테스트 뒤 기존 빈 설정으로 복원됨을
  확인했다. 현재 실제 Domain 99는 `monitoring`, 233은 HTTP 400으로 거부됐다. Backend pytest 7 passed, Frontend
  unit/lint/build(343 modules/123ms), Monitor transport pytest 1 passed, colcon build와 diff check를 통과했고
  Monitor·Backend 재시작 및 로컬 HTTPS 정적 파일 동기화를 완료했다.

## 2026-08-25 - Multi-domain runtime 기반 추가 (진행 중)

- Monitor의 기존 단일 global rclpy Context 대신, Domain별 `Context.init(domain_id=...)`와 `RosMonitor` runtime을
  보유하는 `MultiDomainRosMonitor` 기반을 추가했다. Jazzy에서 Domain 0과 99 Context를 동시에 초기화해 각각의
  `get_domain_id()`가 반환됨을 확인했다. 각 runtime은 별도 Fast DDS observer loopback port를 사용하며 첫 Domain은
  기존 observer 기본 port를 유지한다.
- Backend Domain 설정 저장 뒤 `/transport/priority`로 `domain_ids`를 즉시 동기화해 추가 Domain은 start, 제거 Domain은
  stop하도록 연결했다. aggregate Topic/Service/Action/Node/Alert 항목에 `domain_id`와 `resource_key`를 붙여
  snapshot 단계의 이름 충돌을 구분한다. 기존 Interface Lab 실행 route는 의도치 않은 multi-domain broadcast를 피하기
  위해 기존 기본 Domain으로 유지한다.
- Frontend Domains 화면은 저장됨/runtime 미적용 문구를 제거하고 Monitor가 반환한 Domain별 실제 status를 표시하도록
  갱신했다. 동일 이름 Topic/Service/Action의 상세 선택과 Interface Lab의 명시 Domain 선택까지 완성하기 전에는
  다중 Domain 기능을 완료로 간주하지 않는다. Frontend lint/build, Backend user preferences test, Monitor transport
  test와 diff check는 통과했고, 샌드박스 네트워크 제한 때문에 실제 DDS discovery 동시 관찰은 미검증이다.
- 후속으로 Domains 입력을 단일 ID `추가`/행별 `삭제` 방식으로 변경했다. 목록과 상세 선택은 aggregate
  `resource_key`를 우선 사용하고 History/latest API에는 선택 resource의 `domain_id`를 전달한다. callable
  Service/Action에도 Domain ID를 붙이고 실행 payload가 이를 자동 전달하도록 연결했다. Topic Interface Lab의
  graph target과 Node/Overview Alert click의 resource key 전환은 아직 남아 있으므로 실제 multi-domain UI 전체
  완료 전에는 운영 Monitor 재시작을 하지 않았다.
- HTTPS UI 반영 중 Codex 비대화형 PTY의 `sudo` password prompt가 사용자 입력 UI에 전달되지 않는 것을 재확인했다.
  암호 대기 명령은 취소했고 HTTPS 정적 파일은 변경되지 않았다. 이후에는 유효 credential을 `sudo -n`으로 확인할 수
  있을 때만 동기화하고, 그렇지 않으면 먼저 사용자가 별도 터미널에서 `sudo -v`를 수행하도록 알리는 정책을
  `AGENTS.md` HTTPS 절에 기록했다.
- MultiDomainRosMonitor이 명시 `domain_id` 없는 기존 Interface Lab graph 조회를 정렬된 첫 Domain(예: 0)으로
  보내 기존 `ROS_DOMAIN_ID`(예: 99)의 Topic candidate가 비어 자동 Topic명 입력이 사라진 회귀를 확인했다.
  Topic 입력 controller는 변경하지 않았으며, legacy route의 fallback을 기존 default Domain 우선으로 고쳐
  자동 입력 동작을 복원했다. Monitor workspace build와 service restart가 필요한 변경이다.
- Multi-domain 초기 설정 source를 `backend/config/user_preferences.yaml`의 `domains.ids` 하나로 변경했다. Monitor는
  시작 시 이 YAML을 읽고 저장된 IDs만 runtime으로 생성하며, `.env`/shell `ROS_DOMAIN_ID` 또는 첫 Domain fallback으로
  runtime을 만들지 않는다. Domain 추가/삭제는 기존 Backend YAML atomic write 뒤 transport 동기화로 start/stop된다.

## 2026-08-25 - Multi-domain resource identity 및 Interface Lab routing 완료

- `MultiDomainRosMonitor`의 name-only Interface Lab 위임을 제거하고 Topic Publish/Receive/지속 발행, Service Call,
  Action Goal/Cancel, 실행·수신 History와 reset을 선택 `domain_id` runtime으로 명시 라우팅했다. 빈 Domain 목록도
  즉시 모든 runtime을 종료하며 observer port는 `base + domain_id`로 안정적으로 분리한다.
- Topic 자동입력과 Graph 후보는 `resource_key`에서 name/domain을 함께 보존한다. Service/Action 통합 실행 화면에서
  같은 type의 여러 Graph 리소스가 있으면 Domain이 표시된 실제 리소스를 선택하고, 그 선택이 Call/Goal/Cancel까지
  유지된다. 상세·Overview·Alert 클릭·참여 Node·QoS focus·사용자 별표도 resource identity로 분리했다.
- `ROS_DOMAIN_ID=99` 환경에서도 YAML `[0,2]`만 복원, 추가/삭제/빈 목록 lifecycle, 동일 `/same` history 분리와
  Domain 2 실행 라우팅을 회귀 테스트로 추가했다. Monitor 277 passed, Backend 17 passed·2 skipped, Frontend
  unit 전체·oxlint·Vite build와 `git diff --check`가 통과했다. 실제 service 재시작과 로컬 HTTPS 정적 파일
  동기화는 이번 작업에서 수행하지 않았다.

## 2026-08-25 - Multi-domain 실제 통신 executor 수정

- resource 발견부터 Frontend/Backend payload, Monitor transport와 `MultiDomainRosMonitor._runtime(domain_id)`까지는
  선택 Domain이 유지됐지만, child `RosMonitor._spin()`이 `rclpy.spin(node)`을 호출해 전역 기본 executor를
  사용했다. Domain별 Node를 올바른 Context로 생성하고도 callback/future가 그 Context에서 처리되지 않은 것이
  `감시 중` 표시와 실제 통신 불가가 동시에 나타난 직접 원인이었다.
- 명시 Context가 있는 child runtime만 `SingleThreadedExecutor(context=context)`를 생성해 Node를 add/spin/remove/
  shutdown하도록 `monitor_lifecycle.py`를 최소 수정했다. 기본 Context의 기존 단일 runtime 경로는 유지했고
  ROS_DOMAIN_ID, 99 또는 첫 Domain fallback은 추가하지 않았다.
- 실제 Domain 7 subscriber/server를 별도 Context로 띄워 Dashboard Domain 7 runtime의 Topic Publish 수신,
  AddTwoInts Service Call 응답과 Fibonacci Action Goal/Result가 모두 성공했고 Domain 0에는 전용 Topic이 섞이지
  않음을 확인했다. Monitor 전체 278 passed, Monitor package build와 `git diff --check`가 통과했다. 로컬 Monitor
  재시작은 `sudo -n` credential이 없어 실행되지 않았으므로 현재 service에는 아직 새 executor가 적용되지 않았다.

## 2026-08-25 - Interface Lab 실행 선택/수신 상태 회귀 수정

- Graph 상세에서 `실행`을 열 때 기존에는 execution request에 kind만 전달돼 Topic/Service/Action callable loader가
  목록의 기본 항목을 선택했다. 이제 단일로 식별되는 Graph resource의 `resource_key`, `domain_id`, 이름과 full type을
  loader까지 넘겨 해당 항목을 선택하고, Topic은 실행 이름 입력과 Domain도 함께 채운다. 실행 payload는 기존처럼
  선택 state의 `domain_id`를 Monitor에 전달한다. 여러 후보가 있으면 임의 Domain fallback 없이 기존 selector를 유지한다.
- Service/Action loader도 전달받은 target과 정확히 일치하는 callable 항목을 선택한다. `ROS_DOMAIN_ID`, 99 또는
  첫 Domain fallback은 추가하지 않았다. Backend/Monitor routing과 QoS/통신 로직은 변경하지 않았다.
- 수신 탭의 `selectReceiveMode()`가 동일 이름의 실행 panel까지 다시 load/전환하던 결합을 제거했다. 따라서
  Service 수신 mode 선택/시작은 Action Goal 실행 panel의 selected/busy/button state를 바꾸지 않으며, 각 수신 observer의
  기존 독립 active key는 유지된다.
- Frontend `npm run lint`, `npm run test:unit`, `npm run build`, `git diff --check`를 통과했다. HTTPS 정적 실행 경로
  동기화는 수행하지 않았으므로 현재 Nginx 화면 반영에는 별도 사용자 권한으로 local HTTPS static sync가 필요하다.

## 2026-08-25 - Interface Lab 실행 payload Domain ID 보장

- multi-domain 상태에서 `domain_id: undefined`는 JSON 직렬화 시 key 자체가 빠져 Monitor의
  `domain_id is required when multiple Domains are monitored` 오류를 만들 수 있었다. 선택 resource의
  `resource_key` 우선(없으면 선택 state의 `domain_id`)으로 0~232 정수 Domain을 명시 추출하는 작은 helper를 기존
  Interface Lab model에 추가했다. 이는 fallback이 아니라 선택 resource identity 검증이다.
- Topic Publish/지속 Publish/중지/Receive 시작·중지, Service Call, Action Goal/Cancel의 payload가 이 확정 숫자를
  `domain_id`로 보낸다. Graph resource identity가 없으면 요청을 전송하지 않고 선택 Domain ID 필요 오류를 화면에
  표시한다. ROS_DOMAIN_ID, 99, 첫 Domain 및 UI Domain 선택은 추가하지 않았다.
- helper의 resource-key 우선·범위/누락 거부 unit test와 Frontend `npm run lint`, `npm run test:unit`,
  `npm run build`, `git diff --check`를 통과했다. HTTPS 정적 실행 경로 동기화는 수행하지 않았다.

## 2026-08-25 - Interface Lab 실행/수신 controller state 완전 분리

- 실행 panel을 연 직후 `loadReceiveState({ silent: true })`가 실행되면서 수신용 callable Message/Service/Action
  조회 결과를 실행 controller의 목록에 `replace`하고, 수신 selector도 실행 selector를 직접 호출하고 있었다.
  이 때문에 수신 load/선택이 Topic `import_available`과 Action `selected.callable`을 바꿔 실행 버튼을 잠그고
  Topic click handler 및 POST 전에 차단될 수 있었다.
- 수신 controller가 Message/Service/Action 목록과 각 selected key를 자체 보유하도록 분리했다. 수신 load/선택은
  더 이상 Topic Publish, Service Call, Action Goal controller의 목록·선택·busy를 변경하지 않는다. 기존 실행
  controller는 선택 resource의 `resource_key`/`domain_id`를 유지하고 POST payload에 확정 `domain_id`를 보내는
  경로를 그대로 사용한다. ROS_DOMAIN_ID/99/첫 Domain fallback과 Domain 선택 UI는 추가하지 않았다.
- Frontend `npm run test:unit`, `npm run lint`, `npm run build`, `git diff --check`를 통과했다. 샌드박스에서 실행 중인
  로컬 HTTPS/Backend에 접속할 수 없어 Browser Network의 실제 POST와 ROS 통신은 코드 검증과 구분해 미검증으로
  남겼고, HTTPS 정적 실행 경로 동기화도 수행하지 않았다.

## 2026-08-25 - Multi-domain Topic Hz 및 Interface Lab 실행 기본 대상 회귀 수정

- Domain별 child Topic callback은 각 runtime의 name-key subscription에 timestamp/latest를 함께 저장하고 있었지만,
  Frontend 목록 Hz polling만 모든 Topic을 name-only로 조회하고 결과도 `topic.name` key에 저장했다. 목록 polling을
  `{resource_key, domain_id, name}` 대상으로 바꾸고 `/ros/topics/hz`에 Domain을 전달하며, Monitor 응답에도
  `domain_id/resource_key`를 붙여 선택 전환 중 다른 Domain의 동일 이름 응답까지 거부하도록 수정했다.
- Multi-domain callable API에는 등록 type마다 Domain별 `서버 없음` placeholder와 실제 callable 항목이 함께 존재할 수
  있다. 실행 controller가 배열 첫 항목을 기본 선택해 `selected.callable=false`, `server_available=false`가 되던 것을
  실제 `callable=true` 항목 우선 선택으로 변경했다. 버튼의 기존 `busy || !selected.callable` 조건은 유지하며 수신
  controller와 실행 controller의 분리도 그대로 유지했다.
- Frontend unit/lint/build와 `git diff --check`, Monitor 관련 21 tests, Monitor 전체 279 tests 및 Monitor package
  symlink build가 통과했다. 로컬 HTTPS 정적 경로 동기화와 Monitor 재시작은 `sudo -n` credential이 없어 실행 전에
  중단됐으며 실제 로컬 HTTPS/service 상태는 변경되지 않았다.

## 2026-08-25 - Multi-domain 실행 목록 중복 및 snapshot 반복 조립 제거

- Interface Lab callable Service/Action API가 모든 child Domain의 등록 Interface placeholder까지 합쳐 실제 resource
  하나를 Domain 수만큼 표시하던 원인을 확인했다. 실제 Graph runtime cache에 Server가 있는 Domain만 상세 callable을
  조립하고, 이름/type이 같은 실제 resource는 UI 항목 하나와 내부 `resource_candidates`로 묶는다. 한 Domain에만
  존재하면 그 `domain_id/resource_key`를 그대로 쓰며, 여러 Domain에 동시에 존재하면 임의 첫 Domain을 고르지 않는다.
  Graph에서 연 실행은 선택 resource와 정확히 일치하는 candidate를 복원해 기존 자동 Domain routing을 유지한다.
- `/transport/snapshot`이 이미 만든 Topic/Service/Action 결과를 multi-domain Node/Alert 조립에서 무시해 child마다
  같은 세 snapshot을 반복 생성하던 경로를 수정했다. 전달된 aggregate를 Domain별로 나눠 재사용해 정기 poll의
  Topic/Service/Action 조립 횟수를 Domain당 12회에서 3회로 줄였다. callable 목록도 전체 Domain의 무거운 상세 조립
  대신 raw Graph cache를 먼저 확인해, 실제 Server가 한 Domain뿐인 5-Domain 구성에서는 상세 조립이 5회에서 1회다.
- Interface Lab 수신 loader는 매번 Topic/Service/Action 8개 API를 모두 요청하던 것을 선택 mode만 조회하도록 바꿨다.
  Service/Action 수신 refresh는 8→2 requests, Topic은 8→4이며, 실행 panel open은 Service/Action 10→4,
  Topic 10→6 requests다. 새 cache/thread/fallback은 추가하지 않았다. Monitor 283 passed, Frontend unit 전체,
  oxlint, Vite build, Monitor symlink build와 `git diff --check`가 통과했다. HTTPS 정적 동기화와 service 재시작은
  이번 작업에서 수행하지 않았다.

## 2026-08-25 - Interface Lab 최종 Service/Action options 중복 차단

- 실행탭의 최종 경로를 `callable API → Service/Action controller state → visibleServices/visibleActions → option`까지
  확인했다. view/panel 단계에서 Domain 목록을 다시 합치는 코드는 없었고, controller가 API 배열을 그대로 `map()`해
  실행 중 Monitor가 Domain별 원본을 반환하면 중복이 최종 option까지 통과하는 것이 남은 원인이었다.
- Service/Action controller가 state에 넣기 직전에 이름/type별 option을 한 번 더 정규화한다. 이름 없는 Domain
  placeholder는 제거하고, 같은 실제 resource는 한 항목과 `resource_candidates`로 보존한다. Graph 상세에서 실행을
  열면 기존 target identity로 정확한 candidate를 복원하며 여러 Domain의 동일 resource를 임의 첫 Domain으로 보내지
  않는다. 다른 Interface Lab/Monitor 기능은 변경하지 않았다.
- Frontend unit 전체, oxlint, Vite build와 `git diff --check`가 통과했다. `pkexec` GUI 관리자 인증으로 새 build를
  로컬 HTTPS 정적 경로에 동기화했고 source/install `index.html` SHA-256은
  `b788964886b45e881454d6132ab8618252580d45283f48107d89248ecb8c39db`로 일치한다. 검사 sandbox에서는 localhost/LAN
  HTTPS socket에 접근할 수 없어 Browser 응답 확인은 수행하지 못했다.
- sudo가 필요하면 터미널 암호 prompt를 대기시키지 않고 즉시 권한 상승을 요청하며, GUI session에서 가능하면
  `pkexec` 시스템 관리자 비밀번호 창을 우선 띄우도록 `AGENTS.md` 작업 규칙을 갱신했다.

## 2026-08-25 - Interface Lab 실제 Graph Domain별 실행 후보로 교정

- 이전의 name/type 단순 병합을 제거했다. Multi-domain Monitor는 설정된 runtime마다 placeholder를 만들지 않고
  `server_count>0`인 실제 Service/Action Graph resource만 `(domain_id, name, type)` identity로 반환한다. 같은
  name/type이 D1과 D2에 실제 존재하면 두 API 항목과 두 option을 유지한다.
- Frontend 최종 Service/Action options도 기존 grouped/raw 응답을 실제 `resource_key/domain_id/server` 기준으로
  펼치고 exact identity 중복만 제거한다. 여러 option일 때 첫 Domain을 자동 선택하지 않으며 선택한 option의
  identity가 Call/Goal payload까지 유지되고 같은 name/type의 실제 후보들은 controller state에 보존된다. Topic Graph 후보는 `graph_present=false`, Domain/resource key 누락과
  exact identity 중복을 제외하고 `/name · D<id>` 형식으로 표시한다.
- Monitor 283 passed, Frontend unit 전체·oxlint·Vite build, Monitor symlink build와 diff check가 통과했다. GUI
  `pkexec` 인증으로 로컬 HTTPS 정적 파일을 동기화하고 Monitor만 재시작했다. 실제 API는 `/RobotControl`과
  `/ScheduleCrud`, `/CanControl`, `/cmd_vel`을 모두 존재하는 D99 한 건씩만 반환했으며 placeholder는 0건이었다.
  로컬 HTTPS는 새 `index-k4qoljFc.js`를 제공하고 source/install index SHA-256
  `fa68df8fce012f8d3eed239287a2eb52615e3a4594495bbe723ebe615b532004`도 일치한다.

## 2026-08-25 - Interface Lab 실행/수신 선택 연동 복구

- 실행과 수신 controller의 runtime state는 분리된 채로 두고, `useInterfaceExecutionSuite`에서 선택 callback만
  양방향 연결했다. Service/Action은 기존 `domain_id|resource_key|type` key를, Topic은 선택 Message type과
  Graph Topic의 `domain_id/resource_key`를 각각 유지해 같은 실제 resource만 반대 탭에 선택한다.
- 실행 쪽 선택은 수신 controller의 raw selection setter만 갱신하고, 수신 쪽 선택은 ref callback으로 실행
  controller의 selection만 갱신한다. 따라서 수신의 `activeKey`/start/stop과 실행의 `busy`/Goal·Call state는
  다시 공유되지 않는다.
- Frontend `npm run test:unit`, `npm run lint`, `npm run build`, `git diff --check`를 통과했다. GUI `pkexec`
  인증으로 HTTPS 정적 경로에 새 build를 동기화했고 `InterfaceLabPage-CmHlNQ4t.js` source/install SHA-256은
  `f17a28a209286102d93794cf513376bda1006964e98b8a59a794633dcaa5f101`로 일치한다. Monitor 코드 변경은 없어
  service restart는 하지 않았다.

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
