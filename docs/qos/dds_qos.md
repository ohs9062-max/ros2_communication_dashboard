# ROS2 Dashboard DDS / QoS 구성

이 문서는 현재 `ros2_dashboard` 코드와 실행 환경을 기준으로 DDS/RMW 선택 방식과
Topic, Service, Action, Interface Lab에 실제 적용되는 QoS를 정리한다.

## 1. 현재 DDS / RMW 구성

프로젝트는 특정 DDS 구현을 코드나 `package.xml`에서 강제로 선택하지 않는다.
`rclpy`가 실행될 때 ROS2 환경에서 선택된 RMW 구현을 그대로 사용한다.

현재 확인된 실행 환경은 다음과 같다.

| 항목 | 현재 값 |
|---|---|
| ROS2 | Jazzy |
| `RMW_IMPLEMENTATION` | 미설정 |
| 실제 선택된 RMW | `rmw_fastrtps_cpp` |
| 실제 DDS | Fast DDS |
| `ROS_DOMAIN_ID` | `99` |
| `ROS_LOCALHOST_ONLY` | `0` |
| `ROS_AUTOMATIC_DISCOVERY_RANGE` | `SUBNET` |

현재 통신 계층은 다음과 같다.

```text
ROS2 Dashboard Backend
→ rclpy
→ rmw_fastrtps_cpp
→ Fast DDS
→ ROS2 기기
```

현재 저장소에는 다음 DDS 전용 설정 파일이나 정책이 없다.

- Fast DDS XML profile
- Cyclone DDS XML profile
- DDS NIC allowlist
- Discovery Server 설정
- Static peer 설정
- DDS transport 설정
- DDS 보안 설정

따라서 DDS discovery와 데이터 전송은 시스템에 설치된 ROS2/Fast DDS 기본 설정과
Backend 프로세스를 실행한 셸의 환경변수에 의존한다.

확인 명령:

```bash
printenv RMW_IMPLEMENTATION
printenv ROS_DOMAIN_ID
printenv ROS_LOCALHOST_ONLY
printenv ROS_AUTOMATIC_DISCOVERY_RANGE
ros2 doctor --report
```

## 2. QoS 용어

| 정책 | 의미 |
|---|---|
| `RELIABLE` | DDS가 메시지 전달을 보장하기 위해 재전송을 수행한다. |
| `BEST_EFFORT` | 일부 손실을 허용하고 최신 데이터 전달을 우선한다. |
| `VOLATILE` | 구독을 시작한 이후 발행된 메시지만 받는다. |
| `TRANSIENT_LOCAL` | Publisher가 보관한 이전 메시지를 늦게 연결된 Subscriber에도 제공할 수 있다. |
| `KEEP_LAST` | 지정된 depth만큼 최근 메시지를 보관한다. |
| `depth` | `KEEP_LAST`에서 보관할 메시지 개수다. |

QoS 호환성에서 특히 주의할 조합은 다음과 같다.

```text
Publisher BEST_EFFORT → Subscriber RELIABLE
= 호환되지 않아 수신하지 못할 수 있음

Publisher RELIABLE → Subscriber BEST_EFFORT
= 일반적으로 호환됨

Publisher VOLATILE → Subscriber TRANSIENT_LOCAL
= Subscriber 요구를 충족하지 못할 수 있음
```

## 3. 전체 QoS 요약

| 기능 | Reliability | Durability | History / Depth | 선택 방식 |
|---|---|---|---|---|
| 일반 Topic 자동 감시 | Publisher QoS 또는 fallback | Publisher QoS 또는 fallback | `KEEP_LAST / 10` | Graph Publisher QoS 일부 추적 |
| 센서 Topic fallback | `BEST_EFFORT` | `VOLATILE` | `KEEP_LAST / 5` | Publisher 정보를 읽지 못했을 때 |
| 일반/custom Topic fallback | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` | Publisher 정보를 읽지 못했을 때 |
| Interface Lab Topic Publish | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` | 고정 |
| Interface Lab Topic Receive | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` | 고정 |
| Interface Lab Service Call | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` | rclpy Service 기본값 |
| Interface Lab Action Goal/Result/Cancel | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` | rclpy ActionClient 기본값 |
| Interface Lab Action Feedback | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` | rclpy ActionClient 기본값 |
| Interface Lab Action Status | `RELIABLE` | `TRANSIENT_LOCAL` | `KEEP_LAST / 1` | rclpy ActionClient 기본값 |
| Dashboard Action Status 자동 관찰 | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` | 코드에서 명시 |
| Dashboard Action Feedback 자동 관찰 | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` | 코드에서 명시 |

### 전체 통신별 QoS 종합표

Topic, Service, Action의 실제 통신 채널을 한 번에 비교하면 다음과 같다.

| 구분 | 통신 | Reliability | Durability | Depth | 비고 |
|---|---|---|---|---:|---|
| Topic 자동 감시 | 현재 Publisher가 있는 Topic | Publisher 값 | Publisher 값 | 10 | Graph에서 첫 번째 Publisher Endpoint의 Reliability와 Durability를 반영 |
| Topic 자동 감시 | LaserScan·Imu·JointState fallback | `BEST_EFFORT` | `VOLATILE` | 5 | Publisher QoS를 읽지 못했을 때 적용 |
| Topic 자동 감시 | 일반/custom Topic fallback | `RELIABLE` | `VOLATILE` | 10 | Publisher QoS를 읽지 못했을 때 적용 |
| Interface Lab Topic | Publish | `RELIABLE` | `VOLATILE` | 10 | 상대 Subscriber QoS를 따라가지 않음 |
| Interface Lab Topic | Receive | `RELIABLE` | `VOLATILE` | 10 | `BEST_EFFORT` Publisher와 비호환 가능 |
| Service | Interface Lab Service Call Request/Response | `RELIABLE` | `VOLATILE` | 10 | rclpy 기본 Service QoS |
| Service | Background Active Check Request/Response | `RELIABLE` | `VOLATILE` | 10 | 기능 활성화 및 allowlist 등록 시에만 사용 |
| Action Client | Goal Service | `RELIABLE` | `VOLATILE` | 10 | rclpy ActionClient 기본값 |
| Action Client | Result Service | `RELIABLE` | `VOLATILE` | 10 | rclpy ActionClient 기본값 |
| Action Client | Cancel Service | `RELIABLE` | `VOLATILE` | 10 | 현재 Dashboard UI에서는 cancel을 제공하지 않지만 ActionClient 내부 QoS에는 존재 |
| Action Client | Feedback Topic | `RELIABLE` | `VOLATILE` | 10 | rclpy ActionClient 기본값 |
| Action Client | Status Topic | `RELIABLE` | `TRANSIENT_LOCAL` | 1 | rclpy ActionClient 기본값 |
| Action 자동 관찰 | Feedback Topic | `RELIABLE` | `VOLATILE` | 10 | Dashboard ActionRuntime이 별도로 구독 |
| Action 자동 관찰 | Status Topic | `RELIABLE` | `VOLATILE` | 10 | 기본 Action Status QoS와 Durability·Depth가 다름 |

공통 History 정책은 위 모든 명시값에서 `KEEP_LAST`다. Topic 자동 감시에서
Publisher QoS를 따라가는 경우에도 현재 코드는 History와 Depth를 복사하지 않고
`KEEP_LAST / 10`을 사용한다.

## 4. 일반 Topic 자동 감시

구현 위치:

```text
backend/src/ros2_dashboard_backend/ros2_dashboard_backend/topic/runtime.py
```

Dashboard가 Topic을 자동 감시할 때 현재 Graph의 Publisher Endpoint 정보를 읽는다.
Publisher QoS를 확인할 수 있으면 다음 값을 구독 QoS에 반영한다.

- Reliability
- Durability

이 경우에도 depth는 10으로 생성한다.

```text
Reliability: Graph Publisher 값
Durability: Graph Publisher 값
History: KEEP_LAST
Depth: 10
```

Publisher QoS가 `UNKNOWN`이면 다음 값으로 보정한다.

```text
Reliability: RELIABLE
Durability: VOLATILE
```

### 센서 Topic fallback

Publisher Endpoint QoS를 읽지 못하고 다음 타입에 해당하면
`qos_profile_sensor_data`를 사용한다.

```text
sensor_msgs/msg/LaserScan
sensor_msgs/msg/Imu
sensor_msgs/msg/JointState
```

적용값:

```text
Reliability: BEST_EFFORT
Durability: VOLATILE
History: KEEP_LAST
Depth: 5
```

`nav_msgs/msg/Odometry`는 현재 센서 fallback 집합에 포함되지 않는다.
Publisher 정보를 읽지 못한 Odometry는 일반 기본 QoS를 사용한다.

### 일반/custom Topic fallback

센서 fallback 대상이 아니면 다음 값을 사용한다.

```text
Reliability: RELIABLE
Durability: VOLATILE
History: KEEP_LAST
Depth: 10
```

### 제한 사항

- 여러 Publisher가 서로 다른 QoS를 사용하면 첫 번째 Endpoint의 QoS만 반영한다.
- Reliability와 Durability만 Publisher에서 가져온다.
- Deadline, lifespan, liveliness 등은 복사하지 않는다.
- Graph Publisher가 아직 없으면 타입별 fallback을 사용한다.

## 5. Interface Lab Topic Publish / Receive

구현 위치:

```text
backend/src/ros2_dashboard_backend/ros2_dashboard_backend/interface_lab/execution/topic_runtime.py
```

Interface Lab의 Publish와 Receive는 모두 `_default_qos()`가 반환하는 정수 `10`을
`create_publisher()` 또는 `create_subscription()`에 전달한다.

rclpy에서 정수 depth 10은 다음 기본 QoS로 생성된다.

```text
Reliability: RELIABLE
Durability: VOLATILE
History: KEEP_LAST
Depth: 10
```

### Topic Publish

```text
Dashboard Interface Lab Publisher
→ RELIABLE + VOLATILE + KEEP_LAST 10
→ 기기 Subscriber
```

상대 Subscriber의 실제 QoS를 읽어서 조정하지 않는다.

### Topic Receive

```text
기기 Publisher
→ Dashboard Interface Lab Subscriber
→ RELIABLE + VOLATILE + KEEP_LAST 10
```

기기 Publisher가 `BEST_EFFORT`이면 Dashboard Subscriber의 `RELIABLE` 요구를
만족하지 못해 Graph에 Topic이 보여도 메시지를 수신하지 못할 수 있다.

### UI QoS 정보 주의사항

`_qos_info()`는 `sensor_msgs/msg/*` 타입에 `sensor_data_hint`를 표시하지만,
실제 `_default_qos()`는 타입과 관계없이 정수 10을 반환한다.

따라서 현재의 `sensor_data_hint`는 안내용 메타데이터이며 실제로
`BEST_EFFORT` Sensor Data QoS가 적용됐다는 의미가 아니다.

## 6. Service QoS

Interface Lab Service Call 구현 위치:

```text
backend/src/ros2_dashboard_backend/ros2_dashboard_backend/interface_lab/execution/service_call_runtime.py
```

Service Client는 QoS 인자 없이 생성한다.

```python
node.create_client(service_class, service_name)
```

따라서 rclpy 기본 Service QoS를 사용한다.

```text
Reliability: RELIABLE
Durability: VOLATILE
History: KEEP_LAST
Depth: 10
```

Background Active Check Client도 별도 QoS를 지정하지 않으므로 같은 기본값을 사용한다.

Service가 Graph에 있고 타입도 정확하지만 호출이 Timeout이면 다음을 확인한다.

1. 기기 Service callback 진입 여부
2. callback 내부 예외 여부
3. Response 반환 여부
4. Dashboard와 기기의 RMW/DDS 종류
5. DDS가 선택한 NIC와 광고 locator
6. 요청·응답 UDP 방화벽

## 7. Action QoS

Interface Lab Action Goal 구현 위치:

```text
backend/src/ros2_dashboard_backend/ros2_dashboard_backend/interface_lab/execution/action_goal_runtime.py
```

Action Client도 QoS 인자 없이 생성한다.

```python
ActionClient(node, action_class, action_name)
```

rclpy 기본 ActionClient QoS는 다음과 같다.

| 내부 통신 | Reliability | Durability | History / Depth |
|---|---|---|---|
| Goal Service | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` |
| Result Service | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` |
| Cancel Service | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` |
| Feedback Topic | `RELIABLE` | `VOLATILE` | `KEEP_LAST / 10` |
| Status Topic | `RELIABLE` | `TRANSIENT_LOCAL` | `KEEP_LAST / 1` |

기기에서 ROS2 기본 `ActionServer`를 사용한다면 일반적으로 이 QoS와 호환된다.

## 8. Action 상태 / Feedback 자동 관찰

구현 위치:

```text
backend/src/ros2_dashboard_backend/ros2_dashboard_backend/action/runtime.py
```

Dashboard는 Interface Lab ActionClient와 별개로 다음 내부 Topic을 자동 관찰한다.

```text
<action_name>/_action/status
<action_name>/_action/feedback
```

두 구독 모두 `QoSProfile(depth=10)`을 명시한다.

```text
Reliability: RELIABLE
Durability: VOLATILE
History: KEEP_LAST
Depth: 10
```

ROS2 기본 Action Status QoS는 `TRANSIENT_LOCAL / depth 1`이지만 Dashboard의
자동 Status 관찰은 `VOLATILE / depth 10`이다. 일반적인 연결은 가능하지만
Dashboard가 늦게 구독하면 이미 발행된 마지막 Status를 즉시 받지 못하고
다음 Status 발행을 기다릴 수 있다.

## 9. 통신 장애 판단 기준

### Topic 자동 감시는 되지만 Interface Lab Receive가 안 되는 경우

가장 먼저 기기 Publisher가 `BEST_EFFORT`인지 확인한다.

```bash
ros2 topic info /topic_name --verbose
```

현재 Interface Lab Receive는 `RELIABLE`이므로 `BEST_EFFORT` Publisher와
호환되지 않을 수 있다.

### Interface Lab Publish가 기기에 들어가지 않는 경우

다음을 확인한다.

- 기기 Subscriber의 실제 QoS
- Topic 이름과 full type exact match
- 기기 callback 진입 여부
- 기기가 `TRANSIENT_LOCAL`을 요구하는지
- DDS 데이터 전송 경로와 방화벽

### Service와 Action이 모두 Timeout인 경우

Topic QoS 하나보다 다음 항목을 우선 확인한다.

```text
Dashboard와 기기의 RMW_IMPLEMENTATION
DDS 종류와 버전
DDS가 선택한 네트워크 인터페이스
DDS가 상대에게 광고한 IP locator
UDP 방화벽
기기 Service/Action callback 진입 여부
```

같은 환경의 ROS2 CLI로 직접 호출하면 Dashboard 문제와 DDS/기기 문제를 구분할 수 있다.

```bash
ros2 service call /service_name package_name/srv/TypeName "{field: value}"
ros2 action send_goal /action_name package_name/action/TypeName "{field: value}" --feedback
```

판단 기준:

```text
CLI도 실패
→ DDS 네트워크, RMW 호환 또는 기기 서버 문제

CLI는 성공하고 Dashboard만 실패
→ Dashboard payload, timeout 또는 Runtime 경로 문제

기기 callback 진입 전 실패
→ DDS 요청 전달 경로 문제

기기 callback 진입 후 Timeout
→ 기기 응답 처리 또는 DDS 응답 경로 문제
```

## 10. 현재 구조에서 주의할 핵심 사항

1. 프로젝트는 DDS 구현을 고정하지 않으며 Backend 실행 환경의 RMW를 사용한다.
2. 현재 환경에서는 `rmw_fastrtps_cpp`, 즉 Fast DDS가 선택됐다.
3. 일반 Topic 자동 감시는 Publisher의 Reliability와 Durability를 일부 따라간다.
4. Interface Lab Topic Publish/Receive는 상대 QoS와 관계없이 RELIABLE/VOLATILE/depth 10이다.
5. Service와 Action은 rclpy 기본 QoS를 사용한다.
6. Service와 Action이 모두 실패하면 Topic QoS보다 DDS 데이터 경로와 기기 callback을 먼저 확인한다.
7. Interface Lab Topic Receive 실패는 BEST_EFFORT Publisher와의 QoS 불일치 가능성이 크다.
