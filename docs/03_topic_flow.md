# Topic Monitoring 흐름

## 1. 기능을 한 문장으로 설명

Topic Monitoring은 ROS2 Topic을 발견하고, 지원하는 메시지를 실제로 구독해 마지막 값, 수신 시각, Hz, missing/stale 상태를 화면에 전달한다.

Subscription은 “메시지를 받기 위해 Topic에 연결하는 구독 객체”다. 여기의 자동 Subscription은 관찰용이며 Interface Lab Receive와 별개다.

## 2. 전체 흐름

```text
ROS2 Publisher
→ ROS2 Graph에서 Topic 발견
→ include/exclude와 타입 확인
→ 자동 Subscription 생성
→ callback 메시지 수신
→ ROS 메시지를 dict로 변환
→ latest/timestamp cache 저장
→ Hz와 missing/stale 계산
→ /ros/topics, latest, hz 응답
→ Frontend Topic 목록과 상세
```

## 3. 단계별 쉬운 설명

### 1) 감시할 메시지 타입을 합친다

- 파일: `config_loader.py L191~L288`
- 파일: `config_loader.py L289~L330`
- 역할: `monitor.yaml` 기본 타입과 `interface_registry.yaml`, `interface_packages.yaml`의 `import_available=true` msg 타입을 합친다.
- 왜 필요한가: `/odom` 같은 기본 타입뿐 아니라 `rths_interfaces/msg/CleaningSchedule` 같은 등록 custom msg도 같은 방식으로 감시하기 위해서다.
- 다음 흐름: `TopicRuntime.update()`가 Graph 타입과 비교한다.

### 2) ROS2 Graph에서 Topic을 발견한다

- 파일: `topic/runtime.py L125~L231`
- 역할: `get_topic_names_and_types()` 결과에 include/exclude를 적용하고 endpoint 수, 타입 지원 여부, 현재 상태를 계산한다. `RosMonitor.snapshot()`은 활성 Node 관계를 역집계해 Publisher/Subscriber Node 수를 추가한다.
- 제외: `exclude_names` exact match, `exclude_prefixes` prefix match, `exclude_types`의 Graph type match를 적용한다. 명시적인 빈 목록은 그대로 유지한다.
- 입력: Topic 이름, `full_type`, endpoint 수
- 출력: Topic item 목록

### 3) 지원 타입이면 Subscription을 만든다

- 파일: `topic/runtime.py L320~L371`
- 파일: `topic/runtime.py L372~L467`
- 역할: 현재 Graph 타입이 지원 타입과 정확히 같고 Python message class를 import할 수 있으면 Subscription을 생성하거나 기존 것을 재사용한다.
- 다음 흐름: 메시지가 오면 `_latest_message_callback()`이 실행된다.

### 4) callback이 메시지를 저장한다

- 파일: `topic/runtime.py L506~L523`
- 역할: 수신 시각을 기록하고 메시지를 preview dict로 바꾼 뒤 timestamp window에 추가한다.
- 파일: `topic/preview.py L15~L21`
- 역할: 기본 타입은 읽기 쉬운 전용 preview를 사용하고, 등록 custom msg는 `message_to_ordereddict()`로 전체 필드를 dict로 바꾼다.

예를 들어 `/demo_cleaning_schedule`의 다음 값은 빈 `{}`가 아니라 실제 필드로 저장된다.

```json
{
  "scheduling_id": 50,
  "scheduling_dt": "2026-07-27 09:24:31",
  "count": 49,
  "is_active": true
}
```

### 5) latest와 Hz를 계산한다

- 파일: `topic/runtime.py L232~L319`
- 파일: `topic/runtime.py L524~L563`
- 파일: `topic/hz.py L14~L70`
- 역할: 마지막 메시지, `last_received_at`, 최근 timestamp 사이 간격으로 Hz를 계산한다.
- 주의: 지원 타입이어도 첫 메시지가 오기 전에는 “미지원”이 아니라 “아직 수신 없음”이다.

### 6) missing과 stale Alert를 만든다

- 파일: `topic/alerts.py L27~L57`
- 파일: `topic/alerts.py L161~L281`
- 정책 목록: `monitor.yaml`의 `topics.required_stream_names`, `topics.command_names`
- 조건:
  - `topic_message_missing`: Publisher가 있고 Subscription도 만들었지만 제한 시간 동안 한 번도 받지 못함
  - `topic_stale`: 이전에는 받았지만 `stale_timeout_sec`보다 오래 새 메시지가 없음
  - `topic_disconnected`: 이전에 발견한 주요 Topic이 Graph에서 사라짐
- 출력: warning 또는 error Alert

### 7) REST가 Topic snapshot을 반환한다

- 파일: `routers/monitoring.py L16~L40`
- `/ros/topics`: 목록과 `last_message_preview`
- `/ros/topics/latest`: 선택 Topic의 최신 메시지
- `/ros/topics/hz`: 선택 Topic의 Hz와 마지막 수신 시각

### 8) Frontend가 목록과 상세에 표시한다

- 파일: `hooks/useTopicDashboard.js L17~L178`
- 역할: Topic 목록은 1초마다, Node 관계는 3초마다 요청한다. 선택 Topic만 latest/Hz를 추가 요청한다.
- 파일: `components/TopicTable.jsx L46~L146`
- 역할: Publisher/Subscriber Node 수, 상태, Hz, 상세 감시, 마지막 값, 마지막 확인을 표시한다. 마지막 값 클릭 시 전체 JSON popup을 연다.
- 파일: `components/TopicDetailPanel.jsx L11~L192`
- 역할: 선택 Topic의 latest, Hz, Node 관계 수와 endpoint 진단값을 자세히 표시한다.

## 4. `/odom` 또는 custom msg의 끝까지 추적

```text
/odom Publisher 또는 /demo_cleaning_schedule Publisher
→ topic/runtime.py L125~L231: Graph 발견
→ topic/runtime.py L372~L400: Subscription 준비
→ topic/runtime.py L506~L523: callback 수신
→ topic/preview.py L15~L21: dict 변환
→ topic/runtime.py L75~L105: snapshot에 last_message_preview 포함
→ routers/monitoring.py L16~L28: /ros/topics 응답
→ rosApi.js L45~L55: Frontend API 호출
→ useTopicDashboard.js L17~L163: polling state 저장
→ TopicTable.jsx L46~L146: 마지막 값 표시
→ TopicDetailPanel.jsx L11~L192: 상세 표시
```

## 5. 입력 데이터

- Topic 이름과 msg full type
- Publisher/Subscriber 수
- ROS message 객체
- 지원 타입 YAML과 timeout 설정

## 6. 처리 과정

Graph에 있는 Topic만 새 Subscription 후보가 된다. callback은 메시지와 수신 시각을 cache에 저장한다. Graph에서 사라진 Topic은 `resource_state.py L11~L44`의 발견 이력을 이용해 `disconnected`로 남기고 Subscription은 `topic/runtime.py L468~L505`에서 정리한다.

## 7. 출력 데이터

- `last_message_preview`
- `last_received_at`
- `hz`, `received`, `message_count`
- `supported_type`, `deep_monitoring`
- `status`, `graph_present`, `disconnected_at`
- `publisher_node_count`, `subscriber_node_count`
- `publisher_endpoint_count`, `subscriber_endpoint_count`
- 내부/외부 Subscriber Node·endpoint 수
- Topic Alert

## 8. 다음 단계와 연결

Topic Alert의 active/resolved 처리는 [07_alert_flow.md](07_alert_flow.md), Interface Lab의 사용자 Publish/Receive는 [12_interface_lab_flow.md](12_interface_lab_flow.md)로 이어진다.

## 9. 핵심 요약

1. YAML 등록 custom msg도 import 가능하고 Graph 타입이 정확히 같으면 자동 구독한다.
2. 마지막 값, 수신 시각, Hz는 같은 callback cache에서 나온다.
3. Frontend는 REST 필드 `last_message_preview`를 그대로 표시한다.
