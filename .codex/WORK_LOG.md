# WORK LOG

이 파일은 AI 작업 인수인계를 위한 누적 기록이다. 최신 프로젝트 요약은
`.codex/CURRENT_STATUS.md`를 확인한다. 앞으로 모든 작업은 날짜와 함께 아래에 추가한다.

## 2026-08-06 - ROS2 Monitor와 웹 Backend 구조 분리

- 작업: 기존 Backend 내부에 섞여 있던 rclpy Monitor와 Interface Lab 실행을
  `ros2_ws/src/ros2_dashboard_monitor` 독립 ament_python package로 이동하고, Backend를
  `backend/app` 순수 FastAPI 구조로 재구성했다.
- 이유와 기준: ROS2 직접 접근과 웹 서비스 책임을 프로세스 수준에서 분리하고, Backend가
  rclpy Node와 Runtime Cache를 직접 공유하지 않도록 하기 위해서다.
- 주요 변경: `ros2_topic/ros2_service/ros2_action/ros2_node` 이름 적용, localhost HTTP transport,
  Backend monitor client/cache, ROS2 config와 uploaded interface workspace 이전,
  `ros2_dashboard_interfaces`와 demo nodes package 분리, 실행 script와 import 경로 정리.
- 검증: compile, `colcon list`, `colcon build --symlink-install`, ROS package 실행, Backend/Frontend
  기동과 기존 자동 테스트를 단계별로 확인했다.
- 남은 내용: 구조 분리 이후 대형 파일의 기능 분리와 운영 설정 정리가 계속 필요했다.

## 2026-08-06 - Frontend, Monitor, Interface Lab 기능 분리 리팩토링

- 작업: 비대한 Frontend Interface Lab과 페이지, Monitor snapshot 조립, Interface registry 및
  Service/Action/Topic 실행 runtime의 책임을 기능별 module/component로 나눴다.
- 판단 기준: 줄 수 자체보다 독립 변경되는 책임, 실행 흐름, 상태 소유권을 기준으로 분리하고
  공개 API와 응답 key는 유지했다.
- 주요 변경: route lazy loading, 기능별 API module, Interface Lab management/execution/receive
  panel과 model/workspace 분리, snapshot assembler/helper 분리, parser/import checker,
  client pool/history/executor 경계 정리.
- 검증: 각 구간마다 Backend tests, ROS2 tests, Frontend lint/build를 수행했다. lazy loading 후
  초기 bundle은 약 210 KB로 줄어 기존 500 KB 경고가 사라졌다.
- 다음 작업: Interface Lab controller/model/view 잔여 집중도와 큰 ROS runtime을 계속 점검한다.

## 2026-08-06~2026-08-07 - Topic, Service, Action QoS 확장

- 작업: Topic에 한정됐던 QoS 정보를 Service와 Action까지 확장하고 Interface Lab 통신 생성 시
  확인 가능한 상대 endpoint QoS를 적용하도록 구현했다.
- 이유와 기준: 미수신/timeout을 QoS 오류로 오판하지 않으면서 실제 Graph profile 비교 또는
  DDS/RMW incompatible event가 있을 때만 명확한 불일치를 보고하기 위해서다.
- 주요 변경: 공통 QoS state/schema와 profile 직렬화, Topic publisher/subscription endpoint 비교와
  다중 endpoint partial 판정, Topic Publish/Receive 자동 profile 선택, Service default profile의
  명시적 저장, Action Goal/Result/Cancel service와 Feedback/Status topic별 profile 관리,
  공통 상세 UI와 테스트 추가. Topic scalar `status`를 Action Status Topic QoS로 오인하던 UI
  mapping도 수정했다.
- 검증: ROS2 Monitor 119 tests, Backend 6 tests, 5 package colcon build, Frontend lint/build/SSR
  import가 성공했다. 실제 BEST_EFFORT LaserScan 수신, AddTwoInts call, Action goal/feedback/result와
  cancel을 확인했다.
- 남은 문제: 변경은 현재 staged/unstaged/untracked 상태로 섞여 있으며 커밋되지 않았다.
  Service 상대 QoS는 Jazzy Graph API 제한으로 확인 불가 시 unknown/default로 남는다. QoS Alert
  영속화는 별도 작업이다.
- 다음 AI: 작업 트리를 reset하지 말고 `git status`, staged diff, unstaged diff를 모두 확인한 뒤
  이어서 수정하거나 사용자 요청 시 범위별 commit을 준비한다.

## 2026-08-07 - 실행 문서와 QoS 표시 점검

- 작업: 구조 변경 이후 실행 명령을 `start.md` 형식으로 정리하고 demo server 개별 실행 명령을
  추가했다. Topic QoS 화면이 항상 unknown/unavailable로 보인 원인을 실제 payload/UI mapping에서
  조사하고 수정했다.
- 검증: Monitor snapshot과 실제 ROS2 endpoint에서 QoS 값 및 자동 적용 상태가 내려오는 것을
  확인했다.
- 주의: `start.md`와 관련 문서 변경은 아직 untracked/미커밋 상태다.

## 2026-08-07 - AI 작업 인수인계 기록 체계 추가

- 작업: `AGENTS.md`에 작업 전 상태/로그 확인과 작업 후 자동 기록 규칙을 추가하고,
  `.codex/CURRENT_STATUS.md`와 `.codex/WORK_LOG.md`를 생성했다.
- 이유와 기준: 대규모 구조 변경과 미커밋 작업이 이어지는 상황에서 다음 AI가 완료/계획,
  커밋 기준선/작업 트리, 검증 여부를 혼동하지 않고 이어받게 하기 위해서다.
- 주요 변경: 현재 구조·책임 경계·QoS 작업 상태·마지막 검증·미구현 요구사항·다음 작업 지점을
  실제 코드와 Git 상태 기준으로 기록했다. AGENTS의 기존 ROS2 test 기준도 마지막 확인값인
  119 tests로 갱신했다.
- 검증: 지정된 세 파일만 수정 대상으로 사용했고 Markdown diff와 whitespace 오류를 확인했다.
- 남은 문제: 이후 모든 AI 작업이 종료될 때 이 로그를 누적하고 프로젝트 상태가 바뀌면
  CURRENT_STATUS도 함께 갱신해야 한다.
- 다음 AI: 어떤 작업이든 시작 전에 두 `.codex` 문서를 먼저 읽고, 기존 dirty 작업을 보존한다.
