# ROS2 Dashboard DDS / QoS 정책

이 문서는 Monitoring과 Interface Lab에서 QoS를 발견하고 표시하며 실제 entity에 적용하는 현재 정책을 정리한다.

## 통신 경계

```text
일반 Topic, Action Feedback/Status
→ rclpy ROS Graph endpoint QoS

Service, Action Goal/Result/Cancel
→ Fast DDS passive observer의 server Request Reader / Response Writer QoS
```

Fast DDS observer는 Discovery Participant만 만들며 Service Client, ActionClient, DataWriter/DataReader를
생성하지 않는다. 현재 구현은 `rmw_fastrtps_cpp`와 Fast DDS endpoint 이름 규칙에 종속된다.

## Monitoring과 Interface Lab

- Monitoring은 통신 상태를 관찰하며 사용자 데이터나 명령을 전송하지 않는다.
- Interface Lab은 사용자가 명시적으로 Publish, Receive, Service Call, Action Goal을 실행한다.
- Interface Lab의 QoS 선택 기능은 Monitoring의 QoS/Discovery 판정 로직을 변경하지 않는다.
- 화면의 Remote QoS와 Dashboard가 실제 entity에 적용한 QoS는 합치지 않고 별도로 표시한다.

## Interface Lab QoS Mode

Topic, Service, Action은 실행과 수신 설정을 각각 가진다. `실행/수신 연동`을 체크하면 Mode와 Manual
세부 profile을 함께 동기화하고, 해제하면 다시 독립적으로 설정한다.

### Manual

각 profile에 다음 8개 정책을 지정할 수 있다.

```text
Reliability: RELIABLE | BEST_EFFORT
Durability: VOLATILE | TRANSIENT_LOCAL
History: KEEP_LAST | KEEP_ALL
Depth: KEEP_LAST일 때 사용
Deadline: 숫자 + ns/us/ms/s
Lifespan: 숫자 + ns/us/ms/s
Liveliness: SYSTEM_DEFAULT | AUTOMATIC | MANUAL_BY_TOPIC
Lease Duration: 숫자 + ns/us/ms/s
```

비어 있는 고급 duration은 Jazzy/rclpy profile 기본값을 유지한다. 선택된 8개 값은 실제 `QoSProfile`과
entity pool fingerprint에 모두 포함되므로 값이 바뀌면 이전 QoS의 Publisher, Subscription, ServiceClient,
ActionClient를 잘못 재사용하지 않는다.

### Topic Auto

Topic은 로컬 역할의 반대편 Graph endpoint를 읽는다.

```text
Publish  → 외부 Subscription QoS와 비교
Receive  → 외부 Publisher QoS와 비교
```

Graph에서 얻은 전체 profile 후보를 `rclpy.qos.qos_check_compatible()`로 비교해 가장 많은 endpoint와
호환되는 profile을 고른다. 모든 endpoint와 호환되면 `compatible`, 일부만 호환되면 `partial`, 하나도
호환되지 않으면 `incompatible`이다. 상대 endpoint가 없으면 해당 Topic 용도의 명시적 기본 profile을 쓴다.

### Service Auto

Fast DDS observer가 Service server의 두 endpoint를 제공한다.

```text
원격 Request Reader  ↔ Dashboard Request Writer
원격 Response Writer ↔ Dashboard Response Reader
```

`rclpy.create_client()`는 Request와 Response에 하나의 `QoSProfile`만 받는다. 따라서 원격 profile 하나를
그대로 복사하지 않고, 두 방향을 동시에 만족하는 범위에서 발견값에 가장 가까운 값을 선택한다.

| 정책 | Auto 적용 |
|---|---|
| Reliability | Request의 요구 이상, Response의 제공 이하인 발견값 기반 profile |
| Durability | Request의 요구 이상, Response의 제공 이하인 발견값 기반 profile |
| Deadline | Request가 허용하는 기간 이하이고 Response 제공 기간 이상인 값 |
| Liveliness | Request 요구 이상, Response 제공 이하인 Jazzy 지원 값 |
| Lease Duration | Request가 허용하는 기간 이하이고 Response 제공 기간 이상인 값 |
| Lifespan | 원격 Response Writer에서 발견한 값; 여러 Writer이면 조기 만료를 피하는 가장 긴 값 |
| History | Fast DDS Discovery에서 알 수 없으므로 local Service 기본값 |
| Depth | Fast DDS Discovery에서 알 수 없으므로 local Service 기본값 |

`infinite` duration은 rclpy의 명시적 Infinite duration으로 전달한다. 한 방향만 발견된 경우에도 확인된
정책은 버리지 않고 적용하며, 반대 방향에 관한 제약만 두지 않는다. 두 방향을 단일 profile로 만족할 수 없거나
observer에서 endpoint를 전혀 찾지 못한 경우에만 ROS2 Service 기본 profile로 전체 fallback하고 그 사유를
실행 결과에 표시한다.

Lifespan은 DDS Writer 정책이다. Service Client의 단일 profile 제약 때문에 Response Writer에서 관찰한 값을
Client profile에 전달하지만, 이는 원격 Request Reader가 요구한 값이라는 뜻은 아니다. History와 Depth는
Discovery 값으로 추정하지 않는다.

### Action Auto

Action을 단일 QoS로 취급하지 않고 `ActionClient`의 5개 profile을 각각 선택한다.

| 내부 채널 | 발견 및 선택 방식 |
|---|---|
| Goal Service | 해당 내부 Service의 Fast DDS Request/Response 기반 Service Auto |
| Result Service | 해당 내부 Service의 Fast DDS Request/Response 기반 Service Auto |
| Cancel Service | 해당 내부 Service의 Fast DDS Request/Response 기반 Service Auto |
| Feedback Topic | Graph Publisher QoS 기반 Topic Auto |
| Status Topic | Graph Publisher QoS 기반 Topic Auto |

Manual에서도 Goal, Result, Cancel, Feedback, Status를 개별 profile로 유지한다. UI의 Service QoS와 Topic QoS는
화면 그룹일 뿐 세 Service profile을 하나로 강제하지 않는다.

## Fallback 정책

- Topic 상대 endpoint 미발견: 해당 Topic 용도의 명시적 기본 profile
- Service/Action Service endpoint 전체 미발견: `qos_profile_services_default`
- Service History/Depth: Discovery로 알 수 없으므로 local Service 기본값
- 부분 발견: 확인된 정책은 적용하고 확인되지 않은 정책만 local 기본값
- 단일 Client profile로 두 방향을 만족할 수 없음: Service 기본 profile 전체 fallback 및 사유 표시

Fallback은 Remote QoS로 표시하지 않는다. 실행 결과에는 `QoS Mode`, `Remote QoS`, `Dashboard 실행 QoS`,
`fallback_reason`을 분리한다.

## 객체 재사용

- Topic Publisher/Subscription은 name/type과 QoS fingerprint가 같을 때만 재사용한다. 값이 바뀌면 기존 entity를
  destroy하고 새 profile로 생성한다.
- ServiceClient pool key에는 Service name/type과 8개 QoS 값이 포함된다.
- ActionClient pool key에는 Goal/Result/Cancel/Feedback/Status 5개 profile의 8개 QoS 값이 모두 포함된다.
- Auto에서 Discovery 결과가 바뀌어 fingerprint가 달라지면 다음 실행에서 새 Client가 생성된다.

Service와 Action Client의 호환 상태는 Client 생성 또는 상대 endpoint QoS signature 변경 시 계산해 Runtime에
저장한다. 정기 snapshot 조립은 Fast DDS observer나 rclpy Graph를 다시 조회하지 않고 저장된 `qos_status`,
`local_qos`, `qos_detection_source`를 읽는다. Action은 profile별 pool 삽입 순서가 아니라 리소스별 마지막 실행
Client를 기준으로 5채널 상태를 공개하므로, 과거 incompatible Client가 최신 compatible 상태를 덮어쓰지 않는다.

## 실행 결과의 의미

- Topic의 `success`, `published`, `sent_to_topic`은 로컬 `Publisher.publish()` 호출 성공을 뜻한다. DDS는
  Subscriber별 수신 확인을 이 결과로 반환하지 않으므로 QoS가 맞지 않는 Subscriber는 수신하지 못할 수 있다.
- Service는 `service_is_ready()`가 false면 `call_async()` 전에 종료하며 `sent_to_server=false`로 기록한다.
- Action은 `server_is_ready()`가 false면 Goal을 보내지 않는다. Goal 채널이 compatible이면 다른 Result, Cancel,
  Feedback, Status 채널이 incompatible이어도 Goal 자체는 전송될 수 있으며 이후 결과 timeout, Feedback 미수신,
  Cancel 실패처럼 채널별로 나타난다.

## 표시 색상

Topic, Service, Action 상세는 공통 `QosDetails` 정책을 사용한다.

```text
초록 = DDS 또는 Graph에서 정상 발견되어 호환/관찰됨
파랑 = 실제 확인된 일반 QoS 값
청록 = 정상적인 무제한/제한 없음
회색 = 확인 불가
노랑 = 판단 불충분, 부분 발견, fallback
빨강 = 상대 QoS와 Dashboard QoS가 실제 비호환으로 판정됨
```

`BEST_EFFORT`, `RELIABLE`, `VOLATILE` 같은 값 자체는 오류색으로 표시하지 않는다. DDS Topic/Type 같은
메타데이터는 흰색 또는 연한 회색으로 낮춘다.

동일 role과 ROS/DDS 통신 scope, 동일 QoS fingerprint를 가진 endpoint는 `Subscriber × N`처럼 UI에서만
그룹화하고 공통 QoS를 한 번 표시한다. fingerprint는 Reliability, Durability, History, Depth, Deadline,
Lifespan, Liveliness, Lease Duration을 모두 구분하며 `unknown`, `null`, `infinite`, 실제 수치를 합치지 않는다.
QoS가 다르면 별도 profile 그룹으로 유지하고 Action의 Goal/Result/Cancel/Feedback/Status 채널은 서로 합치지
않는다. 접힌 Endpoint 상세에는 Node/Namespace, GUID/GID, participant, Dashboard 소유 여부와 endpoint kind를
실제 endpoint별로 표시한다.

목록의 기존 상태 셀에는 `QoS 호환`(초록), `QoS 일부 호환`(노랑), `QoS 불일치`(빨강),
`QoS 발견`(파랑), `QoS 확인 불가`(회색) 소형 배지를 함께 표시한다. `observed`는 Fast DDS/Graph에서
상대 endpoint profile을 발견했지만 Dashboard 적용 profile과의 호환성 판정 전인 상태이므로
`compatible`이나 `unknown`으로 합치지 않는다. 상세 상단은 접힌 `QosDetails`와 별개로 observed/partial/unknown/
incompatible 안내를 보여주며, 안내 또는 QoS Alert에서 진입하면 상세가 자동으로 펼쳐진다. Action은 Goal,
Result, Cancel, Feedback, Status를 각각 표시하고 Alert 진입 시 문제 채널을 펼친다.

## QoS Alert

- Alert 대상은 기존 주요/등록/감시 및 숨김 제외 정책을 그대로 사용한다.
- `partial`, `unknown`, `observed`, `graph_unavailable`, observer 미사용, fallback 자체, 미수신/timeout 추정은 제외한다.
- `incompatible`이 `alerts.qos.incompatible_confirmation_count`(기본 3)회의 서로 다른 Graph 갱신에서 연속
  확인돼야 생성한다. 같은 snapshot을 여러 번 조회해도 횟수를 중복 증가시키지 않는다.
- 일부 Graph endpoint 조합 불일치는 warning, RMW incompatible 이벤트와 Dashboard 적용 profile이 모든 상대
  endpoint와 실제로 불가능한 경우는 error다.
- compatible 복귀 또는 endpoint 소멸로 비교 불가가 되면 active Alert를 resolved 처리하며 재발 시 새 이력이 된다.

## 제한

- Fast DDS 2.14 Discovery proxy는 History와 Depth를 제공하지 않는다.
- DataReader Lifespan은 관찰할 수 없다.
- Fast DDS observer를 사용할 수 없는 RMW에서는 Service/Action Service Auto가 기본 profile로 fallback한다.
- 여러 원격 endpoint의 요구가 서로 모순되면 하나의 rclpy Client profile로 모두 만족시킬 수 없다.
- QoS timeout이나 메시지 미수신만으로 실제 QoS 비호환을 단정하지 않는다.

관련 구현:

```text
ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos.py
ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/dds_observer.py
ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/qos_profiles.py
ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/*_pool.py
frontend/src/components/QosDetails.jsx
frontend/src/features/interface-lab/execution/QosModeControl.jsx
```
