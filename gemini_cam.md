# ROS2 Dashboard Camera Topic Preview 동작 메커니즘 조사 보고서

## 1. 한 문장 결론

> **구조 D (A와 B가 결합된 수요 기반 반응형 변환, Demand-Driven Reactive)**  
> Camera Topic은 일반 Topic과 동일하게 **평소에도 상시 구독**하여 상태·Hz·메타데이터를 수집하지만 **raw 이미지 바이트는 즉시 폐기**하며, 사용자가 상세 화면을 열어 Preview를 요청하면 **3초간 Demand TTL(수요 플래그)이 활성화되어 그 시간 동안 수신되는 다음 ROS2 프레임에 한해 Base64 Data URL로 인코딩하여 응답**하는 구조입니다.

---

## 2. 실제 전체 흐름

```text
[1. 평상시 상시 모니터링]
ROS2 Graph 발견 → Monitor 자동 구독(auto-subscribe)
  ↓
ROS2 Message 수신 (rclpy callback)
  ↓
build_camera_metadata() 실행 (width, height, encoding, format, header만 추출)
  ↓
raw data 바이트 배열은 버리고 메타데이터만 entry['message_preview']에 저장 (Hz/Stale 갱신)

─────────────────────────────────────────────────────────────────────────────

[2. 사용자 상세 화면 진입 시 (Preview 요청)]
Frontend (TopicDetailPanel)
  ↓ 1초 주기 폴링 시작 (isCameraTopicType인 경우)
GET /ros/topics/image-preview?name=/camera/image_raw
  ↓
Backend (backend/app/routers/monitor_proxy.py: proxy_monitor_get)
  ↓ httpx.AsyncClient proxy
Monitor API (transport/routers/monitoring.py: get_ros_topic_image_preview)
  ↓
TopicQueryFacade.image_preview()
  ↓
entry['image_preview_requested_until'] = now + 3.0초 (Demand TTL 활성화)
  ├─ 이미 인코딩된 캐시가 있으면 → 해당 preview 응답
  └─ 없으면 → status: "awaiting_frame" 응답

─────────────────────────────────────────────────────────────────────────────

[3. Demand TTL 활성 중 새 ROS2 Message 수신 순간 (실제 이미지 변환)]
ROS2 Camera Frame 도착 (rclpy callback: _latest_message_callback)
  ↓
requested_until >= received_at 확인 (수요 활성 상태)
  ↓
encode_camera_preview() 실행
  ├─ Raw Image (rgb8/bgr8/mono8): PNG 바이너리 빌드(zlib) → Base64 인코딩
  └─ CompressedImage (jpeg/png): 바이너리 검증 → 그대로 Base64 인코딩
  ↓
entry['image_preview']에 data:image/...;base64,... 저장 (최신 1장)
  ↓
Frontend의 다음 폴링에서 'ready' data_url 수신 → <img src={data_url} /> 렌더링
```

---

## 3. Camera Topic 발견 및 Subscription 방식

### 1) Camera Topic 발견
- **판별 코드**:
  - Monitor: [camera_preview.py:L17-18](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/camera_preview.py#L17-L18) `is_camera_topic_type(topic_type)`
  - Frontend: [cameraPreviewModel.js:L17-22](file:///home/hs/rang/ros2_dashboard/frontend/src/features/topics/cameraPreviewModel.js#L17-L22) `isCameraTopicType(topicType)`
- **일반 Topic discovery와의 관계**:
  - **완전히 동일한 흐름**입니다.
  - [models.py:L10-20](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/models.py#L10-L20)의 `SUPPORTED_PREVIEW_TYPES` 및 [monitor_config.py:L18](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/monitor_config.py#L18)에 `sensor_msgs/msg/Image`, `sensor_msgs/msg/CompressedImage`가 기본 지원 타입으로 등록되어 있어 일반 Topic과 똑같이 Graph 탐색 시 자동 발견됩니다.

### 2) Subscription 방식
- **평소 상시 구독 여부**: **네, 항상 구독합니다.**
  - [runtime.py:L116-131](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/runtime.py#L116-L131)의 `collect_topic_graph()` -> [subscription_facade.py:L36-70](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/subscription_facade.py#L36-L70) `_auto_subscribe_topic()`을 통해 Graph에서 발견되는 즉시 자동 구독(`ensure_subscription`)됩니다.
- **Subscription 수명주기**:
  - **생성**: Graph에서 Topic이 발견되는 즉시 생성.
  - **해제**: Topic이 Graph에서 사라진 후 `DEFAULT_SUBSCRIPTION_CLEANUP_AFTER_SEC = 60.0초` 경과 시 [runtime.py:L171-183](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/runtime.py#L171-L183) 및 `cleanup_disappeared_subscriptions()`에 의해 `destroy_subscription()` 실행.
- **Callback 위치**:
  - [subscription_facade.py:L117-163](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/subscription_facade.py#L117-L163) `_latest_message_callback()`

---

## 4. 이미지 데이터 저장 및 캐시 방식

- **Raw payload 저장 위치**: **영구 저장하거나 캐시하지 않습니다.**
  - 평상시 콜백에서는 [preview.py:L20-26](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/preview.py#L20-L26)의 `build_message_preview()` -> [camera_preview.py:L21-36](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/camera_preview.py#L21-L36) `build_camera_metadata()`를 호출하여 `width`, `height`, `encoding`, `step`, `format`, `header`만 남긴 dict를 만들어 `entry['message_preview']`에 저장하고, 수백 KB~수 MB의 **raw binary `data` 배열은 즉시 폐기**됩니다.
- **Cache 구조**:
  - `TopicRuntime` 내부의 `self._subscriptions[name]` dict를 공유합니다.
  - 일반 `latest` 메타데이터: `entry['message_preview']`
  - 인코딩된 이미지 Preview: `entry['image_preview']`
- **유지 개수 및 메모리 수명**:
  - Preview 요청이 활성화되어 있을 때만 **최신 인코딩 결과 1개**(`data_url` 포함 dict)를 `entry['image_preview']`에 유지합니다.
  - 사용자가 상세창을 닫아 `image_preview_requested_until` (TTL 3.0초)이 지나면, 다음 콜백 수신 시 [subscription_facade.py:L131-133](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/subscription_facade.py#L131-L133)에서 `entry.pop('image_preview', None)`으로 메모리에서 즉시 삭제됩니다.

---

## 5. Preview 요청 처리 및 함수 단위 추적

1. **Frontend 요청 시작**:
   - 사용자가 Camera Topic 선택 시 [useTopicDashboard.js:L88-102](file:///home/hs/rang/ros2_dashboard/frontend/src/hooks/useTopicDashboard.js#L88-L102)에서 1초 주기의 `usePolling` 활성화.
   - [monitoring.js:L7](file:///home/hs/rang/ros2_dashboard/frontend/src/api/monitoring.js#L7) `fetchTopicImagePreview(name)`가 `GET /ros/topics/image-preview?name=...` 호출.
2. **Backend Proxy**:
   - [monitor_proxy.py:L35-37](file:///home/hs/rang/ros2_dashboard/backend/app/routers/monitor_proxy.py#L35-L37) `proxy_monitor_get()` -> `proxy_monitor()`.
   - `monitor_client.request_async('GET', '/ros/topics/image-preview?name=...')`를 통해 Monitor 포트(8765)로 비동기 HTTP 요청 전달.
3. **Monitor Router**:
   - [transport/routers/monitoring.py:L43-46](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/monitoring.py#L43-L46) `get_ros_topic_image_preview()`.
   - [ros_monitor.py:L276-278](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros_monitor.py#L276-L278) `RosMonitor.image_preview()` 호출.
4. **Monitor TopicRuntime & Demand 활성화**:
   - [query_facade.py:L110-165](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/query_facade.py#L110-L165) `TopicQueryFacade.image_preview()`:
     - `entry['image_preview_requested_until'] = time() + 3.0` (TTL 설정).
     - 현재 `entry`에 `image_preview`가 있으면 해당 객체를, 아직 없으면 `status: 'awaiting_frame'` 객체를 담아 `_image_preview_response()` 반환.
5. **실제 이미지 인코딩 (Callback 수신 시)**:
   - Demand TTL이 켜진 후 ROS2 메시지가 도착하면 [subscription_facade.py:L134-146](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/subscription_facade.py#L134-L146)에서 `encode_camera_preview()` 실행.
   - [camera_preview.py:L39-64](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/camera_preview.py#L39-L64) `encode_camera_preview()`가 base64 Data URL을 생성하여 `entry['image_preview']`에 저장.
6. **Frontend 렌더링**:
   - 다음 폴링 주기에서 변환 완료된 `data_url`을 수신.
   - [CameraTopicPreview.jsx:L7-54](file:///home/hs/rang/ros2_dashboard/frontend/src/features/topics/CameraTopicPreview.jsx#L7-L54)에서 `<img src={image.data_url} />`로 표시.

---

## 6. Image / CompressedImage 처리 차이

| 구분 | `sensor_msgs/msg/Image` (Raw Image) | `sensor_msgs/msg/CompressedImage` |
|---|---|---|
| **처리 함수** | [camera_preview.py:L66-116](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/camera_preview.py#L66-L116) `_encode_raw_image` | [camera_preview.py:L118-141](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/camera_preview.py#L118-L141) `_encode_compressed_image` |
| **지원 형식** | `rgb8`, `bgr8`, `mono8` (3종 지원) | `jpeg` / `jpg`, `png` |
| **필드 처리** | • `width`, `height`: 해상도 검증 (기본 최대 1920×1080)<br>• `encoding`: 지원 포맷 여부 확인<br>• `step`: 행 바이트 수 및 전체 길이 검증 (`step * height`)<br>• `data`: 순수 Python `zlib`로 PNG scanline 조립 및 압축 | • `format`: 문자열에 `jpeg`/`png` 포함 여부 확인<br>• `data`: Magic byte (`\xff\xd8\xff` 또는 `\x89PNG...`) 일치 여부 검증 |
| **변환 방식** | BGR8은 RGB 순서로 재배열하고, struct/zlib으로 **`image/png` 바이너리를 생성한 뒤 Base64 인코딩** | **디코딩/재인코딩 없이 이미 압축된 바이너리를 그대로 Base64 인코딩**하여 Data URL 생성 |
| **미지원 처리** | 그 외 encoding (예: rgba8, yuv 등)은 에러 대신 `status: 'unsupported_encoding'` 반환 | 그 외 format (예: compressedDepth, theora 등)은 `status: 'unsupported_format'` 반환 |

---

## 7. WebSocket에 이미지가 포함되는지

- **전혀 포함되지 않습니다.**
  - [snapshot.py:L23-35](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/snapshot.py#L23-L35) `copy_subscription_snapshots()`에서 `entry['message_preview']`(메타데이터)만 복사하고 `entry['image_preview']`는 스냅샷 복사 대상에서 제외됩니다.
  - [snapshot_summary.py:L37-63](file:///home/hs/rang/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/snapshot_summary.py#L37-L63) `websocket_topic_meta()` 및 [monitor_websocket.py:L14-18](file:///home/hs/rang/ros2_dashboard/backend/app/routers/monitor_websocket.py#L14-L18)을 통해 브라우저로 전송되는 WebSocket 메시지에는 카운트와 메타데이터만 포함됩니다.
  - 따라서 대용량 이미지 바이너리나 Base64 문자열이 정기 WebSocket 통신 대역폭을 낭비하지 않습니다.

---

## 8. Frontend 표시 방식

- [CameraTopicPreview.jsx:L16-29](file:///home/hs/rang/ros2_dashboard/frontend/src/features/topics/CameraTopicPreview.jsx#L16-L29)
  - `ready = image?.status === 'ready' && image.data_url`
  - `<img alt="Camera Topic preview" src={image.data_url} />` 형태로 **Base64 Data URL 문자열을 `img` 태그의 `src`에 직접 바인딩**합니다.
  - Blob이나 `URL.createObjectURL()`을 사용하지 않고 `data:image/png;base64,...` / `data:image/jpeg;base64,...` 문자열을 그대로 사용합니다.
  - 이미지를 클릭하면 [CameraPreviewModal](file:///home/hs/rang/ros2_dashboard/frontend/src/features/topics/CameraTopicPreview.jsx#L56-L173) 팝업이 열려 25%~400% 확대/축소, 화면 맞춤, 원본 크기, 중앙 정렬 viewport 스크롤을 제공합니다.

---

## 9. 현재 PPT 설명에서 잘못되거나 애매한 부분

1. **"사용자가 요청할 때만 Preview 생성"의 시점 모호성**:
   - *오해하기 쉬운 점*: "사용자가 요청 버튼을 누르면 과거에 받아둔 최신 프레임을 꺼내서 즉시 변환한다" (X)
   - *실제 동작*: 사용자가 상세 패널을 열어 요청하면 **Demand TTL(3초)이 켜지고, 그 이후에 수신되는 다음 프레임을 실시간 인코딩**하여 가져옵니다. (첫 요청 시에는 `awaiting_frame` 상태)
2. **"Topic 감시 흐름에 포함"의 데이터 범위**:
   - *오해하기 쉬운 점*: Topic 감시 흐름에 포함되어 있으니 raw 이미지 데이터도 항상 캐시되고 있을 것이다 (X)
   - *실제 동작*: Topic 감시 흐름에는 Hz/QoS/stale 및 해상도·인코딩 같은 **가벼운 메타데이터만 상시 수집**되며, 대용량 이미지 raw bytes는 버려집니다.

---

## 10. 추천 PPT 문구

```text
• sensor_msgs/msg/Image 및 CompressedImage 지원
• Topic 상시 감시 흐름 유지: Hz, 수신 주기, Stale 및 해상도·인코딩 메타데이터 실시간 수집
• 수요 기반(Demand-Driven) 프리뷰: 상세 화면 조회 시에만 Demand TTL(3초)을 활성화하여 수신 프레임을 Base64 Data URL로 인코딩
• 대역폭 최적화: 정기 WebSocket snapshot에는 이미지를 싣지 않고 전용 On-Demand REST API로만 분리 전송
• 포맷 지원: Raw Image(rgb8, bgr8, mono8) → PNG 변환 / CompressedImage(JPEG, PNG) → 무변환 패스스루
```

---

## 해당 코드 작업에서 내가 알아야 할 것 3줄 요약

1. **Camera Topic은 평소에도 상시 구독되지만, 메타데이터만 남기고 대용량 raw payload는 즉시 버려 메모리를 보호한다.**
2. **Preview는 상세 화면 요청 시 활성화되는 3초 Demand TTL 동안 수신된 프레임을 Monitor 콜백에서 Base64 Data URL(PNG/JPEG)로 변환해 1장만 캐시한다.**
3. **정기 WebSocket snapshot에는 이미지가 전혀 포함되지 않으며, Frontend는 전용 REST API를 통해 받은 Data URL을 `<img src={...}>`로 직접 렌더링한다.**
