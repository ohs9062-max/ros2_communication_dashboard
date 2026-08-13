# TurtleBot3 Gazebo Topic Publish 검증

## 목적

Gazebo는 Dashboard 밖의 터미널에서 실행하고, Interface Lab의 범용 Topic Publish로
TurtleBot3 Burger에 실제 속도 명령이 전달되는지 검증한다. Dashboard에 Gazebo 관리나
TurtleBot3 전용 실행 로직을 추가하지 않는다.

## 현재 Jazzy 환경의 실제 통신

2026-08-13 로컬 설치 환경에서 ROS2 Graph와 `/ros_gz_bridge` Node를 확인한 결과다.

```text
Topic        /cmd_vel
Type         geometry_msgs/msg/TwistStamped
Subscriber   /ros_gz_bridge
Reliability  RELIABLE
Durability   VOLATILE
```

`geometry_msgs/msg/Twist`가 아니므로 payload의 최상위에 `twist`가 필요하다. `header`를
생략하면 Interface Lab의 Message converter가 기본 header를 사용한다.

## Gazebo 실행

별도 터미널에서 실행한다.

```bash
source /opt/ros/jazzy/setup.bash
source ros2_ws/install/setup.bash
export TURTLEBOT3_MODEL=burger
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
```

현재 launch는 remap 없이 `/cmd_vel` `geometry_msgs/msg/TwistStamped`를 Gazebo의
`gz.msgs.Twist`로 bridge한다. 실행 후 다음으로 재확인할 수 있다.

```bash
ros2 topic list -t
ros2 topic info /cmd_vel -v
ros2 node info /ros_gz_bridge
```

## Interface Lab 준비

1. `Interface Lab > Interface 관리 > 타입 직접 등록`을 연다.
2. `기존 빌드 타입 등록`에 `geometry_msgs/msg/TwistStamped`를 입력한다.
3. 타입을 등록한다. 이 경로는 `.msg` 생성, Package upload, colcon build가 필요 없다.
4. `Topic 실행`에서 타입을 선택하고 Graph 후보 `/cmd_vel`을 선택한다.
5. QoS는 `Auto`를 우선 사용한다. 현재 Graph의 RELIABLE/VOLATILE 구독자와 호환됨을
   확인했다.

`turtlebot3_teleop`, Nav2 controller 등 다른 Publisher가 동시에 `/cmd_vel`을 보내면 명령이
서로 덮어쓰여 검증 결과가 섞일 수 있다. 검증 중에는 다른 속도 명령 Publisher를 정지한다.

## Payload

### 전진

```json
{
  "twist": {
    "linear": {"x": 0.2, "y": 0.0, "z": 0.0},
    "angular": {"x": 0.0, "y": 0.0, "z": 0.0}
  }
}
```

### 회전

```json
{
  "twist": {
    "linear": {"x": 0.0, "y": 0.0, "z": 0.0},
    "angular": {"x": 0.0, "y": 0.0, "z": 0.5}
  }
}
```

### 정지

```json
{
  "twist": {
    "linear": {"x": 0.0, "y": 0.0, "z": 0.0},
    "angular": {"x": 0.0, "y": 0.0, "z": 0.0}
  }
}
```

## 검증 순서

1. 정지 payload를 먼저 1회 Publish한다.
2. 전진 payload를 Publish하고 Burger의 이동과 `/odom` position 변화를 확인한다.
3. 정지 payload를 Publish한다.
4. 회전 payload를 Publish하고 Burger의 회전과 `/odom` orientation 변화를 확인한다.
5. 반드시 정지 payload를 다시 Publish한다.
6. `/odom` 속도가 linear/angular 모두 0인지 확인한다.
7. Dashboard Topic 목록에서 `/cmd_vel`의 마지막 값, 마지막 수신, QoS와 Interface Lab
   Publisher 생성 상태를 확인한다.

단발 Publish 후 bridge/controller가 마지막 속도를 유지할 수 있으므로, 정지 payload는 선택이
아니라 필수 절차다.
