
```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
```

# ROS2 Monitor 실행
ros2 run ros2_dashboard_monitor monitor

# ROS2 Monitor Launch 실행
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch ros2_dashboard_monitor dashboard_monitor.launch.py

# Backend 실행

cd ~/rang/ros2_dashboard/backend
source .venv/bin/activate
python3 -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload

# Frontend 실행

cd ~/rang/ros2_dashboard/frontend
npm run dev

# 전체 Stack 실행

cd ~/rang/ros2_dashboard
./scripts/run_dashboard_stack.sh

# 전체 Stack 종료

cd ~/rang/ros2_dashboard
./scripts/stop_dashboard_stack.sh

# Demo Nodes 실행

ros2 launch ros2_dashboard_demo_nodes demo_communication.launch.py

ros2 run ros2_dashboard_demo_nodes cleaning_schedule
ros2 run ros2_dashboard_demo_nodes robot_control_service
ros2 run ros2_dashboard_demo_nodes schedule_crud_service
ros2 run ros2_dashboard_demo_nodes can_control_server

# Demo Action Outcome Server 실행

ros2 run ros2_dashboard_demo_nodes can_control_outcome_server
ros2 run ros2_dashboard_demo_nodes can_control_outcome_client


ros2 run ros2_dashboard_demo_robot_control_outcome_server
ros2 run ros2_dashboard_demo_robot_control_outcome_client

ros2 run ros2_dashboard_demo_robot_control_timeout_client

# Gazebo 실행

ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py

# TurtleBot3 키보드 제어

ros2 run turtlebot3_teleop teleop_keyboard

# Nav2 실행

ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True
