# 완료된 개선 범위

이 문서의 초기 개선 요구는 현재 프로젝트 요구 범위에서 완료됐다. 새로운 미완료 로드맵으로 사용하지 않는다.

| 항목 | 현재 구현 |
|---|---|
| HTTPS/WSS | Nginx에서 TLS를 종료하고 HTTPS 화면은 Backend `/ws/monitor`에 WSS로 연결한다. 개발 HTTP에서는 WS를 사용한다. |
| 책임 분리 | ROS2 실행은 Monitor, REST·WebSocket·Alert DB는 FastAPI Backend, 표시는 React Frontend가 담당한다. |
| Alert 정책 | Topic, Service, Action, Node, QoS Alert의 발생·제외·해제 조건과 사용자 메시지를 문서화했다. |
| MariaDB Alert | 현재/해결 Alert, 중복 방지, 해결 후 재발, KST 시각, DB 장애 fallback을 구현했다. |
| QoS 진단 | Topic Graph QoS, Service/Action Fast DDS discovery, Auto/Manual QoS, 실제 RMW incompatible 이벤트를 구분한다. |
| Camera Topic | `Image`와 `CompressedImage`를 기존 Topic 감시 흐름으로 구독하고 상세 화면에서 요청형 Preview를 제공한다. |
| Interface Lab | Topic Publish/Receive, Service Call, Action Goal/Feedback/Result/Cancel과 실행 이력을 제공한다. |
| TurtleBot3 검증 | 외부 Gazebo Burger의 `/cmd_vel` `TwistStamped`에 전진·회전·정지 명령을 보내 실제 이동을 검증했다. |

## 현재 범위에서 제외한 항목

- Alert acknowledgement, occurrence count, JSON detail 컬럼
- Dashboard의 Gazebo process 관리 또는 TurtleBot3 전용 제어 UI
- 물리 카메라를 ROS2 Topic으로 변환하는 camera driver
- RViz2 전체 기능을 Browser에 복제하는 기능
- 다중 기기 관제와 인터넷 공개 배포 기능

현재 작업 우선순위와 검증 상태는 `.codex/CURRENT_STATUS.md`, 작업 기준은 `AGENTS.md`를 따른다.
