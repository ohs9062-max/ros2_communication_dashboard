# 현재 프로세스 책임 경계

프로젝트는 ROS2 실행과 Web/DB 책임을 프로세스 단위로 분리한다.

## ROS2 Monitor

- rclpy Node와 spin lifecycle
- ROS2 Graph 및 endpoint discovery
- Topic latest/Hz/age와 missing/stale/disconnected
- Service, Action, Node 상태와 연결 관계
- QoS 관찰·비교와 Interface Lab entity 생성
- Alert 후보와 localhost transport snapshot

## Fast DDS observer

- Service와 Action Goal/Result/Cancel의 원격 DDS endpoint discovery
- Request Reader와 Response Writer QoS 제공
- 사용자 데이터 entity, Client 또는 요청을 생성하지 않음

## FastAPI Backend

- Monitor snapshot polling과 마지막 정상 cache
- Browser REST 및 `/ws/monitor`
- Interface Lab/Camera 요청의 Monitor proxy
- Alert active/resolved 전이와 MariaDB 저장·조회
- 사용자 주요 리소스 설정 보존·동기화
- DB 장애 시 Alert 메모리 fallback과 주기적 재연결

Backend는 `rclpy`를 import하거나 ROS2 Node를 만들지 않는다. Router는 SQL, YAML 처리 또는 ROS2 실행을 직접
수행하지 않는다.

## React Frontend

- Backend REST/WebSocket만 사용
- 목록의 빠른 상태 판단과 선택 상세의 원인 분석
- 사용자 명시 Interface Lab 실행과 결과 표시

Frontend는 Monitor, observer, ROS2 또는 MariaDB에 직접 접근하지 않는다.

## 데이터 흐름

```text
ROS2 Graph / Fast DDS discovery
  → Monitor snapshot
  → Backend cache, Alert lifecycle
  → REST / WebSocket
  → Frontend
```

MariaDB는 snapshot transport가 아니며 Alert 이력만 저장한다. 생성물은 `ros2_ws/build`, `install`, `log`,
`frontend/dist`, `node_modules`, `.runtime`이고 소스처럼 수정하지 않는다.

## 제품 실행 경계

- `scripts/install.sh`: dependency, build, DB schema 검증, systemd, Nginx/TLS 설치
- `ros2-dashboard-monitor.service`: Monitor와 자식 Fast DDS observer
- `ros2-dashboard-backend.service`: 순수 FastAPI Backend
- `ros2-dashboard.target`: Monitor/Backend 수명주기와 공용 MariaDB/Nginx dependency
- Nginx: `/var/lib/ros2-dashboard/frontend` 정적 제공과 Backend REST/WSS proxy

`stop.sh`는 Dashboard 전용 두 service만 중지하며 MariaDB와 Nginx는 유지한다. 제품 systemd 경로와 Vite 개발
스택은 같은 포트를 공유하므로 동시에 실행하지 않는다.
