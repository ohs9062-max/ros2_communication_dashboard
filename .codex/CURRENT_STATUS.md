# CURRENT STATUS

마지막 갱신: 2026-08-07

이 문서는 다음 AI가 현재 작업 지점을 빠르게 파악하기 위한 요약이다. 세부 정책은
`AGENTS.md`, 누적 이력은 `.codex/WORK_LOG.md`를 확인한다. 문서와 코드가 다르면 실제 코드와
검증 결과를 우선한다.

## 현재 프로젝트 구조

```text
ros2_dashboard/
├─ backend/                     # 순수 FastAPI, Monitor client/cache, REST/WS, 사용자 정책
│  ├─ app/
│  ├─ config/user_preferences.yaml
│  └─ tests/
├─ ros2_ws/src/
│  ├─ ros2_dashboard_monitor/   # rclpy Monitor와 Interface Lab 실제 ROS2 실행
│  ├─ ros2_dashboard_interfaces/
│  ├─ ros2_dashboard_demo_nodes/
│  └─ uploaded_interfaces/
│     ├─ generated_interfaces/
│     └─ packages/
├─ frontend/                    # Vite/React UI
├─ docs/
├─ scripts/
└─ .codex/                     # AI 현재 상태와 누적 작업 기록
```

`ros2_ws/build`, `install`, `log`, `frontend/node_modules`, `frontend/dist`, `.runtime`은 생성물이다.
구 `backend/src`와 구 `topic/service/action/node` 패키지 구조를 다시 만들지 않는다.

## 현재 구현 상태

- 구조 분리 기준선은 Git 커밋 `9d18c14`~`405071e`에 반영되어 있다. ROS2 직접 접근은
  `ros2_dashboard_monitor`, 웹 API와 Runtime Cache는 `backend/app`, UI는 `frontend`가 담당한다.
- Monitor와 Backend는 같은 메모리를 공유하지 않고 localhost HTTP로 통신한다. Monitor는
  기본 `127.0.0.1:8765`, Backend 공개 API는 실행 인자 기준 기본 `127.0.0.1:8000`이다.
- Backend는 Monitor snapshot을 polling하고 공개 REST 및 `/ws/monitor` Browser WebSocket을
  제공한다. Backend 코드에서 `rclpy` Node를 만들지 않는다.
- Interface Lab의 등록, package upload, build/apply/import 확인과 Topic Publish/Receive,
  Service Call, Action Goal/Feedback/Result/Cancel 실행은 Monitor 영역에 있다.
- Frontend는 route lazy loading과 기능별 API/Interface Lab panel 분리가 적용되어 있다.
- Topic/Service/Action/Node 감시 폴더명은 각각 `ros2_topic`, `ros2_service`, `ros2_action`,
  `ros2_node`다.

## 주요 설계와 정책

- 공개 API 경로와 기존 JSON key를 호환 유지한다.
- ROS2 사실 수집은 rclpy Graph API를 사용하며 ROS2 CLI 출력을 데이터 원천으로 파싱하지 않는다.
- Monitor 설정과 변경 가능한 Interface 데이터는 monitor package의 source config에 보존하고,
  사용자 별표는 `backend/config/user_preferences.yaml`에 보존한다.
- 배포값은 중앙 Settings/Config Loader와 `.env`/YAML에서 읽는다. 프로토콜 상수와 API key 같은
  불변값만 코드에 둔다.
- 자동 감시와 사용자가 명시적으로 요청하는 Publish/Call/Goal은 별도 실행 경로로 유지한다.
- Service timeout이나 server unavailable을 QoS 불일치로 단정하지 않는다.
- Git commit/push는 사용자가 명시적으로 요청할 때만 수행한다.

## 현재 작업 중인 내용

작업 트리는 clean하지 않다. 기존 변경을 reset하거나 일괄 덮어쓰지 말고 `git status`와
staged/unstaged diff를 먼저 확인해야 한다.

- QoS 확장 변경이 staged와 unstaged 상태로 섞여 있다. 공통 `qos.py`, Topic endpoint 비교와
  자동 선택, Service 기본 QoS 상태, Action의 Goal/Result/Cancel/Feedback/Status별 QoS,
  Interface Lab 적용, 상세 UI와 테스트가 포함된다.
- 새 `QosDetails.jsx`, `test_qos.py`, `start.md`는 현재 untracked다.
- `config.md`, `docs/qos/dds_qos.md`에도 미커밋 변경이 있다. 소유권과 의도를 확인하지 않고
  되돌리거나 포함 범위를 넓히지 않는다.
- 위 QoS 구현은 마지막 검수에서 동작했지만 아직 현재 Git 기준선에 커밋되지 않았다.

## 마지막 확인된 검증 상태

2026-08-07 QoS 작업까지 포함한 마지막 검수 기록:

```text
ROS2 Monitor tests: 119 passed, 0 failures/errors/skips
Backend tests: 6 passed
colcon list/build: 5 packages 탐색 및 build 성공
Frontend lint/build/SSR import: 성공
Frontend 초기 bundle: 약 210 KB, 500 KB 경고 없음
실제 BEST_EFFORT LaserScan: endpoint QoS 자동 적용 후 수신 성공
실제 AddTwoInts Service: 7 + 5 = 12 응답 성공
실제 Action: goal/feedback/result 및 cancel accepted/canceled 확인
```

이 수치는 이후 변경 후 자동으로 유효하지 않다. 관련 코드를 수정하면 영향 범위 검수를 다시 한다.

## 남은 문제와 제한사항

- QoS 변경의 최종 diff 검토와 사용자 요청에 따른 커밋 분리가 남아 있다.
- Jazzy 일반 Service Graph는 상대 Service endpoint QoS를 직접 제공하지 않으므로 Service는
  `qos_profile_services_default`를 사용하며 상대 QoS 판정은 `unknown/default_profile`일 수 있다.
- QoS 불일치를 영속 Alert 이력과 완전히 연결하는 작업은 남아 있다.
- WSS 운영 배포 검증, MariaDB Alert 영속 저장, Camera Topic 이미지 시각화,
  Gazebo TurtleBot 명령 preset은 확정된 향후 요구사항이지만 아직 완료되지 않았다.
- demo outcome server 종료 시 `rcl_shutdown already called` 중복 shutdown traceback이 관찰됐다.
  실행 기능과 별개지만 demo node cleanup 개선이 필요하다.
- `AGENTS.md` 하단에는 리팩토링 전 역사 기록이 남아 있다. 현재 경로/책임은 0절을 우선한다.

## 다음 작업 방향

1. 먼저 현재 staged/unstaged/untracked QoS diff를 보존한 채 범위를 재확인한다.
2. QoS 관련 정적 검사, ROS2 119 tests, Backend tests, Frontend lint/build를 변경 후 다시 실행한다.
3. 사용자 승인 시에만 QoS 변경과 문서 변경을 의도별 commit으로 정리한다.
4. 다음 기능 리팩토링은 Interface Lab controller/model/view 잔여 책임과 큰 ROS runtime의
   client pool/history/assembler 경계를 우선 조사한다.
5. 신규 기능은 WSS와 MariaDB Alert 이력 설계를 우선하며, 미구현 항목을 현재 기능으로
   보고하지 않는다.
