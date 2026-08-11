# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

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

## 2026-08-11 - Interface Lab 실행 QoS Auto/Manual 구현

- 작업: Monitoring QoS/Discovery 판정은 유지하고 Interface Lab Topic Publish/Subscribe, Service Call, Action Goal
  실행 요청에 Auto/Manual QoS를 추가했다. 공통 Manual 항목은 Reliability, Durability, History, Depth이며 Action은
  Goal/Result/Cancel Service 그룹과 Feedback/Status Topic 그룹을 분리했다.
- Auto 정책: Topic은 기존 Graph `choose_topic_qos()`를 재사용한다. Service와 Action 내부 Service는 Fast DDS의
  request Reader와 response Writer 양쪽을 Client 관점에서 만족하는 Reliability/Durability를 계산하고,
  Discovery에서 알 수 없는 History/Depth는 local Service default를 사용한다. 원격 미관찰/부분 관찰/단일 profile
  불가능 상태는 ROS2 Service default로 fallback하며 이유를 결과에 표시한다.
- 표시와 객체 수명: 실행 결과에 QoS Mode, Remote QoS, Dashboard 실행 QoS와 fallback을 분리했다. Topic entity는
  같은 name/type에서 profile fingerprint가 바뀌면 destroy 후 재생성하고, ServiceClient와 ActionClient는 QoS
  fingerprint를 pool key에 포함해 다른 QoS를 이전 객체로 재사용하지 않는다.
- 실제 검증: demo `/RobotControl` Auto와 Manual RELIABLE depth 7→8 호출, `/CanControl` Auto와 Manual Goal,
  `/demo_cleaning_schedule` Auto/Manual Subscribe, 별도 테스트 Topic Auto/Manual Publish가 성공했다. Action의
  Goal/Result/Cancel에는 Service profile, Feedback/Status에는 Topic profile이 실제 생성 인자로 전달됨을 테스트했다.
- 자동 검증: Monitor 전체 pytest 192 passed, Python compileall, 전체 ROS2 build, Frontend oxlint/build,
  `git diff --check`가 통과했다. 실행 중 HTTPS/Vite가 새 QoS 컴포넌트를 제공하는 것도 확인했다.
- 로그 정리: 기록 전 47개였던 최근 WORK_LOG의 오래된 22개를
  `.codex/archive/WORK_LOG_2026-08-10_002.md`로 이동했다. 이동 전후 본문 SHA-256
  `f6fd0433b00716d4e3098a0bc697d4b39b820be50b531f743d4c6e7185492a1c`가 일치했다.

## 2026-08-11 - Interface Lab 수신 탭 QoS 선택 연결

- Topic/Service/Action 수신 탭에도 실행 탭과 같은 Auto/Manual QoS control을 노출했다. Topic은 실제 Receive
  Subscription QoS에 적용하고, Service/Action은 별도 수신 entity를 만들지 않으므로 실행 탭과 상태를 공유해
  다음 Service Call 또는 Action Goal의 Client QoS에 적용한다.
- Action 수신은 실행과 동일하게 Service(Goal/Result/Cancel)와 Topic(Feedback/Status) 두 profile을 분리한다.
- Frontend oxlint/build와 `git diff --check`가 통과했고 HTTPS Vite에서 변경된 컴포넌트 제공을 확인했다.

## 2026-08-11 - Topic Publish/Subscribe QoS 상태 분리

- 정정: Topic 실행(Publish)과 수신(Subscribe)이 같은 QoS state를 공유하던 연결을 제거했다. 등록 실행/수신
  workspace와 인라인 Topic 상세 모두 Publisher 전용 QoS와 Subscription 전용 QoS를 독립적으로 소유한다.
- 동작: 수신 탭에서 바꾼 Auto/Manual 및 profile은 `수신 시작` 요청에만 들어가며 Publish에는 영향을 주지 않는다.
  같은 Topic Subscription의 profile fingerprint가 달라지면 기존 Subscription을 destroy하고 새 QoS로 재생성한다.
- Service 응답은 단일 ServiceClient profile, Action 응답/Feedback은 ActionClient 생성 시 전달하는 5개 채널
  profile을 사용하므로 독립 수신 entity가 없는 Service/Action history 탭에서는 별도 QoS selector를 제거했다.
- 검증: Frontend oxlint/build와 `git diff --check`가 통과했다.

## 2026-08-11 - Service/Action 실행·수신 QoS 상태 분리 복구

- Service 수신 탭의 Response QoS와 Action 수신 탭의 Feedback/Status QoS 선택 UI를 복구했다. Service 실행
  Request와 수신 Response, Action 실행 Service 채널과 수신 Topic 채널은 각각 별도 Auto/Manual state를 가진다.
- ActionClient에는 Service 그룹을 Goal/Result/Cancel, Topic 그룹을 Feedback/Status profile로 독립 전달한다.
  rclpy ServiceClient는 Request/Response에 하나의 QoSProfile만 지원하므로 두 독립 설정의 최종 profile이 다르면
  이전 객체를 생성하거나 요청을 보내기 전에 같은 값으로 맞추라는 오류를 반환한다. Auto/Auto는 원격 양쪽을
  함께 만족하는 기존 Service 호환 계산을 사용한다.
- 인라인 Interface 상세 화면에도 같은 실행/수신 분리를 적용하고 결과 QoS 요약에 Request/Response 채널을 추가했다.
  검증은 QoS 단위 테스트 10 passed, Monitor 전체 pytest 195 passed, Frontend oxlint/build, `git diff --check`가
  통과했다. Monitor를 재시작해 Backend 재연결과 HTTPS 200을 확인했고, 서로 다른 Request/Response Manual
  profile 요청은 ROS 명령 전송 전에 의도한 제약 오류로 거부되는 것도 실제 API에서 확인했다.

## 2026-08-11 - Action QoS 5개 내부 채널 독립 적용

- Action QoS를 Service/Topic 그룹 2개로 묶던 Manual 모델을 제거하고 Goal Service, Result Service,
  Cancel Service, Feedback Topic, Status Topic의 5개 채널별 Auto/Manual 및 profile로 분리했다.
- 실행 탭과 수신 탭은 별도 10개 설정을 만들지 않고 같은 실제 ActionClient의 5개 채널 설정을 모두 표시한다.
  어느 화면에서 변경해도 다음 ActionClient 생성 시 해당 채널 인자로 전달되며, 5개 profile 전체 fingerprint가
  달라지면 기존 객체를 재사용하지 않는다. 기존 service/topic 그룹 요청 형식은 API 호환을 위해 계속 지원한다.
- 검증: 서로 다른 5개 Manual profile이 ActionClient의 5개 생성 인자에 각각 전달되는 단위 테스트를 포함해
  QoS 테스트 10 passed, Monitor 전체 pytest 195 passed, Frontend oxlint/build가 통과했다. Monitor를 재시작한
  뒤 Backend `monitor_connected: true`와 HTTPS Interface Lab 200 응답도 확인했다.

## 2026-08-11 - Action QoS 선택 UI 단순화

- Action 실행/수신 UI의 반복 QoS Mode 5개를 전역 Auto/Manual 선택 하나로 통합했다. Auto에서는 세부 입력을
  숨기고, Manual에서는 Service QoS(Goal/Result/Cancel)와 Topic QoS(Feedback/Status) 두 그룹 아래 채널별
  accordion을 기본 접힘으로 표시한다. 실제 ActionClient 5개 profile payload와 결과 표시는 유지했다.
- 검증: Frontend oxlint/build, QoS 단위 테스트 10 passed, `git diff --check`가 통과했다. 데모 `/CanControl`에
  5채널 Auto 요청을 보내 Goal accepted, feedback, result success를 확인했다.
- 후속 수정: Action 실행과 수신 화면이 같은 QoS state를 공유하던 연결을 제거하고 각각 별도 hook instance를
  사용하도록 분리했다. 한쪽 Mode/Profile 변경이 다른 화면에 반영되지 않으며 Frontend oxlint/build를 재검증했다.
- 후속 UI: Topic/Service/Action의 QoS Mode 옆에 `실행/수신 연동` 체크를 추가했다. 기본 해제 상태에서는 기존처럼
  독립 선택하고, 체크 시 현재 탭의 Mode와 Manual profile 전체를 반대쪽에 즉시 맞춘다. 이후 Reliability,
  Durability, History, Depth와 Action 5개 대응 채널 변경도 양방향 동기화한다. Backend 적용 구조는 변경하지
  않았으며 Frontend oxlint/build와 `git diff --check`를 통과했다.

## 2026-08-11 - Interface Lab Manual 고급 QoS 확장

- 기존 Auto와 Manual 기본 4개 설정을 유지하고 공통 Manual UI 아래 기본 접힘 `고급 설정`을 추가했다. Deadline,
  Lifespan, Lease Duration은 숫자와 ns/us/ms/s 단위를 받고, Liveliness는 Jazzy가 지원하는 SYSTEM_DEFAULT,
  AUTOMATIC, MANUAL_BY_TOPIC만 제공한다. 빈 duration은 기존 RMW 기본 0ns를 유지한다.
- 입력 duration을 정확한 nanoseconds `rclpy.duration.Duration`으로 변환해 Topic/Service/Action의 실제
  QoSProfile 8개 정책에 전달한다. 기존 fingerprint의 duration/liveliness 필드를 사용하므로 고급값 변경 시
  Topic entity와 Service/Action client가 이전 객체를 잘못 재사용하지 않는다.
- 검증: QoS 단위 테스트 11 passed, Monitor 전체 pytest 196 passed, Frontend oxlint/build와 `git diff --check`가
  통과했다. Monitor를 재시작해 새 backend 코드를 반영했다.

## 2026-08-11 - Interface Lab Auto QoS 경로 재확인

- 코드 기준으로 Topic은 Graph 상대 endpoint 전체 profile 후보 중 local 역할과 가장 많이 호환되는 값을 선택하고,
  Service와 Action 내부 Service는 Fast DDS Request Reader/Response Writer에서 Reliability/Durability 호환값만
  계산하며 History/Depth와 고급 정책은 Service 기본값을 쓰는 것을 확인했다. 코드 변경과 테스트 실행은 없었다.
- 후속 판단: 발견 가능한 정책까지 기본값으로 두기보다 Request Writer/Response Reader 역할별 호환 제약으로
  Deadline/Liveliness/Lease Duration을 계산하는 방향이 타당하다. Lifespan은 writer-side 정책이라 상대 reader에서
  local writer 값을 직접 추론할 수 없고, History/Depth와 함께 확인 불가 정책만 명시적 local 기본값이 필요하다.

## 2026-08-11 - Interface Lab Service/Action Auto QoS 발견값 확장

- 작업: Interface Lab Service Auto가 Fast DDS에서 발견한 Reliability/Durability뿐 아니라 Deadline,
  Liveliness, Lease Duration과 Response Writer Lifespan도 실제 `rclpy.QoSProfile`에 반영하도록 확장했다.
  Action Goal/Result/Cancel은 같은 resolver를 사용하므로 각 내부 Service profile에도 동일하게 적용된다.
- 판단 기준: Dashboard Request Writer는 원격 Request Reader 요구를, Dashboard Response Reader는 원격
  Response Writer 제공값을 만족해야 하고 rclpy Client는 하나의 profile만 받는다. 두 방향의 호환 구간에서
  발견값에 가장 가까운 값을 선택하며, 한 방향만 발견돼도 확인된 값을 버리지 않는다. History/Depth만 Fast DDS
  Discovery에서 알 수 없어 local Service 기본값을 유지한다. `infinite` duration은 명시적 rclpy Infinite로 변환한다.
- fallback: endpoint 전체 미발견 또는 두 방향을 단일 profile로 만족할 수 없을 때만 Service 기본 profile 전체를
  사용하고 사유를 표시한다. Lifespan은 Writer 정책이므로 관찰 가능한 Response Writer 값을 전달하되 Request
  Reader가 요구한 값으로 해석하지 않는다.
- 문서: `AGENTS.md`, `docs/qos/dds_qos.md`, Interface Lab 흐름·환경·용어 문서와 CURRENT_STATUS를 현재
  Auto/Manual, 실행/수신 연동, 8개 Manual 정책, Action 5개 profile, 색상/fallback/객체 재사용 정책에 맞췄다.
- 검증: Interface QoS 단위 테스트 15개와 Monitor 전체 pytest 200개, Python compileall, Frontend oxlint/build,
  `git diff --check`가 통과했다. Monitor를 재시작해 Backend의 snapshot polling과 priority 재동기화가 다시
  200 응답을 받는 것을 확인했다. 실제 장비 명령은 실행하지 않았다.
