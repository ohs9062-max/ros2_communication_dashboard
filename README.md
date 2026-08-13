# ROS2 Communication Monitor Dashboard

단일 ROS2 기기의 Node, Topic, Service, Action 통신 상태와 장애 원인을 확인하는 사내 진단 도구다.

## 구성

```text
ROS2 Graph / user data
  → ROS2 Monitor (127.0.0.1:8765)
  → FastAPI Backend (127.0.0.1:8000)
  → React Frontend (127.0.0.1:5173)

Fast DDS passive observer (선택, 127.0.0.1:8766)
  → Service/Action Service 채널 QoS discovery
```

- Monitor: ROS2 Graph, latest/Hz/age, 상태·QoS 판정, Interface Lab 실행
- Backend: Monitor cache, 공개 REST/WebSocket, Alert lifecycle과 MariaDB
- Frontend: Overview와 리소스 목록·상세, Alert, Visualization, Interface Lab
- MariaDB: Alert 발생·해결 이력만 저장

## 주요 기능

- Topic missing/stale/disconnected, Service/Action/Node Graph 상태와 연결 관계
- Topic Graph QoS, Service/Action Fast DDS QoS, 실제 RMW incompatible 이벤트 구분
- 확정 QoS incompatible의 연속 확인과 채널별 Action QoS Alert
- `Image`/`CompressedImage` Camera Topic 요청형 Preview
- Interface Lab의 Topic Publish/Receive, Service Call, Action Goal/Feedback/Result/Cancel
- 사용자 주요 리소스, 현재/이전 Alert, DB 장애 시 메모리 fallback
- 개발 HTTP/WS와 Nginx 기반 로컬 HTTPS/WSS

## 실행

```bash
cd ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 launch ros2_dashboard_monitor dashboard_monitor.launch.py
```

다른 터미널에서:

```bash
cd backend
source .venv/bin/activate
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

준비된 환경에서는 `./scripts/run_dashboard_stack.sh`, 종료는 `./scripts/stop_dashboard_stack.sh`를 사용한다.
상세 실행 방법은 [`config.md`](config.md), 현재 상태는 [`.codex/CURRENT_STATUS.md`](.codex/CURRENT_STATUS.md)를
확인한다.

## 검증

```bash
cd ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
colcon test
colcon test-result --verbose

cd ../backend
.venv/bin/python -m pytest -q tests

cd ../frontend
npm run test:unit
npm run lint
npm run build
```

운영 정책과 책임 경계는 [`AGENTS.md`](AGENTS.md)를 source of truth로 사용한다.
