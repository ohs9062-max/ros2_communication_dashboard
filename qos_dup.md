# Topic / Service / Action QoS endpoint 중복 조사

조사일: 2026-08-12 (Asia/Seoul)

## 해당 작업에서 내가 알아야 할 것 3줄 요약

1. 같은 QoS 카드가 여러 개 보이는 현재 주요 사례는 같은 endpoint의 중복 수집이 아니라, GUID/GID가 다른 실제 DDS endpoint가 같은 QoS를 사용하는 경우였다.
2. `/CanControl/_action/get_resultReply`의 `Response DataWriter 1/2`는 서로 다른 두 Action server 프로세스/participant가 만든 실제 writer 2개이며, observer·Monitor·Backend·Frontend가 복제한 결과가 아니다.
3. 데이터는 endpoint 단위로 유지하되 기본 UI는 `채널 → 역할 → endpoint 수 → 공통 QoS`로 묶고, GUID/GID와 participant 차이는 펼친 상세에서 보여주는 것이 적절하다.

## 1. 결론 요약

이번 live 표본에서 Fast DDS observer의 `(endpoint kind, GUID)` 완전 중복은 **248개 endpoint 중 0건**이었다. observer 내부도 `reader|writer + GUID`를 `std::map` key로 사용하므로 같은 kind와 같은 GUID의 재발견은 append되지 않고 기존 값을 교체한다.

현재 중복처럼 보이는 가장 큰 원인은 다음 두 가지다.

- 같은 이름과 같은 QoS를 가진 **실제 프로세스/endpoint가 여러 개** 실행 중이다. 현재 `/CanControl` server는 PID 138380과 PID 209519 두 개이며 participant GUID가 다르다.
- API/UI가 endpoint identity를 충분히 보여주지 않는다. Service payload에는 GUID가 있지만 UI가 표시하지 않고, Topic payload는 rclpy가 제공하는 endpoint GID를 Monitor 직렬화 단계에서 아예 제외한다. 따라서 서로 다른 endpoint도 화면에서는 동일 카드처럼 보인다.

Backend의 endpoint 추가/복제, Frontend의 같은 데이터 이중 렌더링은 확인되지 않았다. 다만 Topic은 현재 공개 payload에 GID가 없으므로 향후 같은 GID가 정말 두 번 반환되는 경우를 API/UI 단계에서 판정하거나 제거할 수 없다.

## 2. 실제 live 검증 환경

- ROS domain: 99
- Fast DDS observer: `127.0.0.1:8766`, endpoint 248개
- Monitor: `127.0.0.1:8765`
- Backend: `127.0.0.1:8000`, `monitor_connected: true`
- Monitor process: PID 8393
- Fast DDS observer: PID 8413
- `/CanControl` server: PID 138380, PID 209519 (동일 node name으로 두 프로세스 실행)

직접 확인한 데이터 원천은 다음과 같다.

- Fast DDS observer `/snapshot`: GUID, DDS topic/type, channel, reader/writer, server/client role, QoS
- Monitor `/ros/topics`, `/ros/services?include_hidden=true`, `/ros/actions`
- Backend `/ros/actions`
- 별도 읽기 전용 rclpy probe의 `get_publishers_info_by_topic()` / `get_subscriptions_info_by_topic()`: endpoint GID 직접 확인
- 실행 프로세스 목록: 중복 이름이 실제 두 프로세스인지 대조

읽기 전용 probe node는 Graph discovery만 수행하고 Publisher, Subscription, Service Client, Action Client를 만들지 않았다.

## 3. 수집·집계·표시 전체 경로

### Topic

`qos.py:endpoint_qos()`는 rclpy Graph API가 돌려준 각 `TopicEndpointInfo`를 list comprehension으로 그대로 직렬화한다.

현재 저장하는 값:

- node name
- node namespace
- ROS topic type
- endpoint kind (`publishers` / `subscriptions`)
- Dashboard 소유 여부
- QoS profile 8개 정책

rclpy 객체에는 있지만 현재 버리는 값:

- `endpoint_gid`
- GID에서 파생 가능한 participant prefix
- endpoint identity와 직접 연결되는 명시적 DDS GUID

Topic 이름은 바깥 resource item의 `name`으로만 존재하고 endpoint item에는 반복하지 않는다. DDS topic/type 이름도 Fast DDS 수준의 이름으로 제공하지 않는다.

집계 방식은 **list append와 동일한 list comprehension**이며 deduplicate key가 없다. `observe_topic_qos()`는 publisher/subscription 배열을 이어 `remote_qos`로 만들고, 모든 Publisher × Subscription 조합을 QoS 호환성 비교에 사용한다. QoS 선택 후보만 `_unique_profiles()`에서 profile 값 기준으로 줄이지만, 공개 endpoint 배열은 줄이지 않는다.

중요한 결과:

- `같은 Topic + 같은 QoS + 서로 다른 GID`: 실제 endpoint 여러 개로 배열에 모두 남는다.
- `같은 Topic + 같은 QoS + 같은 GID`: rclpy가 정말 같은 GID를 두 번 반환하면 현재 Monitor도 두 번 남긴다. 현재 API에는 GID가 없어 downstream에서 이 경우를 판정할 수 없다.
- live로 직접 확인한 동일 카드 사례는 모두 GID가 달랐다.

### Service

Fast DDS observer는 `rq/...Request`와 `rr/...Reply` 이름 규칙을 해석한다.

| DDS entity | DDS channel | observer role 판정 | 의미 |
|---|---|---|---|
| Request DataWriter | `rq/...Request` | client | client가 request를 씀 |
| Request DataReader | `rq/...Request` | server | server가 request를 읽음 |
| Response DataWriter | `rr/...Reply` | server | server가 response를 씀 |
| Response DataReader | `rr/...Reply` | client | client가 response를 읽음 |

observer는 reader discovery와 writer discovery를 모두 받으며 내부 key는 각각 `reader:<GUID>`, `writer:<GUID>`다. 같은 GUID라도 kind가 다르면 별개이고, 같은 kind/GUID의 update는 map 값을 교체한다. 제거 event는 같은 key를 삭제한다.

Monitor의 `_replace_snapshot()`은 raw endpoint 중 `service_role == server`만 `service_name`별 list에 append한다. 그러므로 현재 Service/Action Service QoS 화면에 전달되는 것은 다음 둘뿐이다.

- Request DataReader
- Response DataWriter

Request DataWriter와 Response DataReader는 observer raw snapshot에는 있지만 UI용 `service_qos()`에서는 의도적으로 제외된다. `service_qos()`는 server list를 writer=`publisher_qos`, reader=`subscriber_qos`로 나눌 뿐 별도 deduplicate를 하지 않는다.

식별값은 public payload에 `guid`, `dds_topic`, `dds_type`, `service_channel`, `endpoint_kind`, `service_role`, QoS가 남는다. participant는 별도 field가 아니지만 GUID의 `|` 앞 prefix로 구분할 수 있다. node name/namespace는 Fast DDS observer payload에 없다.

### Action

Action은 다음 5개 channel을 독립적으로 관찰한다.

- Goal Service → `<action>/_action/send_goal`
- Result Service → `<action>/_action/get_result`
- Cancel Service → `<action>/_action/cancel_goal`
- Feedback Topic → `<action>/_action/feedback`
- Status Topic → `<action>/_action/status`

Goal/Result/Cancel은 위 Service 경로를 재사용하므로 server Request DataReader와 server Response DataWriter가 표시된다. Feedback/Status는 Topic Graph 경로를 재사용하므로 publisher/subscription endpoint가 표시된다. Action channel 이름은 endpoint item의 deduplicate key가 아니라 `qos.goal/result/cancel/feedback/status`의 상위 object key로 보존된다.

`/CanControl` live 결과:

| Channel | role | 실제 endpoint | identity 요약 |
|---|---|---:|---|
| Goal Service | Request DataReader | 2 | participant `...6f32bf64...`, `...8c1ce211...` |
| Goal Service | Response DataWriter | 2 | 같은 두 server participant, 서로 다른 writer GUID |
| Result Service | Request DataReader | 2 | GUID suffix `0.0.17.4`, participant prefix 다름 |
| Result Service | Response DataWriter | 2 | GUID suffix `0.0.18.3`, participant prefix 다름 |
| Cancel Service | Request DataReader | 2 | 같은 두 server participant |
| Cancel Service | Response DataWriter | 2 | 같은 두 server participant |
| Feedback Topic | Publisher | 2 | GID `...6f32bf64...1903`, `...8c1ce211...1903` |
| Feedback Topic | Subscription | 2 | 같은 Monitor participant지만 entity GID `...1704`, `...2404` |
| Status Topic | Publisher | 2 | GID `...6f32bf64...1a03`, `...8c1ce211...1a03` |
| Status Topic | Subscription | 2 | 같은 Monitor participant지만 entity GID `...1604`, `...2504` |

두 server participant는 실제로 실행 중인 두 `can_control_server` 프로세스와 대응한다. Feedback/Status의 Dashboard subscription 2개도 같은 GID 중복이 아니라 서로 다른 entity GID다. 구조상 Topic 자동 감시 Subscription과 Action 전용 Feedback/Status Subscription이 같은 Monitor participant 안에 함께 존재할 수 있으므로, 같은 node/QoS라도 실제 DDS endpoint는 둘이다.

## 4. `/CanControl/_action/get_resultReply` 상세 판정

UI의 `Response DataWriter 1`, `Response DataWriter 2`는 다음과 같다.

| 항목 | DataWriter 1 | DataWriter 2 |
|---|---|---|
| DDS Topic | `rr/CanControl/_action/get_resultReply` | 동일 |
| DDS Type | `rths_interfaces::action::dds_::CanControl_GetResult_Response_` | 동일 |
| QoS | 동일 | 동일 |
| GUID | `01.0f.70.2e.6f.32.bf.64.00.00.00.00|0.0.18.3` | `01.0f.70.2e.8c.1c.e2.11.00.00.00.00|0.0.18.3` |
| Participant prefix | `01.0f.70.2e.6f.32.bf.64.00.00.00.00` | `01.0f.70.2e.8c.1c.e2.11.00.00.00.00` |
| 실제 원인 | 첫 번째 Action server process | 두 번째 Action server process |

따라서 이 사례의 분류는 **B. 서로 다른 endpoint, QoS 동일**이다. observer 중복 수집, Monitor 중복 append, Backend 복제, Frontend 이중 렌더링이 아니다.

같은 Result Service에는 client 측 Request DataWriter 2개와 Response DataReader 2개도 raw observer에서 확인됐다. 이들은 같은 client participant 안에서도 entity GUID가 각각 달랐다. 그러나 Monitor가 server role만 공개하므로 현재 QoS 카드에는 나타나지 않는다.

## 5. 단계별 집계 key와 중복 가능성

| 단계 | collection/key | GUID/GID 포함 | participant 포함 | channel 포함 | 판정 |
|---|---|---:|---:|---:|---|
| Fast DDS observer | `std::map[endpoint_kind + GUID]` | 예 | GUID prefix에 내포 | endpoint value에 포함 | 같은 kind/GUID 완전 중복 방지 |
| Monitor Service index | `dict[service_name] -> list.append(endpoint)` | value에 예, key에는 아니오 | 별도 field 없음 | service name에 channel 경로가 포함 | observer가 준 서로 다른 GUID를 모두 보존 |
| Monitor Topic | rclpy 결과 list comprehension | **아니오** | 아니오 | resource name 바깥에 존재 | identity 손실; 중복 판정 불가 |
| Monitor Action | `goal/result/cancel/feedback/status` object | Service만 value에 GUID | Service만 GUID prefix로 가능 | 상위 object key에 예 | channel 간 혼합 없음 |
| Backend cache | JSON decode 후 `cache.update(data)` | 변형 없음 | 변형 없음 | 변형 없음 | append/deduplicate 없음 |
| Backend REST | cache 배열 그대로 반환 | 변형 없음 | 변형 없음 | 변형 없음 | 복제 없음 |
| Frontend | endpoint array `.map(..., index)` | Service payload에 있으나 표시 안 함 | 표시 안 함 | Action 상위 group으로 구분 | 받은 item당 카드 1개; 자체 복제 없음 |

Frontend React key도 node/namespace/index 또는 fallback/index를 사용한다. 같은 배열 item을 두 번 순회하지는 않지만, identity가 화면에 보이지 않고 QoS 8개 값을 매 카드마다 모두 렌더링하므로 실제 endpoint 여러 개가 시각적으로 중복처럼 보인다.

## 6. 중복 판정 기준

### A. 완전 중복

다음 canonical identity가 모두 같을 때만 완전 중복 후보로 본다.

- channel 또는 DDS Topic/Type
- endpoint role/kind
- full endpoint GUID/GID
- participant identity
- QoS profile

같은 discovery snapshot 안에서 이 tuple이 반복되면 수집 버그 가능성이 높다. 기본 UI와 호환성 pair 계산에서는 한 endpoint로 취급하는 것이 타당하다. 단, 서로 다른 시각의 snapshot에서 같은 endpoint가 재관찰되는 것은 중복이 아니라 정상 update다.

### B. 서로 다른 endpoint, QoS 동일

GUID/GID가 다르면 node name, participant, Topic/Type, QoS가 같아도 실제 endpoint로 보존해야 한다. participant까지 같고 entity suffix만 달라도 한 participant 안의 서로 다른 DataWriter/DataReader다.

기본 UI에서는 `Response DataWriter × 2 · QoS 동일`처럼 묶고 공통 QoS를 한 번만 보여준다. 펼친 endpoint 상세에서 full GUID/GID, participant prefix, node/namespace, Dashboard 소유 여부를 보여준다.

### C. 서로 다른 endpoint, QoS도 다름

role 안에서 QoS fingerprint별로 subgroup을 나눠야 한다. 서로 다른 Reliability, Durability, History, Depth, Deadline, Lifespan, Liveliness, Lease duration 중 실제로 다른 정책을 강조하고 각 subgroup에 속한 GUID/GID 목록을 둔다.

현재 직접 rclpy discovery 시점에는 같은 역할 안에서 서로 다른 QoS를 가진 live Topic group이 0개였고, Fast DDS server endpoint도 0개였다. Monitor의 직전 cache에는 `/cmd_vel_teleop` subscriber의 reliable/best_effort 두 profile이 있었지만 별도 probe 시점에는 endpoint가 사라져 fresh Graph에서 재확인되지 않았다. 따라서 “서로 다른 QoS endpoint 2개”의 표시 정책은 코드 구조와 cache 관찰로 검토했으며, 이번 시점의 지속 live endpoint 사례로 확정하지는 않는다.

## 7. 결과 표

| 영역 | 채널/역할 | 현재 출력 수 | 실제 endpoint 수 | 완전 중복 여부 | QoS 동일 여부 | 원인 | 권장 UI |
|---|---|---:|---:|---|---|---|---|
| Topic | `/demo_camera/image_raw` Publisher | 2 | 2 | 아니오 | 예 | 같은 node name의 서로 다른 participant/GID publisher | `Publisher × 2 · QoS 동일`, GID 상세 |
| Topic | `/CanControl/_action/feedback` Publisher | 2 | 2 | 아니오 | 예 | Action server process 2개 | `Publisher × 2 · QoS 동일` |
| Topic | `/CanControl/_action/feedback` Subscriber | 2 | 2 | 아니오 | 예 | 같은 Monitor participant 안의 서로 다른 Subscription entity | `Subscriber × 2 · QoS 동일`, Dashboard endpoint 상세 |
| Topic | `/CanControl/_action/status` Publisher | 2 | 2 | 아니오 | 예 | Action server process 2개 | `Publisher × 2 · QoS 동일` |
| Topic | `/CanControl/_action/status` Subscriber | 2 | 2 | 아니오 | 예 | 같은 Monitor participant 안의 서로 다른 Subscription entity | `Subscriber × 2 · QoS 동일` |
| Service | `/CanControl/_action/get_result` Request DataReader | 2 | 2 | 아니오 | 예 | server participant 2개 | `Request DataReader × 2 · QoS 동일` |
| Service | `/CanControl/_action/get_result` Response DataWriter | 2 | 2 | 아니오 | 예 | server participant 2개 | `Response DataWriter × 2 · QoS 동일` |
| Service raw observer | 같은 Result의 Request DataWriter | UI 미출력 | 2 | 아니오 | 예 | client entity 2개, Monitor server-role filter | 필요 시 “Client endpoint” 별도 고급 영역 |
| Service raw observer | 같은 Result의 Response DataReader | UI 미출력 | 2 | 아니오 | 예 | client entity 2개, Monitor server-role filter | 필요 시 “Client endpoint” 별도 고급 영역 |
| Action | Goal Service server Reader/Writer | 각 2 | 각 2 | 아니오 | 예 | server participant 2개 | Goal 안에서 role별 count/group |
| Action | Result Service server Reader/Writer | 각 2 | 각 2 | 아니오 | 예 | server participant 2개 | Result 안에서 role별 count/group |
| Action | Cancel Service server Reader/Writer | 각 2 | 각 2 | 아니오 | 예 | server participant 2개 | Cancel 안에서 role별 count/group |
| 전체 observer | `(kind, GUID)` 완전 중복 | 0 | 0 | 없음 | 해당 없음 | GUID-key map update | 별도 카드 없음; 진단 counter만 고려 |
| Backend | `/CanControl` channel별 GUID 배열 | Monitor와 동일 | Monitor와 동일 | 추가 중복 없음 | 동일 | JSON/cache pass-through | 변경 불필요 |
| Frontend | endpoint 카드 | 배열 item 수와 동일 | 배열 item 수와 동일 | 자체 이중 렌더 없음 | 동일 QoS 반복 | identity 미표시 + full profile 반복 | QoS fingerprint group 적용 |

## 8. 분류별 개선안

### A. 실제 중복 수집 버그

현재 live 표본에서 확인된 실제 완전 중복 수집 버그는 **없다**.

다만 Topic 공개 모델이 GID를 버리므로 완전 중복 감지 능력이 부족한 것은 구조적 결함이다. 개선 시에는 먼저 GID를 보존한 뒤, 같은 snapshot 안의 동일 `(topic, type, role, GID)` 반복만 telemetry/error로 잡아야 한다. QoS가 같다는 이유만으로 endpoint를 데이터 계층에서 제거하면 안 된다.

### B. 실제 endpoint 여러 개

- `/CanControl` 두 server process가 만든 Goal/Result/Cancel Request Reader와 Response Writer
- 같은 두 server가 만든 Feedback/Status Publisher
- 같은 Monitor participant 안의 GID가 다른 Feedback/Status Subscription
- `/demo_camera/image_raw`의 서로 다른 participant/GID Publisher 2개

모두 정상적인 DDS entity 관찰값이다. 운영 의도상 같은 server/demo process가 두 번 실행된 것이 불필요할 수는 있지만, Dashboard 수집 중복은 아니다.

### C. UI에서 그룹화해야 하는 것

- 같은 channel/role/DDS Topic/Type/QoS fingerprint를 가진 endpoint가 2개 이상인 경우
- node name이 같지만 GID가 다른 Topic endpoint
- participant가 다르지만 QoS가 같은 Service/Action endpoint
- participant는 같고 entity GUID suffix만 다른 Dashboard endpoint

권장 기본 표현:

```text
Result Service
  Response DataWriter × 2
  QoS: 동일

  Reliability: reliable
  Durability: volatile
  ...공통 QoS 1회...

  [Endpoint 상세 펼치기]
  - GUID ...6f32bf64...|0.0.18.3 / Participant ...6f32bf64...
  - GUID ...8c1ce211...|0.0.18.3 / Participant ...8c1ce211...
```

### D. 반드시 개별 표시해야 하는 것

- 같은 role 안에서 QoS fingerprint가 다른 subgroup
- QoS 불일치 진단에 참여한 endpoint
- 서로 다른 DDS type이 같은 ROS topic/service 이름 아래 존재하는 경우
- server/client role 또는 reader/writer가 다른 경우
- Action의 Goal/Result/Cancel/Feedback/Status channel이 다른 경우

서로 다른 QoS subgroup은 전체 카드를 무조건 endpoint별로 반복하기보다 profile별 group으로 나눌 수 있다. 단, 어떤 GUID/GID가 어느 profile에 속하는지는 반드시 남겨야 한다.

### E. 생략 가능한 반복 정보

동일 fingerprint group 안에서는 아래 8개 QoS 값을 endpoint마다 반복하지 않아도 된다.

- Reliability
- Durability
- History
- Depth
- Deadline
- Lifespan
- Liveliness
- Lease duration

공통 QoS는 group당 한 번 표시하고 endpoint별 상세에는 다음 identity만 우선 표시한다.

- GUID/GID
- participant prefix/ID
- node name/namespace (가능한 원천에 한함)
- endpoint role/kind
- Dashboard 소유 여부

DDS Topic/Type도 group heading에 이미 고정돼 있으면 한 번만 표시하고, endpoint별로 다를 때만 반복한다.

## 9. Topic / Service / Action 공통 UI 규칙 평가

다음 계층은 세 영역에 공통 적용 가능하다.

```text
채널 또는 통신 방향
→ endpoint role
→ endpoint count
→ QoS fingerprint group
→ 공통 QoS
→ endpoint identity 상세
```

적용 방식:

- Topic: 별도 Action channel을 만들지 말고 `Publisher` / `Subscriber`를 최상위 role로 사용한다.
- Service: `Request` / `Response` 아래 `DataReader` / `DataWriter`를 표시한다. 현재 server-only 범위라는 설명을 붙인다.
- Action: Goal/Result/Cancel/Feedback/Status를 최상위 channel로 유지하고 그 아래 role/count/profile group을 둔다.

QoS fingerprint는 8개 정책과 각 duration의 observed/infinite/unknown 상태를 모두 포함해야 한다. `unknown`과 실제 값 `null`, `infinite`는 서로 같은 것으로 합치면 안 된다.

## 10. 구현 시 우선순위 제안 (이번 작업에서는 미수정)

1. Topic endpoint GID를 수집 모델과 공개 payload에 보존한다.
2. Service GUID에서 participant prefix를 UI가 추론하지 않도록 명시적 participant identity를 모델에 둔다.
3. 수집 데이터는 실제 endpoint 단위로 그대로 유지하고, 완전 중복 검사는 full identity 기준으로만 수행한다.
4. Frontend 표시 계층에서 channel/role/QoS fingerprint group을 만든다.
5. 동일 profile group은 공통 QoS 1회 + endpoint identity list로 축약한다.
6. QoS가 다른 group은 정책 diff를 강조하고 각각 유지한다.
7. Service UI가 server endpoint만 표시한다는 범위를 명확히 쓰거나, client endpoint를 별도 고급 영역으로 제공할지 결정한다.

## 11. 근거 코드 위치

- Fast DDS GUID key와 map update: `ros2_ws/src/ros2_dashboard_dds_observer/src/fastdds_qos_observer.cpp:236-309`
- Service DDS topic/role 해석과 공개 field: `ros2_ws/src/ros2_dashboard_dds_observer/src/fastdds_qos_observer.cpp:156-232`
- Monitor Service server-role filter/list append: `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py:101-163`
- Topic endpoint 직렬화(GID 미포함): `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos.py:31-54`
- Topic 공개 배열과 Publisher×Subscription 비교: `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos.py:57-101`
- Action 5-channel 조립: `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/subscription_lifecycle.py:73-86`
- Backend cache pass-through: `backend/app/monitor_client/event_consumer.py:43-59`, `backend/app/routers/monitoring.py:18-49`
- Frontend endpoint `.map()` 및 전체 QoS 반복: `frontend/src/components/QosDetails.jsx:93-243`
- Frontend endpoint label: `frontend/src/components/QosDetails.jsx:350-357`

## 최종 결론

```text
현재 중복처럼 보이는 주요 원인: GUID/GID가 다른 실제 endpoint들이 동일 QoS를 사용하지만 UI가 identity를 숨기고 QoS 전체를 endpoint마다 반복 표시함. /CanControl은 실제 server process도 2개 실행 중임.
실제 집계 버그 여부: 이번 live 표본에서는 완전 중복 수집·Backend 복제·Frontend 이중 렌더 버그 없음. 단, Topic GID 미직렬화 때문에 완전 중복 판정 능력은 부족함.
Topic 권장 표시: Publisher/Subscriber → endpoint 수 → QoS fingerprint group → 공통 QoS 1회 → GID/node/participant 상세.
Service 권장 표시: Request DataReader/Response DataWriter를 role별로 묶고 동일 QoS는 1회 표시. 현재 server-only 관찰 범위를 명시하고 GUID/participant를 상세에 표시.
Action 권장 표시: Goal/Result/Cancel/Feedback/Status channel을 유지하고 각 channel 아래 role/count/QoS group/endpoint identity를 표시.
공통 QoS UI 규칙: full identity가 같을 때만 완전 중복 제거 후보, identity가 다르고 QoS가 같으면 그룹화, QoS가 다르면 profile별 분리와 정책 diff를 반드시 표시.
```
