# CURRENT STATUS

마지막 갱신: 2026-08-10

이 문서는 현재 상태만 요약한다. 최근 작업은 `.codex/WORK_LOG.md`, 오래된 이력은
`.codex/archive/`에서 확인한다. 문서와 코드가 다르면 실제 코드와 실행 결과를 우선한다.

## 현재 프로젝트 상태

- ROS2 직접 접근은 `ros2_dashboard_monitor`, 공개 REST/Browser WebSocket과 cache는 순수 FastAPI
  `backend`, 화면은 React `frontend`가 담당하는 분리 구조다.
- 구조 리팩토링은 완료됐다. 이후 분리는 줄 수가 아니라 실제 복수 책임이나 기능 변경이 생길 때만 진행한다.
- 로컬 HTTPS/WSS는 Nginx TLS 종료 방식으로 시스템에 적용됐다. Browser 외부 구간은 HTTPS/WSS,
  Nginx→FastAPI는 localhost HTTP/WS이며 인증서/private key는 Git에 포함하지 않는다.
- Topic QoS는 rclpy Graph endpoint 정보를 표시하고 Monitor Subscription 생성 시 외부 Publisher와 호환되는
  profile을 우선 적용한다. fallback은 실제 관찰값과 구분한다.
- Service와 Action 내부 Service QoS는 Fast DDS passive observer가 제공한다. QoS 확인을 위해 Service Call,
  Action Goal 또는 사용자 데이터 endpoint를 만들지 않는다.
- 현재 작업 트리는 기존 사용자 변경과 최근 기능 변경이 함께 있는 dirty 상태이며 commit/push되지 않았다.

## 현재 핵심 구조

```text
ROS2 Graph / Fast DDS Discovery
├─ ros2_dashboard_dds_observer (C++, optional, 127.0.0.1:8766)
└─ ros2_dashboard_monitor (rclpy, 127.0.0.1:8765)
   → FastAPI Backend Runtime Cache (127.0.0.1:8000)
   → REST / Browser WebSocket
   → React Frontend
   → Nginx HTTPS/WSS (local PC)
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
- AI 작업 로그를 최근 기록과 `.codex/archive/`의 과거 기록으로 분리했다.

## 현재 검증 기준

마지막 기능 변경 기준 확인 결과:

```text
Monitor pytest: 183 passed
Backend pytest: 7 passed
선택 package colcon test-result: 200 tests, 0 failures, 1 skipped
Frontend oxlint/build: 통과
Python compileall: 통과
git diff --check: 통과
```

Fast DDS passive E2E에서는 Call/Goal/Client 생성 없이 Service request Reader/response Writer와 Action
Goal/Result/Cancel의 각 request Reader/response Writer를 발견했다. History/Depth는 `unknown`/`null`,
DataReader Lifespan은 `unknown`으로 유지했다. 테스트 프로세스는 종료했다.

## 현재 문제와 제한

- 작업 트리가 dirty 상태다. 기존 변경을 reset하거나 덮어쓰지 말고 작업별 diff를 구분해야 한다.
- Fast DDS observer는 `rmw_fastrtps_cpp`와 Fast DDS 이름 규칙에 종속된다. 다른 RMW, DDS Security 또는
  Discovery 범위 밖에서는 Service/Action Service QoS가 `graph_unavailable`이 된다.
- DDS Discovery가 제공하지 않는 History/Depth와 DataReader Lifespan은 추정하지 않는다.
- fallback으로 만든 Topic entity는 이후 Graph QoS 변화에 따라 자동 재생성되지 않는다.
- QoS mismatch의 MariaDB Alert 영속 이력 연결은 아직 구현되지 않았다.
- Camera Topic 이미지 시각화와 Gazebo TurtleBot 명령 preset은 아직 구현되지 않았다.
- passive QoS 화면의 실제 Browser 수동 확인과 실제 기기/Gazebo 전체 통합 E2E는 남아 있다.
- demo outcome server 종료 시 중복 shutdown traceback이 발생할 수 있다.

## 다음 우선 작업

1. MariaDB Alert 이력 schema/migration/repository 및 장애 격리 구현
2. Alert 정책 문서와 실제 code/message/lifecycle 동기화 확인
3. Camera Topic (`sensor_msgs/msg/Image`, `CompressedImage`) 시각화
4. Gazebo TurtleBot 명령 preset을 Interface Lab 명시 실행 경로로 구현
5. 실제 장비/Gazebo와 Browser 기준 QoS/WSS/Interface Lab 회귀 검증

신규 작업은 `AGENTS.md`의 현재 책임 경계와 안전 정책을 따르며, 미구현 항목을 완료된 기능으로 보고하지 않는다.
