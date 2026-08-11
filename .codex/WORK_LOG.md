# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

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

## 2026-08-10 - Nginx TLS 종료 기반 HTTPS/WSS 배포 구성

- 작업: 현재 `config/nginx/nginx.conf.template`에 위치한 환경변수 예시와 렌더링 스크립트를 추가하고 Nginx가 production
  Frontend를 HTTPS로 제공하며 `/health`, `/ros/`, `/ws/monitor`를 localhost FastAPI로 proxy하도록 구성했다.
- 책임 경계: 외부 Browser 구간만 HTTPS/WSS이며 TLS는 Nginx에서 종료한다. Nginx→FastAPI는 기존
  HTTP/WS(`127.0.0.1:8000`)를 유지했고 FastAPI WebSocket endpoint와 내부 TLS 코드는 변경하지 않았다.
- Frontend: API 기본값을 현재 page origin으로 변경하고 page protocol이 HTTPS면 `wss`, HTTP면 `ws`를
  선택한다. Vite는 `/health`, `/ros`, `/ws`를 Backend 8000으로 proxy해 기존 HTTP/WS 개발 실행을 유지한다.
- 인증서: certificate/private key는 환경변수의 절대 경로로만 렌더링한다. 실제 인증서 파일은 생성물이나
  저장소에 추가하지 않으며 `.gitignore`의 key/pem/crt 제외 정책을 유지한다.
- 검증: 임시로 압축 해제한 Nginx 1.24.0과 `/tmp` self-signed 인증서로 `nginx -t`가 성공했다. 격리 포트
  18443에서 HTTPS Frontend `#root`, HTTPS `/health`, `wss://127.0.0.1:18443/ws/monitor`의 기존
  `monitor_snapshot` data 수신을 확인했다. Production bundle에는 고정 `http://127.0.0.1:8000` 또는
  `ws://127.0.0.1:8000`이 없었다. Vite 5176 proxy에서도 HTTP health와 WS snapshot 수신이 통과했다.
  Frontend lint/build, Backend pytest 7 tests, shell syntax와 `git diff --check`도 통과했다.
- 남은 문제: 검증은 self-signed 인증서를 신뢰 검사를 해제한 client로 수행했다. 실제 배포에서는 조직/공인
  CA 인증서 경로를 환경변수로 지정하고 Browser trust 및 DNS hostname을 최종 확인해야 한다.

## 2026-08-10 - 로컬 시스템 Nginx 상시 설치 준비 (sudo 적용 대기)

- 작업: Nginx 템플릿을 Ubuntu `/etc/nginx/conf.d/*.conf`에 포함 가능한 site 설정으로 변경하고,
  `scripts/install_local_https.sh`를 추가했다. 로컬 환경 파일은 `localhost 192.168.1.123`, HTTPS 443,
  `/etc/nginx/ssl/ros2-dashboard.{crt,key}`, `/var/www/ros2-dashboard`, Backend 8000으로 작성해 Git에서 제외했다.
- 설치 동작: Frontend dist 배치, localhost/127.0.0.1/LAN IP SAN self-signed 인증서 생성, private key 0600,
  conf.d 설치, `nginx -t`, systemd reload/enable을 한 번에 수행한다. 기존 port 80 default site는 변경하지 않는다.
- 검증: 실제 설치된 Nginx 1.24.0은 enabled/active이고 현재 80 LISTEN, 443 미사용 상태다. 렌더링 및 shell
  syntax, Git ignore, diff check가 통과했으며 Ubuntu http/conf.d include 형태의 임시 `nginx -t`도 성공했다.
- 차단: 현재 자동화 세션의 `sudo -n`은 암호를 요구하므로 `/etc/nginx`, `/var/www`, systemd에 아직 적용하지
  못했다. 사용자 터미널에서 `sudo ./scripts/install_local_https.sh`를 한 번 실행한 뒤 실제 `nginx -T`, 443
  LISTEN, HTTPS/WSS Browser snapshot을 최종 확인해야 한다. 완료되지 않은 시스템 적용을 완료로 보고하지 않는다.

## 2026-08-10 - 로컬 시스템 Nginx HTTPS/WSS 상시 적용 완료

- 적용 상태: 사용자가 설치 스크립트를 sudo로 실행한 뒤 `/etc/nginx/conf.d/ros2-dashboard.conf`, self-signed
  certificate/key와 `/var/www/ros2-dashboard` 배치가 확인됐다. key 권한은 0600이며 인증서 파일은 Git에 없다.
- 영속 실행: Nginx systemd service는 enabled/active이고 `0.0.0.0:443`, `[::]:443`에서 LISTEN한다. 설정은
  localhost와 192.168.1.123을 server name으로 사용하며 `/ws/monitor`를 Backend 8000 WS로 Upgrade proxy한다.
- HTTPS 검증: `https://localhost/`와 `https://192.168.1.123/` 모두 Frontend root를 반환했고 HTTPS
  `/health`는 Backend running 및 Monitor connected를 반환했다.
- WSS 검증: localhost와 LAN IP에서 HTTP 101 Upgrade 및 연속 `monitor_snapshot` frame 수신을 확인했다.
  headless Chrome으로 실제 HTTPS Dashboard를 렌더링했을 때 `실시간 연결됨`이 표시됐고 Mixed Content 또는
  WebSocket connection 오류는 검출되지 않았다.
- 제한: 자동화 세션은 sudo 암호를 보유하지 않아 `sudo nginx -T` 원문 출력을 직접 캡처하지 못했다. 대신
  root 소유 활성 conf를 확인했고 설치 스크립트의 root `nginx -t` 통과, systemd active, 실제 443 handshake와
  Browser WSS 결과로 적용 상태를 검증했다.

## 2026-08-10 - 로컬 Nginx 설정을 config 경로로 이동

- 작업: 외부 배포 의미를 피하기 위해 프로젝트의 `deploy/nginx/`를 `config/nginx/`로 이동하고
  render/install 스크립트, 문서, Git ignore와 현재 상태 기록의 참조를 모두 변경했다.
- 로컬 데이터: 실제 PC용 `config/nginx/dashboard.env`도 새 위치로 옮겼고 계속 Git에서 제외된다.
  example의 공백 포함 `DASHBOARD_SERVER_NAME`은 shell source가 가능하도록 따옴표를 추가했다.
- 실행 영향: 이미 설치된 `/etc/nginx/conf.d/ros2-dashboard.conf`, 인증서, Frontend 정적 파일과 실행 중인
  systemd Nginx는 변경하지 않았다.
- 검증: 두 shell script의 `bash -n`, 새 환경 파일 source/render, Git ignore, Nginx include 설정 문법과
  `git diff --check`를 확인했다.

## 2026-08-10 - start.md 병합 중복 정리

- 기존 `#` 제목 문구와 순서를 유지하면서 병합으로 중복된 명령 블록을 제거하고 각 실행 명령을 해당 제목
  아래에 배치했다. 현재 package에 등록되지 않은 Demo executable 명령은 제거했다.

## 2026-08-10 - Interface Lab Action 실행 무한 대기 진단

- 현상: Action 실행 후 UI spinner가 끝나지 않고 Backend health의 `monitor_connected`가 false/timed out으로
  바뀌었다. 8765 listener와 Monitor process는 남아 있지만 Monitor `/health`가 3초 내 응답하지 않았다.
- 원인: `RuntimeClientPool.get_or_create()`가 RosMonitor 공용 `threading.Lock`을 획득한 상태에서 신규 Action
  client factory를 호출한다. `ActionClientPool.get_or_create()` 내부 factory가 `_qos_by_key` 저장을 위해 같은
  non-reentrant Lock을 다시 획득해 첫 ActionClient 생성 시 자기 교착된다.
- 영향: Action worker뿐 아니라 동일 Lock을 사용하는 snapshot/Graph 요청도 영구 대기해 Backend polling이
  timeout되고 서버 전체가 이상해 보인다. Router의 `run_in_threadpool`이나 Nginx/WSS가 직접 원인은 아니다.
- 상태: 사용자 요청이 확인/진단 범위여서 코드 수정이나 현재 Stack 재시작은 수행하지 않았다. 임시 복구에는
  Stack 재시작이 필요하고, 영구 수정에는 client factory를 lock 밖에서 호출하거나 중첩 lock 획득을 제거하는
  변경과 첫 생성·동시 생성 회귀 테스트가 필요하다.

## 2026-08-10 - Interface Lab Action 첫 실행 deadlock 수정

- 수정: `RuntimeClientPool`에 client 생성 전용 Lock을 추가했다. 공용 RosMonitor 상태 Lock은 cache 조회·저장
  구간에서만 사용하고 factory는 Lock 밖에서 실행해 ActionClient factory의 QoS 상태 저장 재진입을 허용한다.
- 동시성: 생성 전용 Lock으로 동일/복수 thread의 get-or-create를 직렬화해 factory가 key당 한 번만 실행되는
  기존 의미를 유지했다. clear도 생성 Lock과 상태 Lock 순서로 수행한다.
- 회귀 테스트: factory가 같은 공용 non-reentrant Lock에 재진입해도 완료되는 테스트와 6개 동시 요청에서
  factory가 한 번만 실행되고 같은 client를 받는 테스트를 추가했다. 신규 2 tests 및 Monitor 전체 174 tests가
  통과했고 source compileall과 `git diff --check`도 통과했다.
- 실제 복구/검증: deadlock된 기존 Monitor가 graceful 종료되지 않아 확인된 Dashboard process group만 TERM 후
  잔존 Monitor child를 KILL하고 Stack을 재빌드·재시작했다. HTTPS API로 `/CanControl` 첫 Goal을 실행해 약
  0.55초 안에 accepted, feedback, succeeded result를 받았고 직후 Monitor `/health`, Backend health,
  Action history가 모두 정상 응답했다.

## 2026-08-10 - ROS2 Graph 기반 QoS 표시와 Topic 자동 적용 연결

- 작업: 일반 Topic API에 Publisher/Subscriber endpoint별 Reliability, Durability, History, Depth, Deadline,
  Lifespan, Liveliness를 추가하고 화면의 `QosDetails`에서 각 endpoint와 Dashboard 적용 프로필을 분리해 표시했다.
- Topic 자동 적용: 기존 adaptive Subscription 생성 경로가 외부 Publisher Graph QoS를 우선 선택하도록 유지하면서
  Dashboard 자체 endpoint는 상대 후보에서 제외했다. Graph가 UNKNOWN/0으로 제공한 생성 필드만 기존 안전
  fallback으로 치환하고 `qos_fallback_policies`로 어떤 값이 fallback인지 공개한다.
- 불일치: 실제 Publisher/Subscriber endpoint 조합을 `qos_check_compatible`로 비교해 확정 가능한 mismatch를
  `incompatible`, 정책 목록과 사유로 표시한다. Subscription 생성 후 RMW incompatible QoS event 경로도 유지했다.
- Service/Action: Jazzy Graph가 제공하지 않는 Service와 Action Goal/Result/Cancel QoS에서 로컬 Service 기본값을
  제거하고 `graph_unavailable`/`그래프에서 확인할 수 없음`으로 표시한다. Action Feedback/Status는 각각 독립
  Topic의 Graph endpoint QoS만 표시해 Action 전체 단일 QoS처럼 표현하지 않는다.
- 통신 정책: QoS 확인을 위해 Service Client/Request, ActionClient/Goal을 새로 만들지 않았다. 기존 일반 Topic
  monitoring Subscription과 Interface Lab 사용자 명시 실행 경로는 유지했다.
- 자동 검증: Monitor pytest 178 tests, Backend pytest 7 tests, 두 Python source compileall, Frontend oxlint와
  Vite build, `git diff --check`가 통과했다. Monitor package colcon build/test 결과는 183 tests, 0 errors,
  0 failures, 0 skipped다.
- 실제 검증: 임시 `/imu` Publisher에서 Graph QoS를 읽어 Monitor Subscription이 `qos_auto_applied: true`로
  생성되고 메시지 수신과 `/transport/snapshot`의 local/publisher/subscriber QoS가 연결됨을 확인했다. 호출 없이
  `/add_two_ints` Service는 `graph_unavailable`, Goal 전송 없이 `/fibonacci` Action은 Goal/Result/Cancel 미확인과
  Feedback/Status Topic 실제 QoS가 분리됨을 확인했다. 검증용 임시 프로세스는 종료했다.
- 남은 제한: Jazzy DDS discovery가 History/Depth를 UNKNOWN/0으로 반환할 수 있어 화면에서도 원격 관찰값을
  그대로 표시한다. QoS mismatch를 영속 Alert 이력으로 연결하는 작업은 별도 범위다. 기존 사용자 변경과 이번
  변경은 모두 미커밋 상태이며 commit/push를 수행하지 않았다.

## 2026-08-10 - QoS 사유 표시 레이아웃과 문구 통일

- Topic/Service/Action QoS 상세의 `사유`를 공통 block 레이아웃으로 변경해 라벨 다음 줄에 문장이 가로 방향으로
  표시되도록 했다. 좁은 상세 패널에서도 한글이 글자 단위로 세로 배치되지 않게 `word-break: keep-all`을 적용했다.
- Service는 `Service endpoint QoS는 Graph에서 확인할 수 없습니다.`, Action Goal/Result/Cancel은
  `Action service endpoint QoS는 Graph에서 확인할 수 없습니다.`로 명확히 표시한다.
- Frontend lint/build, QoS 단위 테스트 11개, Monitor source compileall과 `git diff --check`가 통과했다.

## 2026-08-10 - Topic/Service/Action QoS 결정·표시 경로 조사

- 범위: 코드 수정 없이 Monitor의 ROS entity 생성 지점, Graph QoS helper, Backend snapshot 전달, Frontend
  `QosDetails` 표시 경로를 정적으로 조사했다. rclpy profile 객체 직렬화만 실행했으며 ROS 통신 객체는 만들지 않았다.
- Topic: 일반 Monitor Subscription과 Interface Lab Topic Publisher/Subscription은 모두 `choose_topic_qos()`로
  상대 Graph endpoint QoS 후보를 비교한 뒤 선택한 동일 profile을 `create_subscription/create_publisher`에 넘긴다.
  일반 fallback은 sensor type의 `qos_profile_sensor_data` 또는 `QoSProfile(depth=10)`, Interface Lab fallback은
  `QoSProfile(depth=10)`이다. 화면 `local_qos`는 실제 객체에서 사후 조회한 actual QoS가 아니라 생성 시 전달한
  선택 profile의 직렬화 값이다. 같은 type의 기존 entity는 재사용하므로 이후 Graph QoS 변화에 맞춰 재생성하지 않는다.
- Service: 일반 탭은 원격 QoS를 `graph_unavailable`, `local_qos: null`로 표시하며 QoS 확인용 Client를 만들지
  않는다. Interface Lab Client와 비활성 기본인 allowlist active-check Client는 모든 Service에
  `qos_profile_services_default`를 사용한다. 이는 Jazzy 환경에서 KEEP_LAST/depth 10/RELIABLE/VOLATILE이다.
- Action: 일반 탭의 Goal/Result/Cancel은 미확인으로, Feedback/Status는 Graph Topic endpoint 값으로 표시한다.
  일반 Action monitor의 실제 Feedback/Status Subscription은 Graph 적응형이며 fallback은 각각
  `QoSProfile(depth=10)`과 `qos_profile_action_status_default`다. 관찰 Goal Result 조회 Client는 Service default를
  쓴다. Interface Lab ActionClient는 Goal/Result/Cancel에 Service default, Feedback/Status에 각각 Graph 적응형
  profile을 별도로 전달하므로 Action 전체 공통 profile은 없다.
- Frontend/Backend: FastAPI Backend는 Monitor `/transport/snapshot`을 deepcopy해 `/ros/topics|services|actions`로
  전달할 뿐 QoS를 계산하지 않는다. Frontend는 API의 `local_qos`가 있을 때만 `Dashboard 적용 QoS`를 렌더링하며
  QoS 값을 자체 하드코딩하지 않는다.
- 결론: Topic/Action Topic 채널은 Graph 적응형이라 공통 depth 10을 강제하지 않지만, Graph 미확인 fallback,
  Service default, 생성 후 entity 재사용 때문에 Dashboard 설정이 통신을 제한할 가능성은 남아 있다. 특히
  fallback으로 만든 entity 뒤에 비호환 endpoint가 나타나도 현재 자동 재생성하지 않는다.

## 2026-08-10 - Fast DDS Discovery 기반 원격 Service/Action QoS passive 조회 조사

- 범위: 코드와 통신 상태를 변경하지 않고 현재 환경의 RMW 식별자, 설치 package/header, Jazzy rcl/rmw/rclpy API,
  ROS2 설계 문서와 Fast DDS Discovery API를 조사했다. Service Client/Call, ActionClient/Goal은 생성·전송하지
  않았고, 조사 과정에서 ROS/DDS Participant나 user-data endpoint도 만들지 않았다.
- 현재 환경: `RMW_IMPLEMENTATION`은 명시되지 않았지만 rclpy가 선택한 구현은 `rmw_fastrtps_cpp`다. 설치 버전은
  `ros-jazzy-rmw-fastrtps-cpp 8.4.4`, `ros-jazzy-rmw-fastrtps-shared-cpp 8.4.4`, Fast DDS 2.14.6이며 Fast DDS
  Python binding은 설치되어 있지 않다. 프로젝트도 특정 RMW나 vendor XML profile을 강제하지 않는다.
- 표준 Graph 경계: Jazzy rcl/rmw/rclpy는 Topic의 Publisher/Subscription endpoint info와 QoS는 제공하지만,
  원격 Service request/response endpoint info를 service 이름으로 조회하는 공개 API는 제공하지 않는다. Service
  actual-QoS 함수는 자신이 생성한 `rmw_client_t`/`rmw_service_t` handle의 내부 endpoint만 대상으로 한다.
- Fast DDS 가능 범위: 별도 `DomainParticipant`와 `DomainParticipantListener`를 만든 vendor 전용 observer는 EDP의
  원격 DataWriter/DataReader 발견 callback과 proxy data를 받을 수 있다. ROS Service의 `rq`/`rr` DDS request/
  response endpoint를 이름·type 규칙으로 식별하면 user-data Reader/Writer를 만들거나 호출하지 않고 광고된 QoS를
  읽을 수 있다. 단, observer 자체는 discovery traffic을 받는 DDS Participant로 도메인에 참가하므로 물리적으로
  완전한 무참여 packet 관찰은 아니다.
- QoS 구분: Fast DDS discovery proxy에서 원격 Reliability, Durability, Deadline, Lifespan(Writer), Liveliness와
  lease duration은 실제 광고값으로 변환 가능하다. 설치된 `rmw_fastrtps_shared_cpp/qos.hpp`가 명시하듯 discovery의
  `WriterQos`/`ReaderQos`에는 History와 Depth가 없으므로 두 값은 원격 실제값으로 확정할 수 없다. 로컬 기본값이나
  표준 profile로 채우더라도 이는 추정일 뿐이다.
- Action: Feedback/Status는 일반 Topic이므로 현재 rclpy Graph API로 endpoint QoS를 passive 조회할 수 있다.
  Goal/Result/Cancel은 각각 Service여서 Fast DDS raw `rq`/`rr` endpoint observer 방식과 같은 제한을 받으며,
  Action 전체에 단일 QoS는 없다.
- 적용 판단: 현재 Python/rclpy Monitor만으로 Service/Action service endpoint 조회를 추가할 수 없다. 구현한다면
  Fast DDS C++ API를 사용하는 별도 localhost helper가 가장 현실적이며, raw DDS 이름/type과 ROS service/action
  채널을 연결하고 RMW/vendor·버전 차이, 동일 domain/discovery/security 조건, endpoint 수명과 중복을 처리해야 한다.
  Python `fastdds` binding을 새로 설치하는 대안도 있으나 현재 미설치이고 ROS mapping 처리는 동일하게 필요하다.
- 남은 위험: 원격 기기가 Fast DDS가 아니거나 DDS가 아닌 RMW를 쓰면 vendor helper의 mapping/관찰이 성립하지 않을
  수 있다. DDS Security, Discovery Server, domain/range/네트워크 설정에 의해 발견되지 않은 endpoint는 QoS도 알 수
  없다. 따라서 미발견과 기본 QoS를 같은 의미로 표시하면 안 되며 History/Depth는 계속 `확인할 수 없음`이어야 한다.

## 2026-08-10 - Fast DDS passive Service/Action QoS observer 구현

- 구조: 새 ament_cmake package `ros2_dashboard_dds_observer`에 Fast DDS 2.14 C++ helper를 추가했다. helper는 현재
  `ROS_DOMAIN_ID`에 DomainParticipant와 DomainParticipantListener만 만들고 publisher/subscriber discovery
  callback으로 `rq/...Request`, `rr/...Reply` endpoint를 수집한다. localhost `127.0.0.1:8766/snapshot` 외에는
  노출하지 않으며 Browser/Backend는 helper에 직접 접근하지 않는다.
- 안전 기준: helper는 사용자 데이터 DataWriter/DataReader, Service Client, ActionClient를 만들지 않는다.
  구현과 검증 중 Service Call, Action Goal도 전송하지 않았다. request DataReader와 response DataWriter를
  server 역할로 분류해 Dashboard 또는 다른 client endpoint를 Remote server QoS에 섞지 않는다.
- QoS 모델: Reliability, Durability, Deadline, Liveliness와 lease duration 및 DataWriter Lifespan은 Fast DDS
  discovery proxy의 실제 광고값을 공개한다. DataReader Lifespan과 History/Depth는 확인할 수 없으므로 각각
  `unknown`/`unknown`/`null`이며 기본 Service profile을 채우지 않는다. finite duration은 ns, 무한 duration은
  `*_status: infinite`로 구분한다.
- Monitor 통합: `FastDdsQosObserver`가 helper 생명주기와 0.5초 localhost polling cache를 관리한다. 일반 Service는
  passive DDS QoS를 사용하고, Action은 Goal/Result/Cancel service만 DDS 결과를 연결하며 Feedback/Status는 기존
  rclpy Graph 조회를 유지한다. 실제 Interface Lab Client 또는 Action Feedback/Status Monitor subscription이
  존재할 때만 생성 시 적용한 local QoS를 별도로 합친다.
- 장애 처리: helper 실행 파일 누락, localhost 응답 실패, disabled 설정, `rmw_fastrtps_cpp`가 아닌 환경은
  Service/Action service QoS만 `graph_unavailable`로 만든다. Topic Graph QoS와 Monitor/Backend/Frontend 흐름은
  helper에 의존하지 않는다. 설정은 `monitor.yaml`의 `fastdds_observer` 한 곳에 둔다.
- Frontend: Service의 Remote DDS QoS와 존재할 때만 Dashboard local QoS를 분리한다. Action은 Goal/Result/Cancel/
  Feedback/Status를 유지하고 DDS Request/Response DataReader/DataWriter label, DDS topic/type, infinite duration,
  확인 불가능한 History/Depth를 명확히 표시한다.
- 실제 passive E2E: test Service server만 실행해 `/introspection_add_two_ints` request Reader와 response Writer
  2개를 발견했다. 고유 ActionServer `/passive_qos_test`만 실행해 send_goal/get_result/cancel_goal 각각 request
  Reader와 response Writer 총 6개를 발견했다. 모두 RELIABLE/VOLATILE/AUTOMATIC이었고 Deadline/lease는
  infinite, Writer Lifespan은 infinite, Reader Lifespan은 unknown이었다. History/Depth는 unknown/null이었다.
  Monitor snapshot에서도 Service 2개, Action 채널별 2개가
  `fastdds_discovery`, local QoS null로 전달됐다. Call/Goal/Client는 만들거나 보내지 않았다.
- 자동 검증: helper와 Monitor build 성공, Monitor pytest 183 tests, Backend 7 tests, Frontend lint/build,
  Python compileall이 통과했다. 선택 package colcon test-result는 C++ lint와 Monitor test를 포함해 0 failure다.
  초기 C++ lint에서 copyright/include order와 XML schema network 문제가 발견됐으며 source header/include 순서와
  package XML을 수정해 해소했다.
- 문서: `docs/qos/fastdds_passive_observer.md`와 AGENTS 구조/책임 경계를 갱신했다. Fast DDS vendor 이름 규칙과
  callback에 종속되므로 Cyclone DDS/비-DDS RMW에는 별도 adapter가 필요하고, DDS Security/Discovery 설정으로
  endpoint가 보이지 않으면 QoS도 확인할 수 없다.

## 2026-08-10 - Codex 작업 로그 최근/Archive 구조 정리

- 작업: 127개 항목, 2,171줄이던 `WORK_LOG.md`를 작업 순서 기준으로 분리했다. 기존 마지막 25개 항목을 최근
  로그로 유지하고 앞선 102개 항목은 `.codex/archive/WORK_LOG_2026-08-06_to_2026-08-10_001.md`로 이동했다.
  이번 항목 추가 후 최근 WORK_LOG는 26개 항목이다.
- 기록 보존: 분리 직후 archive 본문과 최근 로그 본문을 다시 결합한 SHA-256이 분리 전 작업 본문의 hash
  `1b7cacca709bac35f1a45a7bb38b1bb366468019c03387831047d8d03c12cd8d`와 일치함을 확인했다. 기존 기록은
  삭제하거나 완료 상태를 바꾸지 않았다.
- CURRENT_STATUS: 423줄의 누적 module 이력을 제거하고 현재 프로젝트 상태, 핵심 구조, 최근 완료 작업,
  현재 검증 기준, 문제/제한, 다음 우선 작업만 남기는 현재형 문서로 축약했다.
- AGENTS 정책: 작업 전에는 CURRENT_STATUS와 최근 WORK_LOG만 기본 확인하고 archive는 과거 근거가 필요할 때만
  검색한다. 모든 작업은 최근 WORK_LOG에 기록하며, 항목이 다시 30개를 크게 넘거나 읽기 어려워지면 최근
  20~30개를 제외한 기록을 내용 변경 없이 archive로 이동하도록 명시했다.
- 범위와 검증: 코드 기능은 수정하지 않았다. archive 102개와 최근 26개(이번 기록 포함)의 항목 수, Markdown
  heading 순서, 파일 경로, 본문 hash와 `git diff --check`를 확인했다.

## 2026-08-10 - Fast DDS observer include 빨간줄 조사

- 조사: `fastdds_qos_observer.cpp` 20~23행과 36~39행의 Fast DDS 헤더 8개가 모두
  `/opt/ros/jazzy/include/fastrtps` 아래에 실제 설치되어 있음을 확인했다.
- 원인: CMake 실제 컴파일에는 `-isystem /opt/ros/jazzy/include/fastrtps`가 전달되지만 package build에
  `compile_commands.json`이 생성되어 있지 않아, 편집기 C/C++ 분석기가 include 경로를 알지 못해 표시하는
  IDE 진단으로 판단했다.
- 검증: `colcon build --symlink-install --packages-select ros2_dashboard_dds_observer`가 성공했고
  `fastdds_qos_observer` target이 100% 빌드됐다. 소스와 CMake는 수정하지 않았다.

## 2026-08-10 - QoS 사유 레이아웃 복구

- 작업: Topic/Service/Action이 공유하는 `QosDetails`의 사유 영역에서 `사유` 라벨을 가로 한 줄로 고정하고,
  실제 설명은 다음 줄에서 전체 폭으로 표시되도록 공통 CSS를 복구했다.
- 범위: 기능/API/QoS 데이터는 변경하지 않고 `frontend/src/App.css`의 `.qos-reason` 레이아웃만 수정했다.
- 검증: Frontend `npm run lint`, `npm run build`, `git diff --check`가 통과했다.

## 2026-08-10 - 기존 demo_nodes passive DDS QoS unavailable 수정

- 재현: 기존 `ros2_dashboard_demo_nodes`의 `demo_communication.launch.py`를 Domain 99,
  `rmw_fastrtps_cpp`에서 실행했다. Graph 이름은 Service `/RobotControl`, `/ScheduleCrud`, Action
  `/CanControl`이었다. Service Call, Service Client, ActionClient, Goal은 만들거나 보내지 않았다.
- 단계 추적: 독립 C++ observer는 `/RobotControl`의 `rq/RobotControlRequest` Reader와
  `rr/RobotControlReply` Writer, `/CanControl` Goal/Result/Cancel의 rq Reader와 rr Writer 6개를 모두
  올바른 절대 ROS 이름으로 변환했다. 새 Monitor에서도 해당 이름의 merge와 Backend 전달은 정상이어서
  DDS mangling, C++ 변환, Monitor merge, Frontend 데이터 구조 문제는 아니었다.
- 실제 원인: 화면이 연결된 기존 8765 Monitor snapshot의 `observer_reason`은
  `observer_executable_not_found`였다. helper 파일은 실제 install에 있었지만 Monitor 프로세스의
  `AMENT_PREFIX_PATH`에는 observer가 처음 build되기 전 prefix 목록만 남아 있어
  `ament_index_python.get_package_prefix()`가 helper package를 찾지 못했다.
- 수정: `dds_observer.observer_executable()`이 정상 ament index 조회를 우선 사용하고, observer만 index에서
  누락된 경우 Monitor install prefix를 기준으로 isolated/merged install의 sibling helper 경로를 확인하도록
  보강했다. 실제 파일이 없으면 기존처럼 unavailable이며 다른 RMW/Topic QoS 정책은 변경하지 않았다.
- 회귀 테스트: observer가 index에 없고 sibling install에는 존재하는 stale 환경을 재현하는 단위 테스트를
  추가했다. Monitor 전체 pytest 184 passed, Backend 7 passed, Frontend lint/build, Python compileall,
  선택 package build 및 colcon test-result 201 tests/0 failures/1 skipped가 통과했다.
- 실제 demo E2E: 의도적으로 observer prefix를 제거한 환경에서도 `/RobotControl`은 `observed /`
  `fastdds_discovery`와 request Reader/response Writer QoS를 반환했고, `/CanControl` Goal/Result/Cancel도 모두
  `observed / fastdds_discovery`였다. Reliability reliable, Durability volatile이 전달됐고 Discovery에 없는
  History/Depth만 unknown/null로 유지됐다. 실제 8765 Monitor를 수정 build로 재시작한 뒤 기존 Backend 8000의
  `/ros/services`, `/ros/actions`에서도 동일 결과를 확인했다.
- 실행 상태: 검증용 demo/observer/8875 Monitor/8012 Backend는 종료했다. 실제 Dashboard용 8765 Monitor는
  수정 build로 재시작해 실행 중이며 기존 Backend/Frontend는 유지했다.

## 2026-08-10 - TurtleBot3 Gazebo·Teleop·Nav2 통합 launch 추가

- 작업: `ros2_dashboard_demo_nodes`에 `turtlebot3_sim_nav.launch.py`를 추가해 TurtleBot3 Gazebo World를 먼저
  시작하고, 2초 뒤 keyboard teleop을 `gnome-terminal`에서 열며, 5초 뒤 Nav2를 simulation clock으로
  시작하도록 구성했다. 기본 model은 `burger`다.
- 실행 선택: `model`, `use_sim_time`, `teleop`, `teleop_delay`, `nav2_delay` launch argument를 제공한다.
  keyboard teleop은 stdin TTY가 필수이므로 launch subprocess에 직접 붙이지 않고 현재 로컬 Ubuntu에 설치된
  `gnome-terminal --wait`로 분리했다.
- 의존성: demo package에 `turtlebot3_gazebo`, `turtlebot3_navigation2`, `turtlebot3_teleop` runtime dependency를
  명시했다. Dashboard 기능 코드와 특정 Topic 제어 로직은 변경하지 않았다.
- 검증: 세 TurtleBot3 package와 `gnome-terminal` 설치를 확인했다. Python compile, demo package build,
  launch description 생성, `ros2 launch ... --show-args`, demo package pytest/colcon test 1개가 통과했다.
  현재 Domain 99에 기존 Gazebo/Nav2가 실행 중이어서 중복 GUI/process 충돌을 피하려고 전체 stack의 두 번째
  실제 실행은 하지 않았다.

## 2026-08-10 - QoS 사유 전용 2행 배치 및 HTTPS stale bundle 확인

- 원인: Topic/Service/Action 공통 source에는 사유 배치 CSS가 있었지만 실제 `https://localhost`는 이전
  `/var/www/ros2-dashboard` bundle(`index-BdsMndbe.css`)을 제공해 최신 변경이 화면에 반영되지 않았다.
- 수정: `QosDetails`의 사유를 일반 `detail-line`에서 분리해 `qos-reason-label`과
  `qos-reason-description` 전용 구조로 변경했다. 라벨 `사유`는 horizontal/nowrap 한 줄, 설명은 grid의
  다음 행 전체 폭에서 줄바꿈되며 Topic/Service/Action 모두 같은 컴포넌트를 사용한다.
- 검증: Frontend lint/build와 `git diff --check`가 통과했고 새 dist CSS에서 세 전용 selector와 배치 속성을
  확인했다.
- 배포 상태: `sudo ./scripts/install_local_https.sh`로 Nginx static root 갱신을 시도했으나 현재 실행 환경은
  sudo password 입력용 terminal을 제공하지 않아 중단됐다. source와 `frontend/dist`는 최신이며 사용자가 해당
  sudo 명령을 한 번 실행해야 HTTPS의 이전 bundle이 교체된다.

## 2026-08-10 - Action QoS 접기·그룹화·색상 정리

- 작업: Action 내부 5개 통신을 기본 화면에 연속 출력하지 않고 Service 통신(Goal/Result/Cancel)과 Topic 통신
  (Feedback/Status) 두 그룹으로 묶었다. 각 그룹은 전체 상태 요약만 기본 표시하며 그룹을 펼친 뒤 개별 채널도
  별도로 펼쳐 세부 endpoint QoS를 확인할 수 있다.
- 상태 요약: 그룹 안의 실제 channel 상태를 집계해 정상, 일부 확인, 불일치, 확인 불가 badge로 표시한다.
  내부 5개 QoS 데이터 구조와 passive 관찰 정책은 유지하며 Action 전체에 가짜 단일 QoS를 만들지 않았다.
- 표현: 그룹명, 채널명, endpoint profile 제목의 font family/size/weight를 통일했다. 정상은 green, 일부/fallback은
  yellow, 불일치는 red, 확인 불가는 gray, DDS/source와 확인된 profile 값은 blue로 구분했다. Topic/Service의
  기존 QoS 상세에도 같은 값 색상과 사유 2행 배치를 적용한다.
- 검증: Frontend oxlint/build와 `git diff --check`가 통과했고 새 dist CSS에 group/item/status selector가 포함됨을
  확인했다. HTTPS Nginx static root는 이전 작업과 동일하게 sudo password 없이는 갱신할 수 없어 source/dist만
  최신 상태이며 `sudo ./scripts/install_local_https.sh` 실행이 필요하다.

## 2026-08-10 - Action QoS HTTPS 미반영 확인

- 확인: 최신 `frontend/dist`는 `index-BX73Qiow.js`/`index-C3cv9xHr.css`지만 HTTPS Nginx와
  `/var/www/ros2-dashboard`는 직전 `index-DqB9U5B3.js`/`index-DCnq3rTl.css`를 제공 중이었다.
- 결론: 브라우저 새로고침 문제가 아니라 Action QoS 접기 UI build 이후 root 권한 static 배포가 다시 실행되지
  않은 상태다. 코드 추가 수정 없이 `sudo ./scripts/install_local_https.sh` 실행이 필요하다.

## 2026-08-10 - 로컬 HTTPS Frontend 갱신 구조 원인 정리

- 원인: 현재 Nginx `/`는 Vite 5173을 proxy하지 않고 `/var/www/ros2-dashboard`에 복사된 정적 build를 제공한다.
  따라서 Vite HMR은 HTTPS 화면에 사용되지 않으며 변경마다 build 후 root 권한 복사가 필요하다.
- 구분: `colcon --symlink-install`은 ROS2 package용이므로 Frontend dist/Nginx static root에는 영향을 주지 않는다.
- 권장 후속: 상시 로컬 개발 환경은 Nginx의 API/WSS proxy는 유지하고 `/`와 HMR WebSocket을 Vite 5173으로
  proxy해야 source 변경이 즉시 HTTPS에 반영된다. 이번 답변에서는 설정을 변경하지 않았다.

## 2026-08-10 - 로컬/LAN HTTPS와 직접 개발 접속 병행 구조 정리

- 변경: 로컬 Nginx `/`를 `/var/www` 정적 bundle 대신 localhost Vite 5173으로 전달하도록 template, env example,
  render/install script, 실행 문서와 HTTPS/WSS 문서를 수정했다. `/health`, `/ros`, `/ws/monitor`는 기존처럼
  FastAPI 8000으로 전달하며 Browser protocol에 따라 직접 HTTP에서는 WS, Nginx HTTPS에서는 WSS를 사용한다.
- 운영 범위: Dashboard/ROS2/기기가 같은 로컬 PC 또는 LAN에 있는 사용 방식을 기본으로 본다. localhost 직접
  HTTP/WS 개발 접속과 LAN HTTPS/WSS 접속은 함께 유지하고, 별도 인터넷 공개용 정적 배포 구조는 기본 범위에서
  유지하지 않는다. 외부 인터넷 공개에는 별도 인증서, 접근 제어, 방화벽/라우터 정책이 필요하다.
- 검증: shell 문법, Nginx render 결과와 별도 임시 설정의 `nginx -t`가 통과했다. 실제 프로세스는 Monitor
  8765, Backend 8000, Vite 5173과 Nginx 443에서 LISTEN 중이며 HTTP upstream, 기존 HTTPS health와
  `wss://localhost/ws/monitor`의 `monitor_snapshot` 수신도 확인했다.
- 설치 상태: 시스템 `/etc/nginx/conf.d/ros2-dashboard.conf`는 아직 `/var/www`를 사용하는 이전 설정이다.
  새 설정 설치는 sudo password 입력이 필요한데 현재 실행 환경에서 입력할 수 없어 중단됐다. 사용자가
  `sudo ./scripts/install_local_https.sh`를 한 번 실행한 후 Vite proxy HTTPS/HMR을 최종 확인해야 한다.

## 2026-08-11 - 전일 작업 상태 확인

- `.codex/CURRENT_STATUS.md`와 최근 WORK_LOG, 현재 `git status`를 대조해 2026-08-10 완료 범위와 다음 작업을 확인했다. 코드 변경이나 검증 실행은 없었다.

## 2026-08-11 - QoS 무제한 시간 문구 명확화

- QoS의 `infinite` 값을 단순 `무한` 대신 의미별로 `기한 제한 없음`, `만료되지 않음`, `임대 만료 없음`으로 표시하도록 변경했다. 원본 상태와 API 계약은 변경하지 않았다.

## 2026-08-11 - QoS 사유 강조색 통일

- Topic/Service/Action 공통 QoS 상세의 사유 본문을 호환 상태와 관계없이 경고용 노란색으로 표시하도록 변경했다.

## 2026-08-11 - Topic/Service QoS endpoint 접기 추가

- Topic QoS는 Publisher/Subscriber, Service QoS는 Request/Response endpoint 그룹을 기본 접힘으로 표시하도록 변경했다. Dashboard 적용 profile도 별도 접기 항목으로 분리했으며 상단 호환 상태와 사유는 계속 바로 표시한다.

## 2026-08-11 - Fast DDS Discovery 사유 색상 구분

- QoS 판정 근거가 `fastdds_discovery`이면 사유를 초록색, 발견하지 못했거나 다른 근거이면 노란색으로 표시하도록 변경했다.

## 2026-08-11 - QoS 상세 의미 기반 색상 정책 통일

- Topic/Service/Action 공통 `QosDetails`에서 실제 조회값은 파랑, 정상 무제한은 청록, unknown은 회색, 부분 정보와 비교 불충분은 노랑, 실제 `incompatible` 판정만 빨강으로 표시하도록 정리했다. DDS Topic/Type 메타데이터는 일반 본문색으로 낮췄으며 데이터 구조와 판정 로직은 변경하지 않았다.

## 2026-08-11 - Topic RMW 무제한 duration 색상 적용

- Topic Graph QoS가 무제한 시간을 `*_status: infinite` 대신 RMW int64-max nanoseconds로 전달하는 경우도 공통 UI에서 정상 무제한으로 인식해 문구와 청록색을 동일하게 적용했다.

## 2026-08-11 - 통신 3탭 DDS 관찰 색상 통일

- Topic/Service/Action 공통 QoS 상세에서 판정 근거와 사유를 `fastdds_discovery` 관찰 시 초록, 그 외 미관찰 상태는 노랑으로 표시하도록 공통 helper를 적용했다.

## 2026-08-11 - DDS Discovery 상태 배지 색상 수정

- Action 내부 Goal/Result/Cancel처럼 `fastdds_discovery`로 관찰된 채널 상태 배지를 local QoS 유무보다 우선해 초록으로 표시하고, observer 미관찰/unknown 채널은 노랑으로 표시하도록 상태 및 그룹 집계를 수정했다.

## 2026-08-11 - 통신 3탭 QoS 최종 상태 색상 통일

- 발견 경로가 DDS인지 Graph인지와 무관하게 Topic/Service/Action QoS 최종 상태가 `compatible`이거나 Fast DDS에서 정상 관찰된 채널이면 초록, 부분/미확인/Graph 한쪽 관찰은 노랑, 실제 `incompatible`만 빨강으로 통일했다. 판정 근거와 사유도 같은 최종 상태 색을 사용한다.

## 2026-08-11 - 통신 QoS 발견·분류·적용 코드 현황 확인

- Topic/Service/Action의 QoS 발견 원천, 상태 분류와 실제 entity 적용 경로를 비교했다. 코드 변경과 검증 실행은 없었다.

## 2026-08-11 - Interface Lab 지연 원인 진단과 DDS QoS 조회 최적화

- 실제 HTTPS/Vite/Backend 응답과 Interface Lab 초기 15개 API를 측정했다. HTML은 12ms였지만 ROS Graph 137 Topics/385 Services/18 Actions 환경에서 Monitor CPU가 약 89%였고 callable API는 최대 1.42초였다.
- 원인은 매 1초마다 각 Service/Action QoS 조회가 Fast DDS observer 전체 endpoint snapshot을 반복 deep copy·검색하는 구조로 판단했다. Observer poll 시 Service별 server endpoint 인덱스를 만들고 조회 시 해당 endpoint만 복사하도록 변경했으며 공개 QoS payload와 passive 정책은 유지했다.
- 추가 원인으로 Receive 패널의 1초 polling이 전체 로더를 재사용해 callable 목록과 전체 Topic Graph까지 포함한 10개 API를 매초 호출하는 요청 루프를 확인했다. 최초/명시 갱신은 전체 로드를 유지하고 background polling은 실제 Receive 상태와 Topic/Service/Action history 4개만 갱신하도록 분리했다.
- `/transport/snapshot`이 개별 resource snapshot을 만든 뒤 Alert와 WebSocket 요약에서 같은 Action/Node/Topic/Service snapshot을 다시 조립하는 중복도 제거했다. 한 요청 안에서 만든 snapshot을 optional 인자로 재사용하며 기존 단독 REST/WebSocket 메서드 계약은 유지했다.
- 검증: 실제 DDS snapshot 964 endpoints/371 service names에서 기존 전체복사 조회 1.6893초 대비 인덱스 조회 0.0082초로 약 206.7배 개선됐다. Monitor pytest 185 passed, compileall, Frontend lint/build가 통과했다.
- 실행 반영: Monitor package를 재빌드·재시작했고 Backend는 자동 재연결됐다. `/transport/snapshot`은 0.66초에서 0.22초, callable Service는 1.18초에서 0.038초, callable Action은 1.42초에서 0.032초, hidden Service는 1.13초에서 0.046초로 단축됐다.
- 남은 문제: Interface Lab 반복 callable 요청은 사라졌지만 137 Topics/385 Services/18 Actions의 현재 Gazebo/Nav2 Graph에서 Monitor main spin CPU는 여전히 약 80~88%다. 상세 감시 Topic은 9개뿐이며 perf attach는 시스템 `perf_event_paranoid=4`로 차단됐다. 다음 성능 작업은 1초 전체 Graph update의 Node/Topic/Service/Action 단계별 계측과 cache/delta 갱신 검토다.
