# Topic 흐름

## 수집과 목록

```text
rclpy Graph topic/endpoint
→ TopicRuntime.update()
→ 자동 Subscription과 callback
→ latest / Hz / age / reception_diagnosis
→ RosMonitor.snapshot()
→ Monitor transport snapshot
→ Backend cache
→ Topics 화면
```

| 단계 | 현재 코드 위치 | 역할 |
|---:|---|---|
| 1 | `ros2_topic/runtime.py TopicRuntime.update()` L103-L140 | Graph 수집 결과를 현재 cache와 병합하고 사라진 Topic 처리 |
| 2 | `ros2_topic/graph_collector.py` | 이름/type/filter, endpoint와 QoS, 감시 대상 수집 |
| 3 | `ros2_topic/subscription_lifecycle.py` | 지원·등록 type의 자동 Subscription 생성·정리 |
| 4 | `ros2_topic/subscriptions.py update_subscription_entry()` L41-L56 | callback timestamp와 preview cache 갱신 |
| 5 | `ros2_topic/hz.py` L14-L71 | window timestamp, Hz, age, stale 계산 |
| 6 | `ros2_topic/snapshot.py` | lightweight latest metadata와 진단 상태 조립 |
| 7 | `snapshot_assembler.py enrich_topic_snapshot()` L21-L85 | Node 관계, primary, Interface Lab 상태 병합 |
| 8 | `transport/routers/monitoring.py` L16-L46 | Topic 목록/latest/Hz/image-preview API |
| 9 | `frontend/src/hooks/useTopicDashboard.js` L21-L203 | 목록·Alert·Node·latest·Hz·Camera polling |
| 10 | `frontend/src/pages/TopicsPage.jsx` L16-L186 | 주요/전체, 검색, 상태 필터, 목록·상세 표시 |

## 상태와 Alert

Graph 원본 `status`는 `ros2_topic/models.py topic_status()` L49-L67에서 계산하고, 목록 대표
`effective_status`는 `ros2_topic/snapshot.py _effective_status()` L157-L177에서 실제 수신 상태를 합친다.

- Graph status: `active`, `no_subscriber`, `waiting_publisher`, `inactive`
- Effective status `never_received`: deep monitoring Subscription이 stale timeout 동안 한 번도 받지 못함
- Effective status `stale`: 이전 수신은 있으나 마지막 수신 age가 timeout 초과
- `disconnected`: 이전에 Graph에 보였던 Topic이 debounce 뒤 사라진 보존 상태
- 일반 Subscriber 없음은 장애가 아니다.

Alert 조립은 `ros2_topic/alerts.py build_alerts()` L28-L58,
`_topic_alerts()` L61-L138, `_topic_message_alerts()` L141-L192가 담당한다.
수신 Alert는 required stream 또는 등록 Interface 감시 대상만 만들며 command Topic은 제외한다.
설정에 이름만 있고 Graph에서 한 번도 발견되지 않은 Topic은 목록이나 Alert placeholder로 만들지 않는다.

## 수와 Dashboard endpoint

`publisher_count/subscriber_count`는 raw endpoint 수다. 기본 목록의
`publisher_node_count/subscriber_node_count`는 `topology.py` L19-L54와
`snapshot_assembler.py` L21-L85에서 Dashboard 내부 Node를 제외해 계산한 고유 Node 수다.
Interface Lab의 Receive/Publisher 생성 여부는
`interface_lab/execution/topic_runtime.py dashboard_state_by_topic()` L124-L129에서 별도로 합친다.

Frontend 기본 목록은 상태, 이름, type, Publisher/Subscriber Node 수, Hz, 마지막 값, 마지막 수신을 보여준다.
raw payload 전체, endpoint와 QoS profile은 클릭 preview나 우측 상세에서 본다.

## Camera Preview

`sensor_msgs/msg/Image`와 `sensor_msgs/msg/CompressedImage`도 같은 discovery·Subscription·Hz·stale
경로를 사용한다. 정기 snapshot에는 binary data와 data URL을 넣지 않는다.

```text
선택한 Topic 상세
→ GET /ros/topics/image-preview?name=... 를 100ms 간격으로 요청
→ callback이 최신 frame 하나만 최대 10 FPS로 변환
→ PNG/JPEG data URL
→ 상세 닫기/다른 Topic 선택 시 DELETE /ros/topics/image-preview
```

구현은 `ros2_topic/camera_preview.py`, Monitor route는
`transport/routers/monitoring.py` L43-L46, Frontend는
`features/topics/CameraTopicPreview.jsx`다. Raw encoding은 `rgb8`, `bgr8`, `mono8`,
CompressedImage는 magic byte가 맞는 JPEG/JPG와 PNG만 표시한다.
