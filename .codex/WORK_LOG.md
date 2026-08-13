# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

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

## 2026-08-11 - Alert 현재/이전 목록 컬럼 분리

- Alert 목록에 lifecycle `상태`와 원래 `레벨`을 별도 컬럼으로 표시했다. 현재 Alert는 `발생 중`, 이전 Alert는
  `해결됨`으로 표시하면서 warning/error/critical은 각각 경고/오류/치명적 badge와 기존 색상을 유지한다.
- 감지 시각은 `first_detected_at ?? detected_at`, 해결 시각은 이전 Alert에서만 `resolved_at`을 사용한다. 현재는
  감지 시각, 이전은 해결 시각 내림차순을 기본값으로 하며 기존 정렬·행 이동·삭제 동작은 변경하지 않았다.
- Frontend oxlint/build와 `git diff --check`가 통과했다. Backend/API/Alert lifecycle 및 DB 코드는 수정하지 않았다.

## 2026-08-11 - Alert MariaDB/화면 정책 문서 확정

- 실제 Topic, Monitor Status, Service, Action, Node Alert builder를 다시 대조해 생성 가능한 code가 18종임을
  확인했다. QoS incompatible, waiting server와 Service Active Check 내부 상태는 실제 Alert 목록에서 제외했다.
- `AGENTS.md`와 기존 Alert 문서에 단일 MariaDB `alert` 테이블, active 중복 INSERT 방지, 해결 UPDATE, 해결 후
  재발 INSERT, DB 전체 이력 보존, `resolved_at` 기반 현재/이전 구분을 확정 정책으로 기록했다.
- 이전 Alert의 `name` 전체 검색, 해결 최신순 50건 페이지 조회, lifecycle 상태와 level 분리 원칙을 문서화했다.
  현재 메모리 최대 50건/재시작 초기화 구현과 향후 DB 정책을 구분했으며 Backend, Frontend, DB 코드는 수정하지 않았다.

## 2026-08-11 - MariaDB Alert 영속 저장과 DB 이력 UI 연결

- Backend `AlertHistoryService.consume()`를 단일 저장 지점으로 두고 exact 8컬럼 `alert` 테이블 Repository를
  연결했다. 기존 Alert `id`를 `alert_key`로 저장하며 advisory lock, transaction, active row 비교로 지속 중
  중복 INSERT를 막고 실제 resolved 시각 UPDATE와 해결 후 재발 INSERT를 처리한다.
- `/ros/alerts`의 현재 목록을 DB active row로 유지하고 `/ros/alerts/history`에 `name` 부분 검색,
  `resolved_at DESC`, 고정 50건 LIMIT/OFFSET을 추가했다. Frontend 이전 탭은 검색과 이전/다음 페이지를 사용하며
  기존 상태/레벨 분리, 행 이동, 삭제 UI를 유지한다.
- 환경변수 기반 PyMySQL 연결과 DB 장애 메모리 fallback/재시도를 추가했다. 격리 MariaDB exact schema E2E에서
  18종 최초/지속/해결/재발 및 55건 50/5 페이지를 확인했다. Backend 14 passed, 1 skipped, Monitor 200 passed,
  Frontend lint/build와 compileall, `git diff --check`가 통과했다.

## 2026-08-11 - Backend 실행 환경 파일 구성

- DB 준비 메모의 실제 접속 정보를 Git에서 제외되는 `backend/.env`로 옮기고 Backend/Monitor URL, CORS,
  MariaDB timeout/retry를 빠짐없이 채웠다. `.env.example` 하단에 중복 노출돼 있던 실제 credential은 제거하고
  비밀 없는 placeholder만 유지했다.
- 새 환경으로 MariaDB `ros2_dashboard.alert` 접근, Backend 재시작, Monitor 연결과 DB 기반 현재/이전 Alert API
  200 응답을 확인했다. 실제 비밀번호는 문서와 로그에 기록하지 않았다.

## 2026-08-11 - Monitor 8765 중복 실행 종료 확인

- 새 launch가 종료된 원인은 기존 Monitor PID 238970이 127.0.0.1:8765를 이미 정상 listen 중인 포트 충돌이었다.
  기존 Monitor health와 Backend `monitor_connected: true`를 확인했으며 ROS discovery 경고는 종료 원인이 아니다.

## 2026-08-11 - Alert DB 조회 UI 최종 양식 연결

- 기존 `/ros/alerts`와 `/ros/alerts/history?name=&page=` DB 조회를 유지하고 현재 `발생 중` 상태 배지만 level에
  맞춰 warning은 노랑, error/critical은 빨강으로 표시했다. 이전 `해결됨`과 원래 level 분리, 공통 시간 formatter,
  행 클릭 이동, 검색·50건 페이지·삭제 경로는 기존 구현을 그대로 확인했다.
- 실제 MariaDB에 고유 resolved 테스트 행 55개를 임시 저장해 name 부분 검색, 50/5 페이지, 최신 해결순,
  warning/error/critical과 timestamp 응답을 검증한 뒤 테스트 행만 모두 정리했다.

## 2026-08-11 - Alert DB 저장 시간대 점검

- MariaDB global/session timezone과 `NOW(6)`가 KST(`UTC+9`)임을 확인했다. 다만 Alert Repository가 epoch를
  UTC naive `DATETIME`으로 변환해 저장하므로 실제 DB 행은 KST 기준보다 9시간 이르게 보인다.
- 조회 시 같은 값을 UTC로 다시 해석해 API/UI 시각은 정상이나 DB 직접 조회 기준과 불일치한다. 기존 행 변환이
  필요한 사안이라 코드와 DB 데이터는 이번 점검에서 변경하지 않았다.

## 2026-08-11 - Alert DB KST 저장 전환

- Alert Repository의 epoch/`DATETIME(6)` 변환을 고정 KST(`UTC+09:00`) 기준으로 대칭 처리해 DB 직접 조회와
  API/UI가 같은 실제 시각을 나타내도록 수정했다. API의 epoch 계약과 8컬럼 스키마는 유지했다.
- 기존 UTC naive Alert 18행은 advisory lock 아래에서 `detected_at`과 `resolved_at`에 9시간을 더해 일회성
  변환했다. 최근 행 `16:23:13.964518`의 DB 저장값과 Backend KST 복원값이 일치함을 확인했다.
- Backend 전체 pytest 15 passed, 2 skipped, compileall과 `git diff --check`가 통과했다.

## 2026-08-11 - nextstep 구현률 코드 대조

- `nextstep.md`의 7개 핵심 기능을 실제 코드·설정·테스트·현재 배포 제한과 대조했다. 동일 가중치의 엄격한
  원문 기준 완료율은 약 66%로 평가했다.
- WSS 85%, Workspace 구조 92%, Alert 정책 문서 92%, MariaDB Alert 78%, 실제 기기 QoS 78%, Camera Topic
  시각화 0%, TurtleBot Interface Lab 제어 35%다. 이후 확정 정책에는 부합해도 원문의 ACK/발생 횟수/다중
  필터처럼 의도적으로 제외된 범위는 완료로 계산하지 않았다.

## 2026-08-11 - Alert 신규 저장 시각 ZoneInfo KST 적용

- Alert Repository의 공통 `detected_at` INSERT / `resolved_at` UPDATE 변환을 고정 offset이 아닌
  `ZoneInfo('Asia/Seoul')` 기반으로 변경했다. DB 스키마, Alert lifecycle, Frontend와 기존 과거 행은 변경하지 않았다.
- 실제 검증 Alert 한 건을 Repository로 발생·해결해 MariaDB `NOW(6) 16:43:53.881930` 기준 detected
  `16:43:53.621782`, resolved `16:43:53.845707` 저장을 확인한 뒤 검증 행만 삭제했다. 기존 active 1건은 유지했다.
- 관련 Backend pytest 12 passed, compileall과 `git diff --check`가 통과했다.

## 2026-08-11 - 실행 Backend stale 코드 진단과 KST 실경로 검증

- 실제 Dashboard는 Nginx → Vite 5173 → Backend 8000을 사용했지만, 8000 PID 316960과 별도 8012 PID 313573
  모두 Repository 수정 전 시작돼 메모리에 UTC 변환 코드를 유지하고 있었다. 두 Backend를 종료하고 현재
  `/home/hs/rang/ros2_dashboard/backend/app/database/alert_repository.py`를 import하는 PID 361269을 8000에만 시작했다.
- 고유 MonitorStatus warning/info를 실제 ROS2 → Monitor → Backend → MariaDB 경로로 발생·해제했다. 새 row
  id 48은 `detected_at 17:10:31.705794`, `resolved_at 17:11:00.439408`로 DB KST와 일치했다. 기존 DB row와
  schema, Alert lifecycle, Frontend 코드는 변경하지 않았다.

## 2026-08-11 - ROS Graph 규모별 Monitor CPU 사전 측정

- 동일 PC에서 별도 ROS domain/port, DB 비활성, Browser 요청 없음 조건으로 30초 안정화 후 30초간 측정했다.
  최소 Graph(2 Nodes/7 Topics/14 Services)는 Monitor 4.83%, Backend 0.20%, 중간 Graph(14/19/114/4 Actions)는
  6.57%/0.43%, Gazebo+Nav2 Graph(25/120/313/17)는 78.43%/1.77%였다.
- Monitor RSS는 약 97.2 → 105.3 → 138.0 MiB, Backend RSS는 60.1 → 61.6 → 71.8 MiB로 증가했다. 큰 Graph에서
  기존 80~88% CPU가 재현됐지만 실제 기기 성능을 뜻하지 않으며, 실기기 연결 후 동일 방식으로 다시 측정해야 한다.
- 측정용 프로세스와 포트를 모두 종료하고 기존 운영 Dashboard health와 Monitor 연결이 정상임을 확인했다.

## 2026-08-12 - 실제 Nginx Vite proxy·HTTPS/WSS/HMR 재검증

- 시스템 `/etc/nginx/conf.d/ros2-dashboard.conf`를 현재 저장소 템플릿 렌더 결과와 byte 단위로
  비교했으며 이미 완전히 일치해 재설치가 필요하지 않았다.
- Nginx는 active/enabled 상태이고 HTTPS `/`의 Vite HTML, `/@vite/client`, `/src/main.jsx`, Backend
  `/health`가 모두 정상으로 응답했다. Backend `wss://localhost/ws/monitor`에서
  `monitor_snapshot`을 수신했고 Vite `vite-hmr` WebSocket도 HTTPS Nginx를 경유해 upgrade·연결됐다.
- 인증서 SAN은 `localhost`, `127.0.0.1`, `192.168.1.123`을 포함하며 2028-11-12까지 유효하다.
  코드와 시스템 설정은 변경하지 않고, 오래된 CURRENT_STATUS의 미설치 표시만 현재 사실로 갱신했다.

## 2026-08-12 - Camera Topic 요청형 이미지 Preview

- 기존 Topic 자동 구독·QoS·latest·Hz·age·stale 경로에 `Image`/`CompressedImage`를 추가하고,
  정기 snapshot에는 메타데이터만 유지하며 선택한 Topic의 별도 API에서만 제한된 data URL을 생성했다.
- Raw `rgb8`/`bgr8`/`mono8`은 PNG, CompressedImage JPEG/PNG는 Browser preview로 제공하고 미지원
  encoding/format은 Topic 감시를 깨뜨리지 않는 상태로 표시한다. 320x180 패턴의 1 Hz demo Publisher를 추가했다.
- 검증: Monitor 209 passed, 선택 package 227 tests/0 failures/1 skipped, Frontend lint/build 통과.
  격리 live E2E에서 raw/compressed preview, 1.0 Hz, stale/disconnected, 일반 JSON 회귀와 headless Browser 이미지 렌더링을 확인했다.
  실제 Monitor를 새 build로 재시작한 뒤 HTTPS→Backend→Monitor raw preview도 `ready` PNG로 재검증했다.
- 최근 WORK_LOG 48개 중 오래된 23개를 `.codex/archive/WORK_LOG_2026-08-10_to_2026-08-11_003.md`로
  이동해 최근 25개만 유지했고, 분리 전후 본문 SHA-256 `cfef76e3c03a46b993183ed8f31e8802811eea2d5ba4b43ebfee454c3d3465b5`가 일치했다.

## 2026-08-12 - Camera Preview 클릭 확대 modal

- Topic 상세의 Camera preview를 클릭·키보드로 열 수 있는 확대 modal로 연결했고,
  Esc·배경 클릭·닫기 버튼을 지원했다. Frontend lint/build와 실제 Browser DOM 열기/닫기를 검증했다.

## 2026-08-12 - 실제 기기 Camera Topic 호환 경로 재확인

- Camera 변환 경로가 Demo Topic 이름이나 Publisher 구현에 의존하지 않고 ROS Graph에서 발견한
  `sensor_msgs/msg/Image`·`CompressedImage` 타입과 실제 수신 payload를 기준으로 동작함을 코드로 재확인했다.
- 현재 raw 지원은 `rgb8`·`bgr8`·`mono8`, compressed 지원은 JPEG·PNG이며 기본 제한은 1920x1080,
  source payload 4 MB다. 그 밖의 encoding/format과 제한 초과 frame은 감시는 유지하되 preview 미지원으로 표시한다.

## 2026-08-12 - Camera Preview 실제 확대·크기 조절

- 뒤쪽 공통 modal CSS가 Camera modal을 760px로 다시 제한하던 specificity 문제를 수정해 팝업이 화면의
  96vw/94vh를 사용하도록 했고, 기본 화면 맞춤에서 저해상도 이미지도 가용 영역까지 실제 확대되게 했다.
- 25% 단위 25~400% 확대·축소, 화면 맞춤, 원본 크기, 확대 시 양방향 overflow scroll을 추가했다.
  Frontend lint/build와 1440x900 headless Browser에서 320x180 frame의 1321x709 맞춤 확대,
  125% 폭 1633px 및 동일 scroll 폭, 원본 320x180 복원을 검증했다.

## 2026-08-12 - Camera 확대 popup 크기 조정

- 사용자 요청에 따라 데스크톱 Camera popup을 기존 96vw/94vh 기준에서 가로 20%, 세로 5% 줄인
  76.8vw/89.3vh로 조정했다. 화면 맞춤·확대/축소·원본 크기 동작은 유지했다.

## 2026-08-12 - 실제 기기 `/camera/image_raw` 출력 조건 확인

- Dashboard는 Gazebo/실기기를 구분하지 않고 ROS Topic의 표준 type, payload encoding, QoS를 기준으로 구독하므로
  실제 Camera driver가 지원 형식의 `sensor_msgs/msg/Image` 또는 `CompressedImage`를 발행하면 같은 UI에 출력된다.
- 확인 시점의 현재 셸 ROS Graph에는 `/camera/image_raw`가 없어 live type/QoS 대조는 하지 못했다. UI의 마지막 frame
  유지와 실시간 Publisher 존재 여부는 구분해야 하며, 실제 장비 검증 시 Graph/type/encoding/QoS를 함께 확인해야 한다.

## 2026-08-12 - QoS 상태 가시성·확정 Alert 개선

- 기존 QoS 계산을 유지한 채 Topic/Service/Action 목록에 상태 badge, 상세 상단에 호환/일부 호환/불일치/확인 불가
  안내와 QoS 상세 펼치기를 추가했다. Action은 Goal/Result/Cancel/Feedback/Status 문제를 채널별로 표시한다.
- 주요 감시 대상에서 확정 `incompatible`만 설정값(기본 3회)만큼 연속 관찰한 뒤 QoS Alert를 생성한다.
  Graph 일부 조합은 warning, 실제 RMW 이벤트 또는 전체 상대 endpoint와 통신 불가능이 확인되면 error이며,
  `partial`·`unknown`·observer 미사용·fallback 자체는 Alert에서 제외했다. MariaDB 스키마는 변경하지 않았다.
- Alert 클릭 시 해당 상세로 이동해 QoS 영역과 Action 문제 채널을 펼친다. Monitor 216 tests, colcon 234 tests
  (0 failures, 1 skipped), Backend 15 passed/2 skipped, Frontend lint/build를 통과했다. 격리 ROS Graph E2E에서
  3회 확인 후 warning 생성과 endpoint 제거 후 resolved 전환까지 검증했다.

## 2026-08-12 - DDS observed 목록 배지 의미 수정

- Service와 Action의 Fast DDS 발견 결과인 `observed`가 목록에서 `unknown`으로 합쳐져 `QoS 확인 불가`로
  표시되던 Frontend 상태 집계 오류를 수정했다. 호환으로 과장하지 않고 파란 `QoS 발견됨`으로 분리했다.
- Action은 5개 채널이 `compatible`/`observed` 조합이고 불일치가 없으면 `QoS 발견됨`으로 집계한다.
  Alert 제외 정책은 유지했다. Frontend lint/build와 실제 Chrome DOM에서 Service/Action 배지 두 건을 확인했다.

## 2026-08-12 - QoS 요약의 중복 상세 버튼 제거

- 상세 화면의 QoS 상태 안내와 기존 접이식 QoS 영역이 함께 보이는 구조에서 중복된 `QoS 상세 보기` 버튼만
  제거했다. 기존 QoS 상세 영역과 QoS Alert 클릭 시 자동 펼침은 유지했으며 Frontend lint/build를 통과했다.

## 2026-08-12 - Node 주요/전체 필터 동일 현상 진단

- 실행 중인 Monitor snapshot과 Frontend 필터를 대조했다. UI는 `전체`와 `is_primary`를 구분하지만 내부 제외
  47개가 모두 primary여서 결과가 실제로 동일했다(활성 10, disconnected 37).
- 원인은 모든 disconnected Node를 자동 primary로 만드는 Backend 정책과, 활성 10개가 모두 등록 리소스 또는
  지원·필수 Topic에 연결된 현재 Graph 구성이다. 진단 요청 범위라 코드는 변경하지 않았다.

## 2026-08-12 - Node 필터 확정 정책 재대조

- `AGENTS.md`와 `docs/docs2/05_node_flow.md`를 다시 확인해 disconnected Node의 주요 승격은 명시된 정책임을
  확인하고, 앞선 “정책이 지나치게 넓다”는 평가를 정정했다.
- 반면 문서가 주요 목록에서 제외하도록 정한 transform listener, launch helper, `_rclcpp_node`,
  `_action_client` 필터는 현재 구현에 없다. 실제 snapshot에서 해당 보조 Node 13개가 모두 primary로 노출됨을
  확인했다. 확인 요청 범위라 코드는 변경하지 않았다.

## 2026-08-12 - Node 보조 항목 주요 필터 반영

- 문서 정책대로 transform listener, `launch_ros_*`, `*_rclcpp_node`, `*_action_client`를 Backend snapshot에서
  `is_auxiliary=true`로 분류하고 자동 `system_primary`에서 제외했다. 일반 disconnected Node는 주요로 유지하며,
  `nodes.primary_names` 또는 사용자 별표로 명시한 보조 Node는 주요에 포함된다.
- Monitor 219 tests와 colcon 237 tests(0 failures, 1 skipped), compileall, diff check를 통과했다. 실제 ROS Graph에
  임시 보조 Node를 띄워 실행 중과 disconnected 상태 모두 `전체 11 / 주요 10`, `is_primary=false`를 확인한 뒤
  테스트 Node와 cache를 정리하고 Monitor를 재시작했다.

## 2026-08-12 - 실행 Frontend UX 점검

- HTTPS로 실행 중인 Dashboard의 Overview/Topic/Service/Action/Node/Alert를 1440x1000 실제 Browser 화면으로
  점검했다. 코드는 변경하지 않았다.
- 최우선 문제는 고정 상세 패널과 과도한 테이블 열 때문에 헤더가 겹치고 이름이 글자 단위로 줄바꿈되는 목록
  가독성이다. 그 밖에 축약된 Sidebar, 한국어/영문 상태 혼용, 의미가 불명확한 요약 count, 빈 Alert 영역의
  과도한 높이, 정상 DDS 발견 안내의 높은 시각 비중을 후속 UX 개선 대상으로 확인했다.

## 2026-08-12 - 진단 목록 UI 정보 밀도 축소

- 기존 Monitoring/API 기능은 유지하면서 Topic 7열, Service 7열, Action 7열, Node 6열로 기본 목록을 줄였다.
  이름·타입은 한 줄 ellipsis/title로 바꾸고 endpoint, Dashboard 통신, Graph 관계와 기타 metadata는 기존
  상세 영역에 유지했다.
- 첫 항목 자동 선택을 제거해 선택 전 목록이 전체 폭을 사용하게 했고, 행 선택 시 390px 상세 패널을 열며
  `닫기 ×`로 다시 닫도록 했다. 빈 Alert는 한 줄로 축소하고 QoS observed 안내를 작은 회색 보조 badge로 낮췄다.
  요약 카드는 5개 수준으로 줄이고 `활동`을 실제 Backend 의미에 맞는 `주요`로 바꿨으며 Sidebar 폭과
  대표 영문 상태/사유 표시를 정리했다. Overview 중복 상태 분포 차트는 접힌 고급 보기로 유지했다.
- Gazebo/demo live 데이터로 1440x1000 Chrome에서 Overview/Topics/Services/Actions/Nodes를 확인했다.
  헤더 겹침과 글자 단위 줄바꿈이 없고 Sidebar 라벨이 온전히 보였다. Topic 상세는 DOM 기준 선택 전 0개,
  열림 1개/390px, 닫힘 0개이며 목록 폭이 1205px → 797px → 1205px로 정상 복원됐다.
- 검증: Monitor pytest 219 passed, Backend pytest 15 passed/2 skipped, Frontend oxlint/build와
  `git diff --check` 통과.

## 2026-08-12 - 리소스 목록 상태 열·배지 정렬 통일

- Topic, Service, Action 목록의 두 번째 열 이름을 모두 `상태`로 통일했다. 대표 상태와 QoS 보조 badge를 공통
  stack으로 묶어 동일한 왼쪽 기준선, 5px 세로 간격과 최소 폭을 사용하도록 정렬했다.
- Frontend oxlint/build와 `git diff --check`를 통과했고, 세 탭을 1440x1000 Chrome에서 렌더링해 헤더와
  `정상`/`QoS 발견` 등 2단 badge 정렬을 확인했다.

## 2026-08-12 - Node 목록 열·연결 명칭 정리

- Node 기본 목록에서 네임스페이스 열을 제거하고 상세 패널의 네임스페이스 정보는 유지했다. 연결 리소스의
  `T`/`S`/`A` 축약 표기는 `Topic`/`Service`/`Action` 전체 명칭으로 변경했다.
- Frontend oxlint/build를 통과했고 1440x1000 Chrome에서 5열 목록과 전체 연결 명칭 표시를 확인했다.

## 2026-08-12 - Interface Lab 목록 중심 UI 1차 정리

- 목록 행 아래에 삽입되던 선택 상세를 데스크톱 420~460px 우측 패널로 옮기고, 선택 전에는 닫힌 상태로
  유지했다. 초기 안내·관리 영역은 접고 요약을 등록/실행 가능/build 필요/오류 4개로 축소했다.
- 기본 종류 필터를 Topic/Service/Action/Package로 정리하고 이름·타입 검색과 상태 필터, 상황별 빈 상태를
  추가했다. 목록 행은 이름/타입/대표 상태/상세 동작 중심으로 줄였으며 긴 값은 한 줄 ellipsis를 사용한다.
- Topic은 Publish/Receive/History/고급 정보, Service와 Action은 실행/History/고급 정보 탭으로 분리했다.
  QoS·timeout·Graph·schema/raw는 기본 접힘으로 내리고, Topic 수신 시작/중지는 하나의 전환 버튼으로 합쳤다.
  Action 취소는 활성 실행 중에만 주의색 버튼으로 표시하고 History는 최근 3건과 확인 절차가 있는 관리 영역을 쓴다.
- 1440x1000 Chrome에서 초기 화면과 Topic/Service/Action/Package 선택을 확인했다. Topic 선택 시 목록 729px,
  우측 패널 460px로 유지됐고 Service/Action 탭과 비활성 Action 취소 버튼 미노출을 확인했다.
  Frontend lint/build, Backend 15 passed/2 skipped, colcon 237 tests(0 failures, 1 skipped), diff check를 통과했다.

## 2026-08-12 - Interface Lab 실행·기기 수신 및 QoS 접근 복원

- UI 밀도 축소 과정에서 제거했던 관리 영역의 통신 진입점을 `Topic 실행`, `Service 실행`, `Action 실행`,
  `기기 수신`으로 복원했다. 기존 실행/수신 runtime과 API는 그대로 재사용한다.
- 선택 상세과 전체 수신 workspace 모두 QoS `Auto / Manual` 선택을 기본 실행 화면에서 바로 볼 수 있게 하고,
  timeout·Hz 같은 나머지 설정만 고급 영역에 유지했다. 수신 workspace의 불필요한 Mock 준비중 탭은 제거했다.
- 1440x1000 Chrome DOM에서 통신 버튼 4개, Topic/Service/Action 수신 탭, Topic 수신 QoS의 Auto/Manual
  option을 확인했다. Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - Overview 그래프·Interface 관리 상시 펼침

- Overview 상태 분포 그래프와 Interface Lab의 Interface 관리 컨테이너를 `details`에서 일반 section으로 바꿔
  접기 기능과 접힘 상태를 제거하고 항상 펼쳐진 상태로 고정했다.
- 1440x1000 Chrome에서 Overview 진입 즉시 그래프가 보이고 Interface Lab 진입 즉시 등록/적용/관리/통신
  버튼이 보이는 것을 확인했다. Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - Interface Lab 검색·통신 버튼 UI 통일

- Interface 목록 검색창과 상태 select를 Topic/Service 등 다른 탭의 공통 dark filter toolbar 스타일로 통일했다.
- Topic/Service/Action 실행 버튼을 파일 업로드와 같은 badge형 버튼으로 맞추고 관리 영역의 `기기 수신` 버튼은
  제거했다. 선택 상세의 Topic Receive와 QoS Auto/Manual 기능은 유지했다.
- 1440x1000 Chrome에서 검색/상태 입력, 실행 버튼 3개와 기기 수신 버튼 미노출을 확인했다.
  Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - Interface 목록 선택 기본 화면을 통신 상세로 변경

- Interface 목록 행 선택 시 Publish/Service Call/Action Goal 입력 폼을 즉시 열던 동작을 제거하고 `통신 상세`를
  기본 탭으로 추가했다. 실제 실행은 사용자가 Publish/Receive/Service Call/Goal 실행 탭을 선택해야 열린다.
- 통신 상세에는 full type, Graph 연결 수, 서버/실행 가능 상태, 연결 Topic/Service/Action/Subscription의
  endpoint·QoS 관련 값을 표시한다. source/package/import/schema/raw는 기존 고급 정보 탭에 유지했다.
- Chrome에서 Message Interface 선택 시 `통신 상세`가 기본 활성화되고 Endpoint QoS가 표시되며 실행 버튼은
  렌더링되지 않는 것을 확인했다. Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - Interface 실행 패널 닫기 추가

- 관리 영역에서 여는 Topic/Service/Action 실행 패널 제목 우측에 접근 가능한 `×` 닫기 버튼을 추가했다.
  닫기는 현재 execution mode만 해제하므로 실행 이력, 결과와 QoS 입력값은 초기화하지 않는다.
- Chrome에서 Topic 실행 패널을 열어 `등록 Topic 실행 닫기` 버튼 노출과 클릭 후 실행 패널 1개→0개 전환을
  확인했다. 세 실행 패널은 동일 heading component와 close callback을 사용한다. Frontend lint/build와
  diff check를 통과했다.

## 2026-08-12 - Interface 수신 패널 닫기·닫기 버튼 강조

- Topic/Service/Action 수신 workspace 제목 우측에 `닫기 ×` 버튼을 추가하고 기존 실행 패널의 작은 `×`도
  텍스트가 있는 동일 버튼으로 변경했다.
- 수신 패널 닫기는 표시 상태만 해제하며 이미 시작된 Subscription, 수신 이력과 QoS 설정을 중지하거나
  초기화하지 않는다. Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - 우측 상세 실행 진입점 통일

- Interface 우측 상세의 Publish/Receive/Service Call/Goal 실행 탭을 제거하고 종류와 무관한 공통 `실행`
  버튼 하나로 통일했다. 통신 상세/History/고급 정보는 우측 패널에 유지한다.
- 공통 실행 버튼은 선택 kind에 따라 관리 영역의 Topic/Service/Action 실행 workspace를 열며, 수신 패널을
  함께 강제로 열지 않는다. Chrome에서 Message 선택 시 우측 탭이 통신 상세/History/고급 정보만 남고,
  `실행` 클릭 후 `등록 Topic 실행` 패널이 열리며 수신 패널은 0개인 것을 확인했다.
- Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - 실행 workspace 수신 패널 복구

- 공통 실행 버튼과 우측 상세의 단순화는 유지하면서 Topic/Service/Action 실행 workspace를 열 때 같은 종류의
  수신 패널도 함께 열리도록 복구했다. 실행 mode와 수신 mode를 동일 kind로 맞추고 최신 수신 상태를 로드한다.
- 실행/수신 각각의 QoS Auto/Manual과 독립 `닫기 ×` 동작은 유지했다. Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - 우측 실행 탭·종류별 전체 History 초기화 통일

- 우측 상세 탭을 `통신 상세 / History / 고급 정보 / 실행` 순서로 통일하고 실행은 선택 kind에 맞는 관리
  workspace를 여는 navigation으로 연결했다.
- History 관리에 Topic/Service/Action 공통 `전체 이력 초기화` 확인 버튼과 주의색 pill badge를 추가했다.
  Topic 전체 Publish/Subscribe, Service 전체 Call, Action 전체 Goal 이력을 지우는 Monitor API를 연결했다.
- Frontend lint/build, Python compileall, colcon build와 237 tests(0 failures, 1 skipped)를 통과했다.

## 2026-08-12 - Interface 우측 상세 닫기 버튼 통일

- Topic/Service/Action/Package가 공유하는 우측 상세 닫기 버튼에 전용 dark secondary 스타일을 적용해 브라우저
  기본 흰색 버튼을 제거했다. hover/focus 시에만 파란 테두리와 밝은 글자를 사용한다.
- Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - Interface 실행·종류 badge 색상 구분

- 관리 영역 실행 버튼을 Topic 초록, Service 노랑, Action 보라로 구분했다.
- Interface 목록의 `srv` 종류 badge를 노랑, `pkg` 종류 badge를 빨강으로 변경했고 msg 파랑/action 보라는
  유지했다. Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - History 선택/전체 초기화·목록 상태 badge 통일

- Topic/Service/Action History 관리에 `선택 이력 초기화`와 `전체 이력 초기화`를 동일하게 제공했다. 선택은
  현재 우측 Interface의 type/name 범위, 전체는 해당 종류 전체 범위이며 각각 파랑/빨강 pill badge와 확인창을 쓴다.
- Service Call과 Action Goal reset API가 선택 name/type payload를 받아 해당 실행 이력만 제거하도록 확장했고,
  Topic Publish/Receive도 type-only 선택 초기화를 지원한다. 실행 Client/QoS는 유지한다.
- Graph Service `/RobotControl`만 `호출 가능`으로 달랐던 목록 대표 badge를 다른 Interface와 같은 `실행 가능`으로
  통일했다. Frontend lint/build, Python compileall, workspace source 후 colcon 237 tests(0 failures, 1 skipped),
  diff check를 통과했다.

## 2026-08-12 - RobotControl/ScheduleCrud History UI 통일

- 이력이 있는 `/ScheduleCrud`와 이력이 없는 `/RobotControl`이 서로 다른 렌더링 분기를 사용하던 부분을 없애고,
  둘 다 동일한 최근 호출 이력 제목·빈 상태·History 관리·선택/전체 초기화 badge 컨테이너를 사용하게 했다.
- Action History에도 누락됐던 동일 reset callback을 연결해 Topic/Service/Action 모두 같은 구조를 사용한다.
  Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - Service 응답 정렬·Action 마지막 응답 시간

- Service 목록의 `최근 응답` 헤더와 JSON preview 내용을 동일한 가운데 정렬으로 맞췄다.
- Action의 기존 `마지막 Feedback`/`마지막 Result` 내용은 유지하고, 두 응답 시각 중 최신 값을
  상대 시각으로 보여주는 `마지막 응답 시간` 정렬 열을 추가했다. Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - 모니터링 목록 핵심 진단 정보 복원

- 현재 경량 UI를 유지하면서 Topic에 endpoint Pub/Sub·Hz·최근 데이터·마지막 수신, Service에 Server/Client·호출
  가능·최근 응답·응답 시간·마지막 호출, Action에 Server/Client·Goal·Feedback·Result·실행 시간·최근 Goal을 복원했다.
  Node는 합쳐진 연결 리소스 대신 namespace와 Topic/Service/Action의 Server/Client 역할별 수를 다시 분리했다.
- raw JSON과 endpoint 상세는 우측 상세에 유지하고, 이름·타입 ellipsis, 숫자·상태·시간의 공통 가운데 정렬과
  좁은 화면 가로 스크롤을 적용했다. 실제 `/RobotControl`, `/CanControl`, demo Node 응답과 1440x1000 Chrome에서
  전 열 표시·헤더 겹침 없음·QoS 보조 badge를 확인했고 Frontend lint/build와 diff check를 통과했다.

## 2026-08-12 - 모니터링 목록 실제 최신 payload 복원

- Topic의 요약 `데이터 있음`, Service의 호출 가능/응답 상태, Action의 Feedback/Result 상태 badge를 제거하고 기존
  `last_message_preview`, `last_request_preview`, `last_response_preview`, `last_feedback_preview`,
  `last_result_preview`를 목록에 compact JSON으로 직접 표시했다. Backend/Monitor 수집 로직은 변경하지 않았다.
- 객체/배열·문자열·숫자·boolean·빈 값을 공통 처리하는 preview formatter/component를 추가하고 기존 JSON popup도
  같은 formatter를 재사용한다. 데이터 셀은 고정 폭, 한 줄 ellipsis, 전체값 title을 사용한다.
- 1440x1000 Chrome에서 Topic/Service/Action 전 컬럼 정렬과 실제 값 표시를 확인했다. Demo `/RobotControl`
  Service Call과 `/CanControl` Action Goal을 실제 실행해 Request/Response 및 Feedback/Result 갱신을 검증했다.
  Frontend lint/build, ROS2 workspace build와 `git diff --check`가 통과했다.

## 2026-08-12 - 목록 마지막 값 명칭·기존 JSON modal 복원

- Topic/Service/Action의 최신 payload 열을 `마지막 값`, `마지막 Request/Response`, `마지막 Feedback/Result`로
  통일하고 Goal 상태·응답/실행 시간·Goal 시각도 마지막 실행 기준임을 헤더에 명시했다.
- 이전 diff의 `JsonPreviewButton`과 `JsonPreviewModal` 연결 방식을 그대로 복원했다. 목록은 compact JSON 한 줄을
  유지하고 값을 누르면 전체 payload를 pretty JSON modal에서 확인하며, 배경/Esc/닫기 동작도 기존 구현을 재사용한다.
- 1440x1000 Chrome에서 세 목록 헤더와 값 정렬을 확인했다. 긴 Action 헤더는 필수 정보를 숨기지 않고 테이블 가로
  스크롤로 처리했다. Frontend lint/build와 `git diff --check`가 통과했다.

## 2026-08-12 - 통신 목록 Dashboard 포함 여부·정책 대조

- 코드와 실행 API를 조사해 Topic·Service·Action 목록이 현재 Dashboard 포함 원본 endpoint count를 표시하는 반면,
  snapshot에는 Dashboard 제외 고유 Node count가 별도로 존재함을 확인했다. `/demo_camera/image_raw` Subscriber,
  `/RobotControl` Client, `/CanControl` Client가 각각 화면 1·외부 Node 0으로 재현됐다.
- AGENTS와 `docs/docs2` 정책은 기본 목록에는 Dashboard 제외 `*_node_count`, 상세에는 Dashboard 포함 endpoint 진단값을
  사용하도록 정의한다. Node 탭은 기본적으로 내부 Node를 제외하고 `숨김 포함`에서만 표시해 정책과 일치한다.
- 조사만 수행했으며 계산·Frontend·문서 정책은 변경하지 않았다. 확인된 구현/정책 불일치만 CURRENT_STATUS에 기록했다.

## 2026-08-12 - 통신 목록 Dashboard 제외 Node 수 정책 복원

- 과거 구현의 기존 fallback을 그대로 복원해 Topic은 `publisher_node_count/subscriber_node_count`, Service와
  Action은 `server_node_count/client_node_count`를 목록 표시와 정렬에 우선 사용한다. 구 API에만 원본 endpoint
  count를 fallback으로 사용하며 Monitor/API 계산 로직은 변경하지 않았다.
- 헤더를 `Publisher/Subscriber/Server/Client Node 수 (Dashboard 제외)`로 명시했다. Dashboard 포함 원본 endpoint
  수는 기존 상세 패널에 유지되고 Node 탭의 기본 제외·`숨김 포함` 정책도 변경하지 않았다.
- 실제 API와 1440x1000 Chrome에서 Camera Subscriber, Service Client, Action Client가 Dashboard endpoint 1개를
  제외해 각각 0으로 표시되고 외부 Publisher/Server Node는 1로 유지됨을 확인했다. Frontend lint/build와
  `git diff --check`가 통과했다.

## 2026-08-12 - AGENTS 현재 구현 기준 통합 갱신

- 기존 `AGENTS.md`의 “최신 우선 절 + 리팩토링 전 기록” 중복 구조를 제거하고 실제 폴더, 프로세스 책임,
  설정, resource 정책, Interface Lab, WSS와 작업 규칙을 현재형 단일 문서로 교체했다.
- 실제 코드와 DDL을 대조해 QoS 상태·채널·Alert confirmation, 현재 21종 Alert, MariaDB `alert`의 총 9개 컬럼,
  PK/무 unique·index, advisory lock lifecycle, acknowledgement/detail/occurrence 및 migration 미구현을 명시했다.
- Camera Preview의 지원 type/encoding/format, 별도 demand endpoint, TTL/rate/size 제한과 snapshot binary 제외를
  기록했다. Alert 문서의 오래된 18종 및 migration 표현도 최소 교정했으며 경로·용어 grep과
  `git diff --check`로 문서 변경을 검수했다.

## 2026-08-12 - Graph 이탈 debounce·Topic 미수신 원인 진단

- 순간 Graph 흔들림을 장애로 확정하지 않도록 Service/Action에 설정형 5초 confirmation을 추가하고 Node는 기존
  5초 stale 설정을 같은 공통 debounce 경로에 적용했다. 첫 누락 poll은 직전 상태를 유지하며, 제한 시간 뒤에만
  disconnected가 되고 재등장하면 즉시 active로 복귀한다.
- Node `node_stale` code는 DB 호환을 위해 유지하되 주요 감시 대상이면서 내부/tool Node가 아닌 경우에만 Alert를
  생성하고, 화면 용어를 실제 의미인 `Graph 이탈`로 정리했다.
- Topic missing/stale에 기존 Publisher, Dashboard Subscription, 생성 실패, Graph QoS와 실제 RMW incompatible
  event를 조합한 `reception_diagnosis`를 추가했다. RMW event와 Subscription 실패만 confirmed, Graph 불일치는
  candidate로 구분하며 compatible/unknown/observed와 stale Publisher 유무도 별도 안내한다. 새 Alert code나 DB
  schema는 만들지 않고 기존 Alert에 진단과 관련 QoS Alert id만 부가했다.
- Topic 상세에는 진단 근거를, 목록에는 작은 원인 badge를 표시하고 기존 대표 상태·QoS 상세·Alert lifecycle을
  유지했다. 정책 문서 01~04에 debounce, 원인 진단과 Node 대상 제한을 반영했다.
- 검증: Monitor 236 passed, Backend 15 passed/2 skipped, Frontend lint/build 통과, 전체 colcon 254 tests
  (0 failures, 1 skipped), `git diff --check` 통과. 격리 ROS domain에서 BEST_EFFORT Publisher와 RELIABLE
  Dashboard Subscription 조합이 Graph QoS 원인 후보로 표시되는 실제 rclpy E2E도 확인했다.
- 남은 제한: 실제 RMW event 외 Graph 비교와 수신 경로 안내는 증명된 장애 원인이 아니라 원인 후보이며,
  실제 장비 callback/transport 상태를 직접 확인하는 기능은 아니다.

## 2026-08-13 - Alert 목록 앞쪽 컬럼 간격 축소

- Alert 목록을 Topic 테이블의 고정 컬럼 규칙에서 분리하고 상태·레벨·출처·이름의 폭과 셀 좌우 여백을 줄였다.
  긴 이름·메시지·code는 한 줄 ellipsis와 tooltip을 사용하며 메시지 컬럼은 300px을 확보해 이름이 길어도
  메시지를 가리지 않게 했다. Frontend lint/build와 `git diff --check`를 통과했다.

## 2026-08-13 - 오류·경고 메시지 본문 영어 통일

- Topic·Service·Action·Node·QoS Alert과 Topic 미수신 진단, Interface Lab의 Publish/Receive/
  Call/Goal·build/import/apply 오류, Backend 연결·사용자 설정 오류, Frontend fallback 경고/
  오류 본문을 짧고 직접적인 영어 문장으로 통일했다.
- `정상/경고/오류/주의/확인 불가` 등 UI 라벨·배지는 한국어로 유지했고, status/code/enum,
  Alert confirmation·resolve, DB schema는 변경하지 않았다. 외부 ROS `MonitorStatus.message`는
  Dashboard가 번역할 수 없는 장비 원문이므로 그대로 전달한다.
- 검증: Monitor 236 passed, Backend 15 passed/2 skipped, Frontend lint/build 통과, 전체 colcon
  254 tests (0 failures, 1 skipped), 한국어 message/reason/error/detail 검색에서 성공 알림·UI 라벨·
  외부 payload 외 내부 오류 본문이 남지 않음, `git diff --check` 통과.

## 2026-08-13 - Topic 상태 발행자·구독자 용어 통일

- Topic 목록의 수신 원인 보조 badge에 남아 있던 `Publisher 없음`을 `발행자 없음`으로
  바꿔 기존 `구독자 없음`, `발행자 대기`와 한국어 용어를 맞췄다. 내부 cause/status 값과 판정
  로직은 변경하지 않았다.

## 2026-08-13 - 목록 상태 상·하단 badge 크기 통일

- Topic·Service·Action 상태 셀의 대표 상태 badge와 QoS/원인 보조 badge를 112px 폭,
  22px 최소 높이와 가운데 정렬로 맞췄다. 보조 badge 글자는 긴 `QoS 일부 호환`,
  `QoS 불일치 가능` 등이 잘리지 않도록 11px로 조정했다.

## 2026-08-13 - 목록 상태 badge 축소·Node 규격 통일

- Topic·Service·Action의 상·하단 상태 badge를 104px × 최소 20px로 한 단계 줄였고,
  Node 목록의 단일 상태 badge도 같은 폭·높이·가운데 정렬 규격을 적용했다.

## 2026-08-13 - QoS 발견 badge 정보색 적용

- Topic·Service·Action 목록의 `observed` 상태 `QoS 발견` badge를 회색에서 기존 파란
  정보색으로 변경했다. `unknown`의 `QoS 확인 불가`는 기존 회색을 유지한다.

## 2026-08-13 - Interface Lab 필터 초기화 버튼 다크 테마 조정

- Interface 검색·상태 필터의 빈 결과 초기화 버튼에 전용 클래스를 추가해 하얀 기본
  배경을 제거하고, 기존 상세 닫기와 어울리는 다크 네이비 배경·중립 테두리·호버 정보색을
  적용했다.

## 2026-08-13 - Interface Lab 관리 패널 확대·닫기 통일

- `타입 직접 등록`, `등록 목록`, `Package 목록` 패널 헤더를 Topic 실행 패널의 공통
  `ExecutionPanelHeading`으로 교체해 `크게보기/목록보기`와 `닫기 ×` 버튼 형식을 동일하게
  적용했다. 닫을 때는 해당 패널과 확대 상태를 함께 해제한다.

## 2026-08-13 - Interface Lab 등록·Package 목록 닫기 연결 수정

- 관리 View props 조립 시 누락된 `setShowRegistry`, `setShowPackages`를 전달해 `등록 목록`과
  `Package 목록`의 `닫기 ×`가 실제 open 상태를 false로 바꾸고 패널을 제거하도록 수정했다.

## 2026-08-13 - Node 목록 이름·Namespace 통합

- Node 목록의 별도 `Namespace` 컬럼을 제거하고 `Node 전체 이름`에 `full_name`을 표시해
  root namespace의 `/`가 행마다 반복되는 문제를 없앰다. 정렬·선택 key와 검색은 기존
  `full_name`/`namespace`를 유지하고, 우측 상세에서는 이름과 namespace를 개별로 계속 표시한다.
