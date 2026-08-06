# ROS2 Communication Monitor Dashboard

ROS2 Graph와 통신 상태를 수집하는 독립 Monitor, FastAPI 웹 Backend, React Frontend로 구성됩니다.

## Build and run

```bash
cd ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 run ros2_dashboard_monitor monitor
```

다른 터미널에서:

```bash
cd backend
python3 -m uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

전체 stack은 `scripts/run_dashboard_stack.sh`, 종료는
`scripts/stop_dashboard_stack.sh`를 사용합니다.

Monitor와 Backend의 내부 통신 규격은
[`docs/architecture/monitor_backend_transport.md`](docs/architecture/monitor_backend_transport.md)에 있습니다.
