# Fast DDS passive Service/Action QoS observer

## 구조

```text
Fast DDS EDP Discovery
→ ros2_dashboard_dds_observer (C++, DomainParticipantListener)
→ http://127.0.0.1:8766/snapshot
→ ros2_dashboard_monitor
→ 기존 snapshot / Backend / Frontend
```

Observer는 Dashboard와 같은 `ROS_DOMAIN_ID`에 `DomainParticipant`만 생성한다. 사용자 데이터용
DataWriter/DataReader, Service Client, ActionClient, Service Call, Action Goal은 생성하거나 전송하지 않는다.
localhost HTTP endpoint는 Browser나 FastAPI Backend에 공개하지 않고 Monitor만 polling한다.

## ROS Graph와 DDS Discovery 역할

- 일반 Topic과 Action Feedback/Status Topic: 기존 rclpy Graph endpoint QoS를 사용한다.
- Service와 Action Goal/Result/Cancel: Fast DDS의 `rq/...Request`, `rr/...Reply` endpoint를 observer가 수집한다.
- Service server 측 request DataReader와 response DataWriter만 Remote DDS QoS로 공개한다.
- Interface Lab이 실제 Client를 만든 경우에만 별도의 Dashboard 적용 `local_qos`를 표시한다.
- Service/Action endpoint는 실제 GUID와 GUID에서 얻은 participant identity를 공개한다. 같은 QoS endpoint가
  여러 개여도 identity가 다르면 데이터를 제거하지 않고 Frontend 표시에서만 profile별로 그룹화한다.

## QoS 가시성

| 정책 | Fast DDS Discovery 값 |
|---|---|
| Reliability | 실제 광고값 |
| Durability | 실제 광고값 |
| Deadline | 실제 광고값 또는 infinite |
| Liveliness | 실제 광고값 |
| Liveliness lease duration | 실제 광고값 또는 infinite |
| Lifespan | DataWriter 실제 광고값 또는 infinite, DataReader는 unknown |
| History | `unknown` |
| Depth | `null` |

History와 Depth는 Fast DDS 2.14 Discovery proxy에 없으므로 Service 기본 profile 값으로 채우지 않는다.

## 설정과 장애 처리

`ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml`의 `fastdds_observer`에서 enable, localhost port,
polling 주기와 timeout을 설정한다. helper 실행 파일이 없거나 응답하지 않거나 현재 RMW가
`rmw_fastrtps_cpp`가 아니면 Service와 Action Service QoS만 `graph_unavailable`로 유지한다. Topic Graph QoS와
나머지 Dashboard 기능은 계속 동작한다.

이 구현은 Fast DDS의 vendor discovery callback과 ROS2 Fast DDS 이름 규칙에 종속된다. Cyclone DDS 등 다른
RMW에서는 별도 adapter가 필요하며, DDS가 아닌 RMW에서는 이 helper를 사용할 수 없다. DDS Security,
Discovery Server, Domain 또는 네트워크 범위가 endpoint 발견을 차단하면 해당 QoS도 확인할 수 없다.
