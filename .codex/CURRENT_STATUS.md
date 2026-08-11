# CURRENT STATUS

마지막 갱신: 2026-08-11

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
- AI 작업 로그를 최근 기록과 `.codex/archive/`의 과거 기록으로 분리했다.

## 현재 검증 기준

마지막 기능 변경 기준 확인 결과:

```text
Monitor pytest: 200 passed
Backend pytest: 7 passed
선택 package colcon test-result: 201 tests, 0 failures, 1 skipped
Frontend oxlint/build: 통과
Python compileall: 통과
git diff --check: 통과
```

Interface Lab demo E2E에서 Topic Auto/Manual Publish·Subscribe, `/RobotControl` Service Auto와 Manual
RELIABLE(depth 7→8), `/CanControl` Action Auto와 채널 그룹별 Manual Goal이 모두 성공했다. Service/Action
Service 채널은 Fast DDS, Topic과 Action Feedback/Status는 Graph 관찰값을 사용한 실제 실행 QoS를 확인했다.

Fast DDS passive E2E에서는 Call/Goal/Client 생성 없이 Service request Reader/response Writer와 Action
Goal/Result/Cancel의 각 request Reader/response Writer를 발견했다. History/Depth는 `unknown`/`null`,
DataReader Lifespan은 `unknown`으로 유지했다. 테스트 프로세스는 종료했다.

## 현재 문제와 제한

- 작업 트리가 dirty 상태다. 기존 변경을 reset하거나 덮어쓰지 말고 작업별 diff를 구분해야 한다.
- Fast DDS observer는 `rmw_fastrtps_cpp`와 Fast DDS 이름 규칙에 종속된다. 다른 RMW, DDS Security 또는
  Discovery 범위 밖에서는 Service/Action Service QoS가 `graph_unavailable`이 된다.
- DDS Discovery가 제공하지 않는 History/Depth와 DataReader Lifespan은 추정하지 않는다. Service Auto의
  Lifespan은 관찰 가능한 원격 Response Writer 값을 단일 Client profile에 전달하며 Request Reader 요구값으로
  해석하지 않는다.
- fallback으로 만든 Topic entity는 이후 Graph QoS 변화에 따라 자동 재생성되지 않는다.
- QoS mismatch의 MariaDB Alert 영속 이력 연결은 아직 구현되지 않았다.
- Camera Topic 이미지 시각화와 Gazebo TurtleBot 명령 preset은 아직 구현되지 않았다.
- 실제 기기/Gazebo 전체 통합 E2E는 남아 있다. 기존 demo_nodes는 Backend 공개 API까지 확인했지만 Browser
  화면 자체의 자동화된 시각 검증은 수행하지 않았다.
- TurtleBot3 통합 launch는 build, launch argument 로드와 package test까지 확인했으며, 이미 실행 중인
  Gazebo/Nav2와 충돌하지 않도록 이번 작업에서 두 번째 GUI stack을 실제로 동시에 띄우지는 않았다.
- QoS 사유 배치는 source와 `frontend/dist`에서 전용 라벨/설명 2행 구조로 수정됐다.
- Action QoS UI는 기본 상태에서 Service(Goal/Result/Cancel)와 Topic(Feedback/Status) 두 요약만 표시하고,
  그룹과 개별 채널을 단계적으로 펼치는 구조다. 상태 badge와 세부 QoS 값은 정상/일부/불일치/확인 불가
  색상을 사용하며 항목명 typography를 통일했다.
- 저장소의 로컬 Nginx 설정은 정적 `/var/www` 복사 대신 Vite 5173을 proxy하도록 변경됐다. 실제 시스템
  Nginx에는 아직 재설치하지 못했으므로 현재 HTTPS 화면은 이전 정적 설정이며,
  `sudo ./scripts/install_local_https.sh`를 한 번 실행한 뒤 문법·listener·Browser WSS를 다시 확인해야 한다.
- 현재 self-signed Nginx 구성의 지원 범위는 localhost와 같은 LAN의 로컬 IP 접속이다. 인터넷 공개용 인증,
  방화벽/라우터 포트 개방, 접근 제어와 운영 정적 배포 구성은 포함하지 않는다.
- demo outcome server 종료 시 중복 shutdown traceback이 발생할 수 있다.
- 현재 Gazebo/Nav2 Graph(137 Topics, 385 Services, 18 Actions)에서는 API 지연 개선 후에도 Monitor main spin CPU가
  약 80~88%다. 다음 성능 진단은 1초 Graph update의 runtime별 계측이 필요하다.

## 다음 우선 작업

1. 변경된 Vite proxy 설정을 실제 시스템 Nginx에 설치하고 HTTPS/WSS/HMR 회귀 검증
2. MariaDB Alert 이력 schema/migration/repository 및 장애 격리 구현
3. Alert 정책 문서와 실제 code/message/lifecycle 동기화 확인
4. Camera Topic (`sensor_msgs/msg/Image`, `CompressedImage`) 시각화
5. Gazebo TurtleBot 명령 preset과 실제 장비/Gazebo·Browser 통합 검증

신규 작업은 `AGENTS.md`의 현재 책임 경계와 안전 정책을 따르며, 미구현 항목을 완료된 기능으로 보고하지 않는다.
