# ROS2 Dashboard 쉬운 코드 길잡이

이 폴더는 기존 `docs/`를 대체하지 않는 학습용 문서다. 코드를 처음 읽을 때 전체 함수를 모두 읽지 않고, 실제 판단·계산·전달이 일어나는 줄부터 따라가도록 구성했다.

## 읽는 순서

1. [전체 흐름](01_overall_flow.md)
2. 관심 기능 하나 선택
   - [Topic](02_topic_flow.md)
   - [Service](03_service_flow.md)
   - [Action](04_action_flow.md)
   - [Node](05_node_flow.md)
   - [Alert](06_alert_flow.md)
   - [Interface Lab](07_interface_lab_flow.md)
3. 표의 `핵심 L`만 먼저 읽는다.
4. 이해가 안 되는 경우에만 `함수 전체 L`로 범위를 넓힌다.

## L 표기 읽는 법

```text
`service_call_runtime.py` 함수 전체 L85-L187
= `service_call_runtime.py`의 `call_service()` 함수 시작부터 끝

`service_call_runtime.py` 핵심 L128-L136
= `service_call_runtime.py`에서 실제 ROS2 요청 전송, 대기, 응답 변환을 하는 부분
```

라인 번호는 2026-07-30 현재 코드 기준이다. 코드가 수정되면 함수 이름을 먼저 검색하고 L 번호를 다시 맞춰야 한다.

## 가장 먼저 알아둘 용어

| 코드 용어 | 쉬운 뜻 |
|---|---|
| Graph | 현재 ROS2에서 누가 어떤 통신을 개설했는지 보여주는 목록 |
| Topology | ROS2 통신 관계도; `Node–리소스–타입–역할`의 연결 |
| Node | Topic·Service·Action 통신을 만드는 실행 프로그램 단위 |
| Resource | Topic, Service, Action 같은 통신 대상 |
| Runtime | 실행 중 Graph를 읽거나 통신하고 결과를 메모리에 저장하는 담당 객체 |
| Cache | 최근 수집 결과를 잠시 보관하는 메모리 저장소 |
| Snapshot | Cache를 특정 시점에 복사해 API 응답용으로 만든 값 |
| Endpoint | Publisher·Subscriber·Service Server 같은 실제 DDS 통신 끝점 하나 |
| Node 관계 수 | endpoint 수가 아니라 해당 역할을 가진 고유 Node 수; Topic·Service·Action 기본 화면의 `(Dashboard 제외)` 값은 내부 Dashboard Node를 뺀 수 |
| Router | HTTP 요청을 받고 실제 담당 Runtime으로 연결하는 입구 |
| Coordinator | `RosMonitor`; 여러 Runtime을 조립하고 결과를 합치는 중간 관리자 |
| Registry | Interface Lab에 등록된 msg/srv/action 타입 목록 |
| Activity | 실제 Publish·Receive·Call·Goal 실행 이력; Dashboard 내부 Node를 기본 관계 집계에서 제외해도 Interface Lab에 유지되는 값 |

## 변수·함수 이름을 읽는 법

| 코드 이름 형태 | 읽는 방법 |
|---|---|
| `update()` | ROS2 Graph를 다시 읽어 Runtime Cache를 갱신 |
| `snapshot()` | 현재 Cache를 복사해 외부에 반환 |
| `*_count` | 무엇의 개수인지 앞 단어까지 함께 확인; Node 수와 endpoint 수를 혼동하지 않기 |
| `*_runtime` | 해당 기능의 실행 중 상태와 Cache를 관리하는 객체 |
| `graph_present` | 이번 Graph 조회에도 현재 존재하는지 |
| `full_type` / `topic_type` | `package/msg/Type` 형태의 전체 ROS2 타입 |
| `entry` / `item` | 목록 또는 Registry에서 꺼낸 항목 하나 |
| `allowed` / `allowlisted` | 등록·import·타입 일치 등 정해진 조건을 통과했는지 |
| `*_preview` | 원본 ROS 객체를 화면에서 볼 수 있는 JSON 값으로 줄이거나 변환한 결과 |
| `_함수명()` | 같은 클래스나 모듈 안에서만 쓰려는 내부 보조 함수 |

함수 이름을 먼저 찾은 뒤 `함수 전체 L`로 경계를 확인하고, 실제 동작은 `핵심 L`부터 읽는다.

0. **토폴로지** : ROS2 네트워크의 전체 구조 (Node, Topic, Service, Action 관계도)
0. **lamda** : 익명 함수 lambda는 Python에서 이름 없이 짧게 만드는 함수야.
0. **rclpy**Python에서 ROS2를 사용하게 해주는 전체 라이브러리
0. **rclpy.node.Node** 객체가 제공하는 Graph 조회 메서드로 읽음
0. **lifespan** FastAPI 애플리케이션의 시작과 종료 생명주기를 관리하는 함수
0. **Cache** 최신 상태를 보관하는 저장소, **Snapshot** 그 Cache를 특정 시점에 읽어 만든 응답 데이터.
0. **Runtime** :프로그램이 실행 중일 때 실제로 동작하면서 ROS2 정보를 수집하고 상태를 계산해 Cache에 저장하는 담당 객체.
1. **Node**: Node 목록과 pub/sub/service/action 관계를 읽어 Node cache를 교체한다.
2. **Topic**: Topic 목록, 타입, publisher/subscriber 수를 읽고 필요한 subscription을 생성·제거한다.
3. **Service**: Service 이름/타입과 server/client 수를 읽는다.
4. **Action**: Action 이름/타입과 server/client 수를 읽고 status/feedback 관찰 subscription을 맞춘다.
5. **Alert**: 별도 timer 단계가 아니다. `/ros/alerts` 또는 WebSocket snapshot 요청 시 각 Runtime alert를 모아 lifecycle cache에 반영한다.
6. **WebSocket**: 연결마다 1초 간격으로 그 시점 cache의 경량 snapshot을 만든다.

## Qos
**Reliability** = 메시지를 반드시 전달할지 정하는 정책 = 센서 Topic 자동 감시는 일부 손실을 허용해 BEST_EFFORT, 일반/custom Topic·Interface Lab·Action 관찰은 전달 보장을 위해 RELIABLE을 사용합니다.

**Durability** = 늦게 들어온 구독자가 과거 메시지를 받을지 정하는 정책 = 현재 모든 명시적 Topic QoS는 과거 메시지를 보관하지 않는 VOLATILE을 사용합니다.

**History** = 메시지를 어떤 방식으로 보관할지 정하는 정책 = 현재 모두 최근 메시지만 저장하는 KEEP_LAST를 사용합니다.

**Depth** = KEEP_LAST일 때 최근 메시지를 몇 개 보관할지 정하는 값 = 센서 Topic 자동 감시는 5개, 일반/custom Topic·Interface Lab·Action 관찰은 10개를 보관합니다.

**Sensor Data QoS** = 손실보다 최신성이 중요한 센서 통신용 QoS = LaserScan·Imu·JointState·Odometry 자동 감시에 BEST_EFFORT + VOLATILE + KEEP_LAST 5를 적용합니다.

**기본 Depth 10 QoS** = 일반 메시지를 안정적으로 전달하기 위한 기본 QoS = 일반/custom Topic과 Action status·feedback 관찰에 RELIABLE + VOLATILE + KEEP_LAST 10을 적용합니다.

**Interface Lab QoS** = 사용자가 직접 Publish·Receive할 때 적용되는 QoS = 현재 타입과 관계없이 정수 10을 전달하므로 RELIABLE + VOLATILE + KEEP_LAST 10으로 생성됩니다.

**Service QoS** = 요청과 응답을 안정적으로 전달하기 위한 Service 기본 정책 = 별도 설정 없이 rclpy 기본 Service QoS를 사용하며 일반적으로 RELIABLE + VOLATILE + KEEP_LAST 10입니다.

**Action QoS** = Goal·Result·Cancel Service와 Feedback·Status Topic에 적용되는 정책 = ActionClient는 rclpy 기본값을 사용하고, 대시보드의 status·feedback 관찰 구독은 RELIABLE + VOLATILE + KEEP_LAST 10을 사용합니다.

**Deadline** = 정해진 시간 안에 메시지가 계속 도착해야 하는지 정하는 정책 = 현재 코드에서는 직접 설정하지 않습니다.

**Lifespan** = 발행된 메시지가 얼마 동안 유효한지 정하는 정책 = 현재 코드에서는 직접 설정하지 않습니다.

**Liveliness** = 발행자가 살아 있음을 어떤 방식으로 확인할지 정하는 정책 = 현재 코드에서는 수동 설정하지 않고 기본값을 사용합니다.

**TRANSIENT_LOCAL** = 늦게 들어온 구독자에게 이전 메시지를 전달하는 Durability 정책 = 현재 코드에서는 사용하지 않습니다.

**KEEP_ALL** = 수신한 메시지를 제한 없이 보관하는 History 정책 = 현재 코드에서는 사용하지 않습니다.
