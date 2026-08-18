# DDS / QoS 안내

ROS2 Dashboard는 실행 환경이 선택한 RMW를 사용한다. 일반 Topic과 Action Feedback/Status는 rclpy Graph
endpoint를 관찰하고, Service와 Action Goal/Result/Cancel은 선택적으로 Fast DDS passive observer의 discovery
정보를 사용한다.

- Monitoring은 관찰과 판정을 담당하며 사용자 요청을 보내지 않는다.
- Interface Lab은 사용자가 명시적으로 실행한 Publish, Receive, Call, Goal에 Auto/Manual QoS를 적용한다.
- `partial`, `unknown`, `observed`, observer 미사용과 fallback 자체는 오류가 아니다.
- 확정된 `incompatible`만 설정된 연속 확인 횟수를 거쳐 QoS Alert가 된다.
- 화면은 같은 role/scope와 QoS fingerprint의 실제 endpoint를 `× N`으로 묶지만 GUID/GID가 다른 endpoint 데이터는
  삭제하지 않는다. identity는 접힌 Endpoint 상세에서 확인한다.
- Fast DDS observer는 `rmw_fastrtps_cpp` endpoint naming에 종속되며 다른 RMW에서는 Service/Action Service 채널이
  `graph_unavailable`일 수 있다.

상세 정책은 [`docs/qos/dds_qos.md`](docs/qos/dds_qos.md), observer 제한은
[`docs/qos/fastdds_passive_observer.md`](docs/qos/fastdds_passive_observer.md)를 기준으로 한다.
