
## Server
 python3 -m uvicorn ros2_dashboard_backend.main:app --host 127.0.0.1 --port 8000 --reload

 uvicorn ros2_dashboard_backend.main:app --reload
 npm run dev

## GAzebo
  source /opt/ros/jazzy/setup.bash
  export TURTLEBOT3_MODEL=burger
  ros2 launch turtlebot3_gazebo \
    turtlebot3_world.launch.py
    
 ros2 run turtlebot3_teleop teleop_keyboard

##  Nav2
 source /opt/ros/jazzy/setup.bash
 export TURTLEBOT3_MODEL=burger
 ros2 launch turtlebot3_navigation2 \
 navigation2.launch.py \
 use_sim_time:=True

## venv
cd ~/rang/ros2_dashboard/backend
source /opt/ros/jazzy/setup.bash
source .venv/bin/activate
source install/setup.bash

python3 -m uvicorn ros2_dashboard_backend.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload

## test service server
ros2 run demo_nodes_cpp add_two_ints_server
ros2 service call /add_two_ints example_interfaces/srv/AddTwoInts "{a: 2, b: 3}"

## build
cd ~/rang/ros2_dashboard/backend
source /opt/ros/jazzy/setup.bash
source .venv/bin/activate
colcon build --symlink-install
source install/setup.bash

deactivate

## tmux
./scripts/run_dashboard_stack.sh
tmux kill-session -t ros2_dashboard

## schedule srv
[
  {
    "scheduling_id": 0,
    "scheduling_dt": "2026-07-24T10:00:00",
    "count": 1,
    "is_active": true
  }
]

## test
cd /home/hs/rang/ros2_dashboard/backend
source /opt/ros/jazzy/setup.bash
source install/setup.bash

python3 demo_nodes/demo_robot_control_outcome_server.py

python3 demo_nodes/demo_robot_control_outcome_client.py failure
python3 demo_nodes/demo_robot_control_outcome_client.py timeout --timeout-sec 1.0


python3 demo_nodes/demo_can_control_outcome_server.py

python3 demo_nodes/demo_can_control_outcome_client.py failure
python3 demo_nodes/demo_can_control_outcome_client.py cancel

python3 demo_robot_control_failure_client.py
python3 demo_robot_control_timeout_client.py
python3 demo_can_control_failure_client.py
python3 demo_can_control_cancel_client.py