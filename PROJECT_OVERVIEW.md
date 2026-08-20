# ROS2 Dashboard 프로젝트 총괄

이 문서는 ROS2 Dashboard의 목적과 핵심 개념, 구성요소, 데이터 흐름, 상태 판단, QoS, Alert,
Interface Lab과 운영 구조를 한 번에 이해하기 위한 총괄 문서다. 세부 파일과 함수의 목록보다는
프로젝트가 실제로 어떤 사실을 수집하고, 어떻게 판단하며, 사용자에게 무엇을 보여주는지를 중심으로 설명한다.

현재 구현이 문서보다 우선한다. 과거 작업 기록과 발표 자료는 설계 배경을 이해하는 참고 자료일 뿐,
현재 동작의 기준은 실제 코드와 설정이다.

## 1. 프로젝트 한눈에 보기

### 목적

ROS2 Dashboard는 단일 ROS2 기기의 Node, Topic, Service, Action 통신 상태를 한 화면에서 확인하고,
장애가 발생했을 때 원인 후보를 빠르게 좁히기 위한 사내 진단 도구다.

터미널의 ROS2 CLI로도 개별 리소스를 조회할 수 있지만, 다음 정보를 동시에 파악하기는 어렵다.

- 어떤 Node와 통신 리소스가 현재 Graph에 존재하는가
- 누가 발행·구독하거나 Server·Client 역할을 맡고 있는가
- Topic 데이터가 실제로 들어오고 있으며 주기와 마지막 수신 시각은 정상인가
- Service Call과 Action Goal의 최근 실행 결과는 무엇인가
- 상대 endpoint와 Dashboard entity의 QoS가 호환되는가
- 문제가 언제 발생했고 언제 해결됐으며 재발했는가

Dashboard는 이 정보를 지속적으로 수집해 목록에서는 빠른 상태 판단을, 상세 화면에서는 원인 분석을 제공한다.

### Monitoring과 Interface Lab

프로젝트의 기능은 두 영역으로 구분된다.

| 영역 | 목적 | 자동 통신 실행 여부 |
|---|---|---|
| Monitoring | ROS2 Graph와 수신 데이터를 관찰하고 상태·관계·QoS·Alert를 계산 | 새로운 Service Call이나 Action Goal을 자동 실행하지 않음 |
| Interface Lab | 사용자가 선택한 타입으로 Publish, Receive, Call, Goal, Cancel을 직접 시험 | 사용자가 명시적으로 실행한 경우에만 entity 생성과 통신 수행 |

이 구분이 중요한 이유는 Service Call이나 Action Goal이 실제 기기 동작을 바꿀 수 있기 때문이다.
Monitoring은 안전한 관찰에 집중하고, 능동 통신은 사용자의 의도가 명확한 Interface Lab으로 제한한다.

### 전체 구조를 한 문장으로

> rclpy Monitor가 ROS2 Graph와 메시지를 수집해 snapshot을 만들고, ROS2와 분리된 FastAPI Backend가 이를
> cache·영속화한 뒤 REST/WSS로 React Frontend에 전달하며, 필요한 Service/Action DDS QoS는 선택적인
> Fast DDS Observer가 보완한다.

## 2. 이해에 필요한 핵심 개념

### ROS2 Graph

Graph는 현재 ROS2 domain에서 발견되는 Node와 Topic, Service, Action의 존재 및 연결 관계다. Graph에서
Publisher나 Server를 발견했다는 것은 endpoint가 광고되고 있다는 뜻이지, 실제 데이터 전달이나 요청 성공까지
증명하는 것은 아니다.

### Runtime, cache, snapshot

- **Runtime**: Graph를 조회하거나 callback을 처리하면서 최신 상태를 관리하는 실행 객체
- **Cache**: Runtime이 메모리에 보관하는 최근 관찰값
- **Snapshot**: 특정 시점의 cache를 외부 API에 안전하게 반환하도록 복사·조립한 값

Monitor 내부 cache와 Backend cache는 목적이 다르다. Monitor cache는 ROS2 사실과 실행 상태의 원본이고,
Backend cache는 Monitor가 잠시 끊겨도 웹 계층이 마지막 정상 결과를 유지하기 위한 복사본이다.

### Observation과 Activity

- **Observation**은 Graph 발견, Topic latest/Hz, Action Feedback처럼 자동으로 관찰한 값이다.
- **Activity**는 사용자가 Interface Lab에서 Publish, Receive, Call, Goal을 실행해 만든 이력이다.

Graph에 Server가 있다는 사실과 사용자가 실제 Call에 성공했다는 사실을 같은 상태로 취급하지 않는다.

### Endpoint와 Node 수

DDS endpoint는 실제 Publisher, Subscriber, Reader, Writer 하나를 뜻한다. 같은 Node가 여러 endpoint를
만들 수도 있으므로 endpoint 수와 고유 Node 수는 다를 수 있다.

- `publisher_count`, `subscriber_count`, `server_count`, `client_count`는 Dashboard 자체 entity를 포함할 수 있는
  raw Graph 진단값이다.
- 기본 목록의 `*_node_count`는 역할별 고유 Node 수이며 내부 Monitor Node를 제외한다.
- Interface Lab에서 사용자가 만든 entity는 실행 사실로 별도 표시한다.

이 정책은 Dashboard가 감시를 위해 만든 Subscription 때문에 실제 기기 연결 수가 부풀어 보이는 문제를 막는다.

## 3. 전체 아키텍처

```text
ROS2 Graph / Messages / Actions
        │
        ├── rclpy Graph API와 callback
        │
        └── Fast DDS Discovery ──→ Fast DDS Observer (optional, :8766)
                                      │
                                      ▼
ROS2 Monitor (:8765)
  - Topic / Service / Action / Node Runtime
  - QoS 관찰·비교
  - Alert 후보
  - Interface Lab 실행
  - coherent snapshot
        │
        │ localhost HTTP polling
        ▼
FastAPI Backend (:8000)
  - 마지막 정상 Monitor cache
  - 공개 REST / Browser WebSocket
  - Alert lifecycle
  - 사용자 주요 리소스 설정
        │                     │
        │                     └── MariaDB: Alert 발생·해결 이력
        ▼
Nginx (:443)
  - React production 정적 파일
  - HTTPS REST / WSS reverse proxy
        │
        ▼
React Frontend
```

### ROS2 Monitor

Monitor만 ROS2를 직접 다룬다. rclpy Node를 만들고 다음 책임을 가진다.

- Node, Topic, Service, Action Graph 자동 발견
- Topic 자동 Subscription, latest, Hz, age, missing, stale 계산
- Service와 Action의 Graph 상태 및 사용자 실행 결과 조립
- Node별 여섯 통신 역할 수집
- Graph endpoint QoS와 실제 생성 entity의 RMW QoS event 관찰
- source별 Alert 후보와 현재 Monitor Alert 상태 계산
- Interface 등록·업로드·build·apply 및 사용자 명시 통신 실행
- Backend가 polling할 localhost transport snapshot 제공

Graph 갱신은 Node → Topic → Service → Action 순서로 진행한다. rclpy spin thread는 Topic 메시지,
Action Status/Feedback 등 비동기 callback을 처리한다.

### Fast DDS Observer

rclpy Graph만으로는 Service의 DDS Request/Response endpoint QoS를 충분히 볼 수 없다. 선택적인 C++ Observer는
Fast DDS discovery에서 다음 server-side endpoint를 관찰한다.

- Service Request DataReader
- Service Response DataWriter
- Action Goal, Result, Cancel 내부 Service의 동일 endpoint

Observer는 Discovery용 DomainParticipant만 만들며 Service Client, ActionClient 또는 사용자 데이터
Reader/Writer를 만들지 않는다. 사용자 요청도 전송하지 않는다. 따라서 보조 진단기가 실행되지 않아도
Monitoring 전체가 중단되지는 않으며, 해당 Service 계열 QoS만 `graph_unavailable`이 될 수 있다.

현재 방식은 `rmw_fastrtps_cpp`와 Fast DDS endpoint naming에 종속된다.

### FastAPI Backend

Backend는 `rclpy`를 import하지 않는 순수 웹 프로세스다.

- Monitor의 `/transport/snapshot`을 기본 1초 주기로 polling
- 마지막 정상 snapshot과 Monitor 연결 오류를 함께 보관
- Browser용 Topic, Service, Action, Node, Alert REST 제공
- `/ws/monitor`로 경량 상태 snapshot 전송
- Interface Lab과 Camera 요청을 body와 content type을 유지해 Monitor로 proxy
- Monitor Alert를 MariaDB의 active/resolved 이력과 동기화
- 사용자 별표를 YAML에 저장하고 Monitor에 재동기화

Monitor보다 Backend가 먼저 시작하거나 Monitor가 재시작되어도 Backend 자체는 종료되지 않는다. 연결 실패 중에는
마지막 정상 cache를 유지하고, 재연결되면 새 snapshot과 사용자 우선순위를 다시 동기화한다.

### React Frontend

Frontend는 Backend REST와 `/ws/monitor`만 사용한다. ROS2, Monitor 8765, Observer 8766, MariaDB에 직접
연결하지 않는다.

- 목록: 현재 문제와 통신 활동을 빠르게 판단
- 우측 상세: 상태 이유, 실제 연결 이름, endpoint QoS, payload와 실행 결과 분석
- Visualization: 이미 받은 Node·리소스 관계를 React Flow node/edge로 변환
- Interface Lab: 등록, 실행, 수신, History UI 제공

### MariaDB

MariaDB는 실시간 ROS2 snapshot 전달 수단이 아니다. Backend가 관리하는 Alert 발생·해결 이력만 저장한다.
Topic latest, Interface Lab 실행 History, Graph snapshot은 MariaDB에 저장하지 않는다.

### Nginx

제품 모드에서는 Nginx가 TLS를 종료한다. React production build를 정적으로 제공하고 `/ros`, `/health`,
`/ws/monitor` 요청을 localhost Backend로 전달한다. HTTPS 화면의 WebSocket은 WSS를 사용한다.

## 4. 전체 데이터 흐름

### 자동 Monitoring 흐름

```text
ROS2 Graph / Message callback
↓
Resource Runtime cache
↓
상태·관계·QoS·최근 실행 정보 조립
↓
Monitor /transport/snapshot
↓
Backend MonitorEventConsumer
↓
마지막 정상 MonitorCache + Alert lifecycle
↓
REST / WSS
↓
Frontend 목록·상세·Overview·Visualization·Alerts
```

Monitor는 한 transport 요청 안에서 Topic, 숨김 항목을 포함한 Service, Action을 각각 한 번 조립한다.
공개 Service 목록은 같은 전체 Service snapshot에 숨김 정책을 적용해 만들고, Node 관계와 Alert도 이미 만든
resource snapshot을 재사용한다. 이 방식은 한 화면 안에서 서로 다른 시점의 값을 섞는 문제를 줄인다.

### 사용자 실행 흐름

```text
Frontend 입력과 실행 버튼
↓
Backend /ros/... proxy
↓
Monitor Interface Lab route
↓
등록 타입 import + schema/payload validation
↓
rclpy Publisher / Subscription / Client / ActionClient
↓
응답·Feedback·Result·오류·시간 기록
↓
Interface Lab History + 일반 resource snapshot 요약
↓
Frontend 실행 결과와 Monitoring 목록
```

Topic Publish의 성공은 로컬 `Publisher.publish()` 호출 성공이며 Subscriber 수신 확인이 아니다. QoS가 맞지 않는
Subscriber는 받지 못해도 지속 Publish와 History는 정상 기록될 수 있다. Service는 Server readiness를 확인한 뒤
Call을 보내고, Action은 Goal Service가 준비되면 나머지 네 채널 상태와 독립적으로 Goal을 보낼 수 있다.

## 5. Monitoring 공통 원칙

### 실제 Graph가 목록의 출발점

Topic, Service, Action, Node 목록은 현재 또는 과거에 실제 Graph에서 발견된 리소스를 기준으로 한다.
설정에 이름만 존재하고 Graph에서 한 번도 발견되지 않은 Topic을 placeholder로 추가하지 않는다.
`required_stream_names`와 `command_names`는 발견된 Topic의 역할과 Alert 대상을 분류하는 설정이다.

### 발견과 통신 성공을 구분

- Publisher 발견은 실제 메시지 발행을 보장하지 않는다.
- Service Server 발견은 Call 성공을 보장하지 않는다.
- Action Server 발견은 Goal 수락과 Result 성공을 보장하지 않는다.
- Graph endpoint 발견은 Dashboard 적용 QoS와의 호환을 자동으로 보장하지 않는다.

따라서 Graph 상태, 실제 수신 상태, 사용자 실행 결과, QoS 상태를 별도 근거로 유지한다.

### 주요 리소스

Monitor가 계산한 system primary와 Backend 사용자 별표를 합친 `is_primary`가 주요 여부의 최종 값이다.
Frontend가 별도 규칙으로 주요 여부를 다시 추론하지 않는다. Alert는 모든 ROS 내부 리소스에 무차별 생성하지
않고 주요·등록·감시 대상과 hidden 제외 정책을 따른다.

## 6. Topic Monitoring

### 수집과 자동 Subscription

Monitor는 Graph에서 Topic 이름, 타입, Publisher/Subscriber endpoint와 QoS를 수집한다. 지원 타입 또는
Interface Registry에 등록해 import 가능한 타입은 기존 discovery/filter 흐름 안에서 자동 Subscription을 만든다.

현재 기본 지원 타입에는 Image, CompressedImage, LaserScan, Odometry, Imu, Twist, TwistStamped,
JointState, MonitorStatus가 포함된다.

Subscription callback은 다음을 갱신한다.

- 마지막 메시지 preview
- 마지막 수신 시각
- 최근 Hz window의 timestamp
- 메시지 수
- 실제 Subscription QoS와 RMW incompatible event

### 상태

Topic은 Graph 원본 `status`와 화면 대표 `effective_status`를 함께 가진다.

| 상태 | 의미 |
|---|---|
| `active` | Publisher와 Subscriber가 존재 |
| `no_subscriber` | Publisher는 있으나 Subscriber가 없음. 일반적으로 장애가 아님 |
| `waiting_publisher` | Subscriber는 있으나 Publisher가 없음 |
| `inactive` | Publisher와 Subscriber가 모두 없음 |
| `never_received` | 감시 Subscription이 생긴 뒤 timeout 동안 한 번도 메시지를 받지 못함 |
| `stale` | 이전 수신은 있으나 마지막 수신 age가 timeout을 초과함 |
| `disconnected` | 이전에 발견된 감시 Topic이 현재 Graph에서 사라짐 |

일반 Topic은 실제 수신 상태를 대표 상태에 반영한다. `/cmd_vel` 같은 command Topic은 필요할 때만 발행되는
정상 대기를 고려해 `never_received`로 대표 상태를 덮지 않고 Graph 상태를 유지한다.

### Hz와 age

Hz는 최근 `hz_window_sec` 안에 남은 메시지 수를 전체 window 초로 나눈 값이다. age는 현재 시각과 마지막
수신 시각의 차이다. 한 번도 수신하지 못한 상태와 과거 수신 후 중단된 상태를 구분한다.

### 수신 원인 진단

`reception_diagnosis`는 missing/stale 현상에 이미 확보한 근거를 연결한다.

1. Subscription 생성 실패
2. 실제 RMW incompatible QoS event
3. Graph endpoint 비교에서 발견된 QoS incompatible 후보
4. QoS compatible이면 Publisher의 실제 발행 또는 callback/type 경로 점검
5. QoS를 확인할 수 없으면 원인을 확정하지 않음

미수신만으로 QoS 불일치를 확정하지 않는다.

### Camera Preview

`sensor_msgs/msg/Image`와 `sensor_msgs/msg/CompressedImage`도 일반 Topic과 동일한 discovery, QoS,
Subscription, Hz, age, missing/stale 흐름을 사용한다.

정기 snapshot에는 큰 binary 배열이나 data URL을 넣지 않는다. 사용자가 Camera Topic 상세를 열어
preview API를 요청한 짧은 TTL 동안만 frame을 변환한다.

- Raw Image: `rgb8`, `bgr8`, `mono8`을 PNG로 변환
- CompressedImage: magic byte와 format이 맞는 JPEG/JPG 또는 PNG 사용
- 미지원 encoding/format: Topic 전체를 실패시키지 않고 미지원 상태 표시

## 7. Service Monitoring

Service는 Graph의 Server/Client 존재와 사용자의 실제 Call 결과를 구분한다.

| 상태 | 의미 |
|---|---|
| `active` | 유효한 Service 타입과 Server가 존재 |
| `waiting_server` | Client는 있으나 Server가 없음 |
| `inactive` | Server와 Client가 없음 |
| `unknown` | Service 전체 타입을 확인할 수 없음 |
| `disconnected` | 이전 발견 후 Graph missing timeout 동안 계속 보이지 않음 |

Client가 없는 Server는 요청을 기다리는 정상 Service이므로 Alert가 아니다. 자동 Active Check는 기본적으로
꺼져 있으며 Monitor Graph 갱신 과정에서 일반 Service를 주기 호출하지 않는다.

실제 Call은 Interface Lab에서 사용자가 요청했을 때만 수행한다. Request, Response, 성공·실패, timeout,
응답 시간과 마지막 호출 시각이 Runtime History와 Service snapshot에 합쳐진다.

## 8. Action Monitoring

Action은 하나의 통신이 아니라 다음 내부 채널의 조합이다.

```text
Goal Service
Result Service
Cancel Service
Feedback Topic
Status Topic
```

Graph에서는 Action Server/Client를 발견하고, Monitor는 설정에 따라 Status와 Feedback을 구독하며 관찰한 Goal의
Result를 조회한다. 새로운 Goal은 자동으로 만들지 않는다.

목록에는 Action Server/Client Node 수, 마지막 Goal 상태, 마지막 Feedback, 마지막 Result, 실행 시간과
최근 Goal 시각을 표시한다. Feedback 시각은 callback 시각, Result 시각은 future 완료 시각을 우선한다.

사용자가 Interface Lab에서 Goal을 보내면 accept, Feedback, Result, Cancel과 실행 History를 관리한다.
Action 전체 상태와 Goal 실행 결과는 별개다. Server가 `active`여도 최근 Goal은 rejected, aborted 또는
result timeout일 수 있다.

## 9. Node Monitoring

Node Runtime은 Graph의 Node 이름과 namespace를 정규화한 full name을 기준으로 다음 여섯 역할을 수집한다.

- 발행 Topic
- 구독 Topic
- Service Server
- Service Client
- Action Server
- Action Client

Node가 Graph에 보이면 `active`다. 이전에 발견됐던 Node가 사라지면 즉시 프로세스 사망으로 단정하지 않고
설정된 timeout 동안 누락을 확인한 뒤 `disconnected`로 확정한다. 재등장하면 즉시 `active`로 복귀한다.

별도 heartbeat나 운영체제 process 신호는 없으므로, Dashboard가 확실히 말할 수 있는 것은 “ROS2 Graph에서
보이지 않는다”까지다. 실제 프로세스 사망과 네트워크·Discovery의 일시적 비가시성을 구분하지 않는다.

## 10. QoS 진단

### 왜 QoS를 따로 보는가

ROS2 endpoint가 같은 이름과 타입을 사용해도 QoS 정책이 호환되지 않으면 실제 데이터가 전달되지 않을 수 있다.
Dashboard는 Graph/DDS에서 관찰한 상대 QoS와 Dashboard가 실제 entity에 적용한 QoS를 구분한다.

### 공통 상태

| 상태 | 의미 |
|---|---|
| `compatible` | 비교한 endpoint 또는 Dashboard 적용 profile이 모두 호환 |
| `partial` | 일부 endpoint와만 호환 |
| `incompatible` | 확정 QoS 불일치 |
| `observed` | 상대 endpoint QoS는 발견했으나 적용 profile과의 호환 판정 전 |
| `unknown` | 비교할 QoS를 확인하지 못함 |

`graph_unavailable`은 주로 발견 경로의 상태이며 그 자체로 장애가 아니다.

### Topic QoS

rclpy의 Publisher/Subscription endpoint API에서 Reliability, Durability, History, Depth, Deadline,
Lifespan, Liveliness, Lease Duration을 읽고 endpoint 조합을 비교한다. Dashboard가 실제 만든 Publisher와
Subscription에는 RMW incompatible event callback을 연결해 Graph 추정과 실제 middleware event를 구분한다.

### Service QoS

Fast DDS Observer가 server의 Request Reader와 Response Writer를 관찰한다. rclpy Service Client는 양방향에
하나의 profile을 사용하므로 Interface Lab Auto는 두 방향을 함께 만족시키는 profile을 선택한다.

Fast DDS discovery에서 확인할 수 없는 History와 Depth는 local Service 기본값을 사용한다. Observer가 없거나
단일 profile로 양방향을 만족할 수 없으면 Service 기본 profile로 fallback하되, fallback 자체를 오류로
간주하지 않는다.

### Action QoS

Action QoS는 하나로 합치지 않는다.

- Goal, Result, Cancel: 각각 Fast DDS Service QoS
- Feedback, Status: 각각 rclpy Topic QoS

화면과 Alert 모두 어느 채널이 문제인지 구분한다.

### Auto와 Manual

Interface Lab Auto는 상대 endpoint들과 가장 잘 호환되는 profile을 계산한다. Manual은 사용자가 다음 정책을
직접 지정한다.

- Reliability
- Durability
- History
- Depth
- Deadline
- Lifespan
- Liveliness
- Lease Duration

entity pool은 이름과 타입뿐 아니라 전체 QoS fingerprint가 같을 때만 재사용한다.

### Endpoint 표시 그룹

같은 role, 통신 scope, QoS fingerprint를 가진 실제 endpoint는 UI에서 `Subscriber × N`처럼 묶어 공통 QoS를
한 번만 표시한다. GUID/GID가 다른 endpoint 데이터는 삭제하지 않으며 접힌 상세에서 Node, namespace,
GUID/GID, participant와 Dashboard 소유 여부를 확인할 수 있다. QoS가 다르거나 Action 채널이 다르면 별도
그룹으로 유지한다.

## 11. Alert 판정과 생명주기

### 책임 분리

```text
Resource 상태와 QoS
↓
Monitor source별 Alert builder
↓
Monitor active/resolved memory
↓
Backend AlertHistoryService
↓
MariaDB alert table
↓
현재 Alert / 이전 Alert 화면
```

Monitor가 “현재 어떤 Alert 조건이 성립하는가”를 계산하고, Backend가 이전 active set과 비교해 최초 발생,
지속, 해결, 재발을 DB에 기록한다.

### 현재 Alert 종류

현재 실제 builder가 생성하는 code는 21종이다.

| Source | code |
|---|---|
| Topic | `waiting_publisher`, `topic_message_missing`, `topic_stale`, `topic_disconnected`, `topic_qos_incompatible` |
| MonitorStatus | `monitor_status_warning`, `monitor_status_error`, `monitor_status_critical` |
| Service | `service_call_timeout`, `service_call_failed`, `service_disconnected`, `service_qos_incompatible` |
| Action | `action_disconnected`, `action_goal_aborted`, `action_goal_canceled`, `action_goal_rejected`, `action_goal_send_failed`, `action_result_timeout`, `action_result_unavailable`, `action_qos_incompatible` |
| Node | `node_stale` |

### Alert가 아닌 상태

- 일반 Topic의 Subscriber 없음
- Service 또는 Action의 Client 없음
- 사용자가 아직 Call이나 Goal을 실행하지 않음
- QoS `partial`, `unknown`, `observed`, `graph_unavailable`
- Fast DDS Observer 미사용과 QoS fallback 자체
- 미수신이나 timeout만으로 추정한 QoS 문제
- 처음부터 Graph에서 발견된 적 없는 리소스

### QoS Alert 강도와 debounce

확정 `incompatible`이 설정된 서로 다른 Graph 갱신에서 기본 3회 연속 유지돼야 QoS Alert가 된다.

- 일부 endpoint 조합 불일치: `warning`
- 실제 RMW incompatible event: `error`
- Dashboard 적용 QoS가 모든 상대 endpoint와 통신 불가능함이 확인됨: `error`

compatible 복귀 또는 endpoint 소멸로 비교할 수 없게 되면 기존 active Alert는 해결된다. Action QoS Alert key는
Goal, Result, Cancel, Feedback, Status 채널명을 포함한다.

### DB 생명주기

```text
최초 발생 → 새 row INSERT, resolved_at = NULL
지속      → 같은 미해결 row 유지
해결      → 기존 row의 resolved_at UPDATE
재발      → 이전 row는 보존하고 새 row INSERT
```

MariaDB의 `alert` 테이블은 9개 컬럼을 가진다.

```text
id, alert_key, source, name, code, level, message,
detected_at, resolved_at
```

별도 status 컬럼 없이 `resolved_at IS NULL`이면 발생 중, 값이 있으면 해결됨으로 해석한다. 동일 key의 미해결
중복 row는 advisory lock과 transaction으로 방지한다. DB 장애 중에는 Backend 메모리 fallback으로 Monitoring을
유지하고 주기적으로 재연결한다.

현재 Alert의 “확인 처리”는 화면에서 숨기는 메모리 dismiss이며 DB row를 삭제하거나 acknowledged로 바꾸지 않는다.
이전 Alert History 초기화는 해결된 row를 삭제하는 별도 동작이다.

## 12. Interface Lab

### 역할

Interface Lab은 등록된 ROS2 타입을 실제 객체로 import하고 사용자가 입력한 payload를 통신으로 실행하는 도구다.
화면을 열거나 Graph에서 리소스를 발견한 것만으로 실행하지 않는다.

### 등록 방식

- 설치된 기존 ROS2 full type 직접 등록
- `.msg`, `.srv`, `.action` 정의 직접 작성·검증
- 단일 Interface 파일 업로드
- 완성된 ROS Interface package의 ZIP 또는 폴더 업로드

단순 정의만으로 충분하지 않은 custom type은 원본 package 이름, `package.xml`, `CMakeLists.txt`, 의존 package가
필요하다.

### Apply

Apply는 단순 Registry 저장이 아니다.

```text
입력과 package 검증
↓
Registry/source 보존
↓
colcon build
↓
install 환경에서 Python type import 확인
↓
Apply 상태와 log 기록
↓
성공 응답 후 Monitor 재실행
```

Registry와 원본 Interface는 build 생성물이 아니므로 Apply 과정에서 삭제하지 않는다.

### Topic

- 1회 Publish
- 설정 Hz의 지속 Publish와 중지
- 명시적 Receive 시작·중지
- Publish/Receive History

자동 Monitoring Subscription은 latest/Hz/stale 계산용이고, Lab Receive Subscription은 사용자가 payload를
직접 확인하기 위한 별도 entity다.

### Service

- Request schema 기반 입력
- 명시적 Call과 timeout
- Response, 오류와 응답 시간
- Call/Receive History

### Action

- Goal schema 기반 입력
- Goal accept, Feedback, Result
- 활성 Goal Cancel
- Goal/Receive History

### Schema 기반 입력

Frontend는 ROS2 schema로 입력 필드를 동적으로 만든다. object/array JSON 필드는 Topic Publish,
Service Request, Action Goal에서 같은 공통 컴포넌트를 사용한다. 확대·축소는 편집 화면 크기만 바꾸며
입력값, JSON validation과 payload 구조를 변경하지 않는다.

### History

Interface Lab History는 Monitor runtime 메모리다. MariaDB Alert History와 다른 데이터다. 현재 상한은
Topic Publish 100건, Topic Receive 기본·최대 500건, Service Call과 Action Goal 각각 30건이다.
Monitor가 재시작되면 메모리 실행 이력은 영구 보존되지 않는다.

## 13. Frontend 화면의 역할

### Overview

전체 리소스 상태, 현재 Alert와 주요 리소스를 빠르게 확인한다. 요약 상태 수와 Alert 수는 같은 의미가 아니다.
예를 들어 `no_subscriber`는 상태 집계에는 포함될 수 있지만 Alert는 아닐 수 있다.

### Topic, Service, Action, Node

목록은 빠른 진단에 필요한 상태, 이름, 타입, 관계 수와 최근 값을 보여준다. 값 preview를 클릭하면 전체 payload를
pretty JSON으로 확인한다. 우측 상세는 상태 이유, 실제 연결 리소스, endpoint QoS, raw payload와 실행 상세를
담당한다.

Frontend가 Backend 상태를 임의로 여러 방식으로 재판정하지 않도록 다음 공통 표시 모델을 사용한다.

- Topic: Monitor의 `effective_status`
- Service: 공통 Service presentation selector
- Action: 공통 Action presentation selector
- 주요 여부: Backend/Monitor가 제공한 `is_primary`

### Visualization

Visualization은 ROS2 Graph를 새로 조회하지 않는다. 기존 snapshot의 Node와 Topic/Service/Action 관계를
React Flow의 node와 edge로 변환한다. 따라서 Visualization은 새로운 사실의 수집 계층이 아니라 기존 관계의
다른 표현이다.

### Alerts

현재 발생 중인 Alert와 해결된 이전 Alert를 분리한다. Alert 클릭은 해당 Topic, Service, Action, Node 상세로
이동하며 QoS Alert라면 QoS 상세와 Action 문제 채널을 함께 펼친다.

## 14. 설정과 영속 데이터

### Backend와 제품 ROS runtime

`backend/.env`는 Backend/DB 설정과 제품 ROS runtime 기준값을 보관한다.

```text
ROS_DOMAIN_ID
RMW_IMPLEMENTATION
MONITOR_BASE_URL / timeout / polling
MARIADB 연결과 재시도
사용자 preferences 경로
```

실제 비밀번호가 있는 `.env`는 Git에 포함하지 않는다. 제품 설치·실행 시 ROS Domain과 RMW가
`/etc/ros2-dashboard/dashboard.env`로 동기화되고 systemd Monitor가 이를 읽는다.

### Monitor 정책

`ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml`은 다음 정책의 기준이다.

- Graph polling, Topic stale, Hz window
- Topic include/exclude, 지원 타입, required stream, command 예외
- Service/Action Graph missing timeout
- Node stale timeout과 primary/filter
- QoS incompatible confirmation count
- Fast DDS Observer polling/timeout
- Camera Preview TTL과 frame 제한

### Interface와 사용자 설정

```text
Monitor config 디렉터리
  interface_registry.yaml
  interface_packages.yaml
  interface_apply_status.yaml
  interface_apply_last.log

uploaded_interfaces/
  generated_interfaces/
  packages/<package_name>/

Backend config
  user_preferences.yaml
```

`build`, `install`, `log`, `.venv`, `node_modules`, `dist`, `.runtime`은 생성물이며 소스나 영속 Registry로
취급하지 않는다.

## 15. 제품 실행과 개발 실행

### 제품 모드

설치기는 Ubuntu 24.04에서 ROS2 Jazzy, Backend/Frontend 의존성, MariaDB, systemd, Nginx/TLS와 build를
준비한다. 기존 DB, Alert History, Interface Registry, `.env`, 인증서는 재설치에서 보존한다.

```text
ros2-dashboard.target
├─ ros2-dashboard-monitor.service
└─ ros2-dashboard-backend.service

공용 dependency
├─ mariadb.service
└─ nginx.service
```

systemd unit은 `KillMode=control-group`을 사용해 Monitor가 시작한 Observer 같은 자식 process도 함께 종료한다.
제품의 `stop.sh`는 Dashboard 전용 Monitor와 Backend를 중지하고 공용 MariaDB와 Nginx는 유지한다.

### 개발 모드

개발 모드는 Monitor, Backend, Vite를 별도로 실행해 코드 변경을 빠르게 확인한다. 제품 systemd 서비스와
5173/8000/8765/8766 포트를 공유하므로 동시에 실행하지 않는다. 각 ROS2 터미널은 Jazzy와 workspace setup을
source하고 장비와 같은 `ROS_DOMAIN_ID` 및 RMW를 사용해야 한다.

## 16. 장애 원인을 좁히는 방법

Dashboard의 판단 순서는 “현상만 보고 원인을 단정”하는 방식이 아니다.

### Topic 미수신

```text
Graph에 Topic이 실제 존재하는가
→ Publisher가 존재하는가
→ 감시 Subscription 생성에 성공했는가
→ 한 번도 못 받았는가, 받다가 중단됐는가
→ RMW incompatible event가 있는가
→ Graph QoS 비교가 incompatible인가
→ QoS가 compatible이면 실제 Publisher 발행과 callback/type 경로 점검
```

### Service 실패

```text
Server가 Graph에 존재하는가
→ 사용자가 실제 Call을 실행했는가
→ validation 전에 실패했는가
→ 서버 전송 뒤 timeout 또는 response 실패인가
→ Service Request/Response QoS를 관찰할 수 있는가
```

### Action 실패

```text
Action Server가 존재하는가
→ Goal 전송·accept가 성공했는가
→ 실행 중 Feedback이 들어오는가
→ Result 또는 Cancel 결과가 있는가
→ Goal/Result/Cancel/Feedback/Status 중 어느 QoS 채널이 문제인가
```

### Node 이탈

```text
이전에 Graph에서 발견됐는가
→ 설정 timeout 동안 계속 누락됐는가
→ 재등장했는가
→ 별도 process heartbeat가 없으므로 Graph 이탈 이상의 원인은 단정하지 않음
```

## 17. 설계상 제한과 범위 밖 기능

- 단일 로컬 ROS2 기기 진단을 목적으로 하며 다중 장비 관제 플랫폼이 아니다.
- 인터넷 공개 서비스, 사용자 인증과 권한 관리가 현재 핵심 범위가 아니다.
- Fast DDS Observer는 Fast DDS 2.14 계열과 `rmw_fastrtps_cpp` naming에 종속된다.
- Graph 발견만으로 실제 데이터 발행이나 Service/Action 성공을 증명할 수 없다.
- Node Graph 이탈과 실제 OS process 사망을 구분하는 별도 heartbeat는 없다.
- Camera Preview는 ROS2 Image Topic을 시각화할 뿐 물리 카메라를 ROS2 Topic으로 만드는 driver가 아니다.
- Gazebo process 관리나 TurtleBot3 전용 제어 UI를 제공하지 않는다.
- Interface Lab 실행 History는 영구 DB가 아니라 Monitor 메모리에 보관된다.
- Alert acknowledgement, occurrence count와 JSON detail DB 컬럼은 구현되어 있지 않다.

## 18. 프로젝트를 공부하는 권장 순서

1. 이 문서에서 Monitoring과 Interface Lab, Monitor와 Backend의 경계를 이해한다.
2. Monitor transport snapshot이 어떤 resource snapshot을 한 번에 조립하는지 확인한다.
3. Topic → Service → Action → Node Runtime 순서로 Graph와 실제 통신의 차이를 본다.
4. QoS가 Topic Graph와 Fast DDS Service discovery로 나뉘는 이유를 이해한다.
5. Monitor Alert 후보와 Backend MariaDB lifecycle을 분리해서 읽는다.
6. Frontend는 목록 표시 모델과 우측 상세이 같은 snapshot을 어떻게 표현하는지 확인한다.
7. 마지막으로 Interface Lab의 등록 → Apply → schema 입력 → 실제 entity 실행 흐름을 따라간다.
8. 코드를 수정할 때만 관련 `test/`, `tests/`, `*.test.js`를 동작 계약으로 함께 읽는다.

프로젝트 전체를 관통하는 핵심 원칙은 다음 세 문장으로 요약할 수 있다.

1. **Monitoring은 관찰이고 Interface Lab은 사용자의 명시적 실행이다.**
2. **Graph 발견, 실제 데이터 수신, 사용자 실행 결과와 QoS 근거를 서로 다른 사실로 유지한다.**
3. **Monitor만 ROS2를 다루고 Backend와 Frontend는 snapshot 경계를 통해 동작한다.**
