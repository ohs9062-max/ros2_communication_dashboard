```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
```

# ROS2 Monitor 실행

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 run ros2_dashboard_monitor monitor
```

# ROS2 Monitor Launch 실행

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch ros2_dashboard_monitor dashboard_monitor.launch.py
```

# Nginx 실행
cd ~/rang/ros2_dashboard
sudo ./scripts/install_local_https.sh
sudo systemctl start nginx
sudo systemctl is-enabled nginx
sudo systemctl status nginx

# Backend 실행

```bash
cd ~/rang/ros2_dashboard/backend
source .venv/bin/activate
python3 -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload
```

# Frontend 실행

```bash
cd ~/rang/ros2_dashboard/frontend
npm run dev
```

# 전체 Stack 실행

```bash
cd ~/rang/ros2_dashboard/frontend
npm run build

cd ~/rang/ros2_dashboard
sudo ./scripts/install_local_https.sh
./scripts/run_dashboard_stack.sh

curl -k https://localhost/health
sudo systemctl status nginx
```

# 전체 Stack 종료

```bash
cd ~/rang/ros2_dashboard
./scripts/stop_dashboard_stack.sh
```

# Demo Nodes 실행

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch ros2_dashboard_demo_nodes demo_communication.launch.py
/home/hs/rang/ros2_dashboard/ros2_ws
면 그 자리에서 rm -rf build install log 하면 돼.
ros2 run ros2_dashboard_demo_nodes cleaning_schedule
ros2 run ros2_dashboard_demo_nodes robot_control_service
ros2 run ros2_dashboard_demo_nodes schedule_crud_service
ros2 run ros2_dashboard_demo_nodes can_control_server
```

# Demo Action Outcome Server 실행

```bash
ros2 run ros2_dashboard_demo_nodes can_control_outcome_server
ros2 run ros2_dashboard_demo_nodes can_control_outcome_client
```

# Gazebo 실행

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch ros2_dashboard_demo_nodes turtlebot3_sim_nav.launch.py

export TURTLEBOT3_MODEL=burger
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
```

# TurtleBot3 키보드 제어

```bash
export TURTLEBOT3_MODEL=burger
ros2 run turtlebot3_teleop teleop_keyboard
```

# Nav2 실행

```bash
export TURTLEBOT3_MODEL=burger
ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True
```
## 가제보 카메라 실행

# 1. ROS2 환경
source /opt/ros/jazzy/setup.bash

# 2. 카메라 달린 Burger 모델 선택
export TURTLEBOT3_MODEL=burger_cam

# 3. Gazebo 실행
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py

# 4. Gazebo 카메라 Topic 확인
gz topic -l | grep -Ei 'camera|image'

# 5. ROS2 카메라 Topic 확인
ros2 topic list -t | grep camera

# 6. 실제 영상 수신 Hz 확인
ros2 topic hz /camera/image_raw

# 7. 카메라 영상 직접 확인
ros2 run rqt_image_view rqt_image_view
```

# DB
mariadb -u ohs -p ros2_dashboard

SELECT
    id,
    source,
    code,
    detected_at,
    resolved_at
FROM alert
ORDER BY id DESC;