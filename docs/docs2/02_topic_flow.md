# Topic 흐름

## 한 문장으로 보기

Topic Runtime은 Graph에서 Topic과 endpoint 수를 발견하고 지원 타입을 자동 구독해 메시지·수신 시각을 저장하며, `RosMonitor`는 Node 관계 Cache를 반대로 집계하되 Dashboard 내부 Node를 제외한 Publisher/Subscriber Node 수를 API에 추가한다.

## 쉬운 용어

| 용어 | 뜻 |
|---|---|
| Publisher | Topic으로 메시지를 보내는 역할 |
| Subscriber | Topic 메시지를 받는 역할 |
| subscription | Subscriber endpoint를 실제로 생성한 객체 |
| deep monitoring | Dashboard가 직접 구독해 latest·Hz·stale까지 확인하는 감시 |
| Hz window | 최근 몇 초의 수신 시각을 계산에 사용할지 정한 창 |
| Dashboard 내부 통신 | 자동 감시 또는 Interface Lab 실행을 위해 Dashboard Node가 만든 publisher/subscriber endpoint |
| Dashboard 제외 Node 수 | 실제 ROS2 시스템의 참여 관계를 보기 위해 Dashboard 내부 Node를 빼고 계산한 고유 Node 수 |

## Graph 발견부터 목록 표시까지

```text
get_topic_names_and_types()
→ include/exclude/type 필터
→ publisher/subscriber endpoint 수
→ 필요하면 create_subscription()
→ Topic Cache
→ RosMonitor가 Node 수 병합
→ GET /ros/topics
→ Topic 화면
```

1. **Topic 발견:** `get_topic_names_and_types()`로 현재 Graph의 Topic 이름과 Message 타입을 가져온다.

2. **감시 대상 판정:** include·exclude 설정을 적용하고 지원 타입 또는 등록 타입인지 확인한다.

3. **endpoint와 자동 구독:** Publisher·Subscriber 수를 읽고 상세 감시 가능한 타입에는 Dashboard subscription을 생성한다.

4. **Topic Cache:** 상태와 endpoint 수를 저장하고 이전에 있었지만 사라진 Topic은 `disconnected`로 보존한다.

5. **Node 관계 병합:** Node Cache에서 Publisher·Subscriber Node를 찾아 Dashboard 내부 Node를 제외한 수를 추가한다.

6. **API와 화면:** `GET /ros/topics`가 snapshot을 반환하고 Frontend가 주요·전체·검색 필터를 적용한다.

| 단계 | 파일·함수 | 함수 전체 L | 핵심 L | 먼저 볼 내용 |
|---:|---|---:|---:|---|
| 1 | `topic/runtime.py` `update()` | `topic/runtime.py` L125-L230 | `topic/runtime.py` L127-L151 | Graph에서 Topic 이름·타입을 읽고 이름·prefix·타입 제외 설정을 적용한다. |
| 2 | `topic/runtime.py` `update()` | `topic/runtime.py` L125-L230 | `topic/runtime.py` L153-L162 | 지원 타입과 Registry 등록 타입을 판정하고 자동 subscription 여부를 결정한다. |
| 3 | `topic/runtime.py` `update()` | `topic/runtime.py` L125-L230 | `topic/runtime.py` L163-L186 | Publisher·Subscriber endpoint와 내부·외부 구독 수를 계산해 Topic item을 만든다. |
| 4 | `topic/runtime.py` `update()` | `topic/runtime.py` L125-L230 | `topic/runtime.py` L187-L219 | 현재 통신 관계가 있으면 발견 상태를 기록하고, 이전에 있었지만 사라진 Topic은 `disconnected`로 보존한다. |
| 5 | `topic/runtime.py` `update()` | `topic/runtime.py` L125-L230 | `topic/runtime.py` L221-L230 | 완성한 목록을 정렬해 Runtime Cache를 교체하고 불필요한 subscription 정리를 요청한다. |
| 6 | `topic/runtime.py` `snapshot()` | `topic/runtime.py` L75-L104 | `topic/runtime.py` L77-L103 | Topic Cache에 latest preview·마지막 수신 시각·수신 여부를 합쳐 Runtime snapshot을 만든다. |
| 7 | `ros_monitor.py` `snapshot()` | `ros_monitor.py` L126-L209 | `ros_monitor.py` L128-L208 | Dashboard 내부 Node를 제외한 Node 수·목록, 원본 endpoint 수, 자동 감시와 Interface Lab 수신·발행 상태를 병합한다. |
| 8 | `monitoring.py` `get_ros_topics()` | `monitoring.py` L16-L28 | `monitoring.py` L19-L27 | Topic snapshot을 기존 `/ros/topics` API 응답 구조로 반환한다. |
| 9 | `useTopicDashboard.js` → `TopicsPage.jsx` | `useTopicDashboard.js` L17-L164 → `TopicsPage.jsx` L14-L187 | `useTopicDashboard.js` L25-L65, `TopicsPage.jsx` L33-L83 | Frontend가 Topic·Node API를 polling하고 상세 참여 Node에서도 내부 Node를 제외한 뒤 주요·전체·검색·상태 필터를 적용한다. |

이 표로 전체 방향을 먼저 파악하고, 자동 구독·Dashboard 내부 endpoint 분류·Hz 계산처럼 헷갈리는 부분만 아래의 상세 표에서 확인한다.

## 메시지 수신과 Hz

```text
메시지 callback
→ 현재 시각 저장
→ 오래된 timestamp 제거
→ 남은 개수 ÷ hz_window_sec
→ /ros/topics/hz
```

1. **메시지 수신:** 자동 감시 callback이 최신 값과 현재 수신 시각을 저장한다.

2. **timestamp 관리:** 수신 시각을 추가하고 Hz 계산 창보다 오래된 timestamp는 제거한다.

3. **Hz와 stale:** 계산 창의 메시지 수를 창 길이로 나누고 마지막 수신 경과 시간으로 stale을 판단한다.

4. **Hz API:** Hz, 메시지 수, 마지막 수신 시각과 상태를 `/ros/topics/hz`로 반환한다.

| 단계 | 파일·함수 | 함수 전체 L | 실제 핵심 L | 의미 |
|---:|---|---:|---:|---|
| 1 | `topic/runtime.py` `_latest_message_callback()` | `topic/runtime.py` L506-L522 | `topic/runtime.py` L507-L520 | 메시지 변환 후 수신 시각과 preview 저장 |
| 2 | `topic/subscriptions.py` `update_subscription_entry()` | `topic/subscriptions.py` L39-L54 | `topic/subscriptions.py` L46-L53 | timestamp 목록 갱신 |
| 3 | `topic/hz.py` `recent_timestamps()` | `topic/hz.py` L14-L22 | `topic/hz.py` L19-L22 | 계산 창보다 오래된 시각 제거 |
| 4 | `topic/hz.py` `build_hz_snapshot()` | `topic/hz.py` L42-L71 | `topic/hz.py` L49-L59 | `message_count / window_sec` 계산 |
| 5 | `topic/runtime.py` `topic_hz()` | `topic/runtime.py` L283-L318 | `topic/runtime.py` L317-L318 | 구독 확보 후 Hz snapshot 반환 |
| 6 | `monitoring.py` `get_ros_topic_hz()` | `monitoring.py` L37-L40 | `monitoring.py` L40 | `/ros/topics/hz` 응답 |

현재 기본 5초 창에서 첫 메시지는 `1 ÷ 5 = 0.2 Hz`다. 이는 “마지막 1초 동안 받은 개수”가 아니라 “설정된 5초 창에 남은 개수를 5로 나눈 값”이다.

## Dashboard 내부 통신 집계 제외

1. **전체 endpoint:** Graph에서 해당 Topic의 전체 Subscriber endpoint 수를 읽는다.

2. **내부 endpoint:** Node 이름과 namespace를 비교해 Dashboard가 만든 감시·Lab 구독 endpoint를 찾는다.

3. **외부 통신 계산:** 전체 Subscriber 수에서 내부 endpoint 수를 빼 Topic 상태 판단에 사용한다.

4. **고유 Node 수:** Node 관계 Cache에서는 Dashboard 내부 Node를 제거한 뒤 Publisher·Subscriber Node 수를 계산한다.

5. **목적별 표시:** 제외한 내부 통신은 `자동 감시`, `Lab 수신`, `Lab 발행` 배지로 따로 표시한다.

| 단계 | 함수 전체 L | 핵심 L | 의미 |
|---:|---:|---:|---|
| 내부 endpoint 조사 | `topic/runtime.py` `_monitor_subscriber_count()` L406-L426 | `topic/runtime.py` L414-L417 | Graph 기반 소유 endpoint 계산을 우선 사용 |
| endpoint 소유 Node 비교 | `topic/runtime.py` `_owned_subscription_endpoint_count()` L429-L466 | `topic/runtime.py` L451-L466 | `node_name + namespace`가 Dashboard Node와 같은 endpoint 수 계산 |
| 외부 endpoint 계산 | `topic/runtime.py` `update()` L125-L230 | `topic/runtime.py` L163-L172 | 전체 subscriber endpoint − 내부 endpoint |
| Interface Lab 상태 | `topic_runtime.py` `dashboard_state_by_topic()` L205-L220 | `topic_runtime.py` L209-L219 | Topic별 Receive subscription과 Publisher cache 생성 상태를 목적별 boolean으로 반환 |
| API Node·상태 병합 | `ros_monitor.py` `RosMonitor.snapshot()` L126-L209 | `ros_monitor.py` L128-L208 | Dashboard 제외 Node 수·목록과 원본 endpoint 수를 유지하면서 `dashboard_communication`을 추가 |
| 상세 참여 Node 집계 | `participants.js` `buildParticipantMaps()` L1-L61 | `participants.js` L6-L12 | Hook이 `excludeInternal=true`를 전달하면 `is_internal=true`인 Node를 상세 목록에서도 제외 |
| 화면 표기 | `TopicTable.jsx` `TopicTable()` L40-L137 | `TopicTable.jsx` L73-L79, L103-L112 | Dashboard 제외 Node 수와 `Dashboard 통신` 열의 `자동 감시`, `Lab 수신`, `Lab 발행`, `미사용` 배지를 표시 |

Dashboard에는 자동 상태 감시와 Interface Lab 사용자 실행이라는 두 목적이 공존한다. 같은 Topic에 자동 감시 subscription과 명시적 Receive subscription이 함께 생기면 내부 endpoint가 두 개가 될 수 있고, 이를 일반 참여 Node로 표시하면 실제 시스템에 Subscriber가 더 있는 것으로 오해할 수 있다. 따라서 기본 표와 상세 목록은 Dashboard 내부 Node를 제외한다.

예를 들어 외부 Subscriber 없이 같은 Dashboard Node가 자동 감시와 Interface Lab Receive로 두 번 구독하면 화면의 `Subscriber Node 수 (Dashboard 제외)`는 `0`이고 `Dashboard 통신`에는 `자동 감시 · Lab 수신`이 표시된다. 이는 구독 endpoint가 전혀 없다는 뜻이 아니라 해당 Topic을 받는 다른 ROS2 Node가 없다는 뜻이다. API의 `subscriber_endpoint_count`는 Dashboard를 포함한 Graph 원본값을 유지한다.

## 주요/전체 필터

1. **주요 후보:** 지원·등록 타입, 실제 수신, Hz, active 상태처럼 감시 근거가 있는 Topic을 고른다.

2. **내부 Topic 제외:** ROS 관리 Topic과 Action 내부 status·feedback Topic은 주요 목록에서 제외한다.

3. **범위와 상태 적용:** 전체·숨김 포함 선택으로 시작 집합을 넓힌 뒤 검색과 대기·오류 조건을 적용한다.

- 주요: 내부 Topic이 아니면서 지원·등록 타입, active/수신/Hz/상세 감시 등 실제 감시 근거가 하나 이상 있는 Topic.
- 전체: Backend가 반환한 모든 Topic.
- 숨김 포함: 주요 항목을 선택한 상태에서도 전체 Topic 집합으로 범위를 넓힌다.

판정 함수 전체는 `primaryFilters.js isPrimaryTopic()` L21-L50, 실제 조건은 `primaryFilters.js` L35-L48, 내부 Topic 제외는 `primaryFilters.js` L71-L77이다.
