# Topic 흐름

## 한 문장으로 보기

Topic Runtime은 Graph에서 Topic과 endpoint 수를 발견하고 지원 타입을 자동 구독해 메시지·수신 시각을 저장하며, `RosMonitor`는 Node 관계 Cache를 반대로 집계해 Publisher/Subscriber Node 수를 API에 추가한다.

## 쉬운 용어

| 용어 | 뜻 |
|---|---|
| Publisher | Topic으로 메시지를 보내는 역할 |
| Subscriber | Topic 메시지를 받는 역할 |
| subscription | Subscriber endpoint를 실제로 생성한 객체 |
| deep monitoring | Dashboard가 직접 구독해 latest·Hz·stale까지 확인하는 감시 |
| Hz window | 최근 몇 초의 수신 시각을 계산에 사용할지 정한 창 |
| internal subscriber | Dashboard 내부 Node가 만든 구독 endpoint |
| external subscriber | Dashboard 외부 Node가 소유한 구독 endpoint |

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

| 단계 | 파일·함수 | 함수 전체 L | 핵심 L | 먼저 볼 내용 |
|---:|---|---:|---:|---|
| 1 | `topic/runtime.py` `update()` | L125-L230 | L127-L151 | Graph에서 Topic 이름·타입을 읽고 이름·prefix·타입 제외 설정을 적용한다. |
| 2 | 같은 함수 | L125-L230 | L153-L162 | 지원 타입과 Registry 등록 타입을 판정하고 자동 subscription 여부를 결정한다. |
| 3 | 같은 함수 | L125-L230 | L163-L186 | Publisher·Subscriber endpoint와 내부·외부 구독 수를 계산해 Topic item을 만든다. |
| 4 | 같은 함수 | L125-L230 | L187-L219 | 현재 통신 관계가 있으면 발견 상태를 기록하고, 이전에 있었지만 사라진 Topic은 `disconnected`로 보존한다. |
| 5 | 같은 함수 | L125-L230 | L221-L230 | 완성한 목록을 정렬해 Runtime Cache를 교체하고 불필요한 subscription 정리를 요청한다. |
| 6 | `topic/runtime.py` `snapshot()` | L75-L104 | L77-L103 | Topic Cache에 latest preview·마지막 수신 시각·수신 여부를 합쳐 Runtime snapshot을 만든다. |
| 7 | `ros_monitor.py` `snapshot()` | L126-L171 | L128-L170 | Node 관계를 역집계해 Publisher/Subscriber Node 수를 추가하고 endpoint 수는 상세 진단값으로 유지한다. |
| 8 | `monitoring.py` `get_ros_topics()` | L16-L28 | L19-L27 | Topic snapshot을 기존 `/ros/topics` API 응답 구조로 반환한다. |
| 9 | `useTopicDashboard.js` → `TopicsPage.jsx` | L17-L163 → L14-L185 | Hook L27-L51, Page L33-L83 | Frontend가 API를 polling하고 응답 배열에 주요·전체·검색·상태 필터를 적용해 최종 목록을 표시한다. |

이 표로 전체 방향을 먼저 파악하고, 자동 구독·외부 구독·Hz 계산처럼 헷갈리는 부분만 아래의 상세 표에서 확인한다.

## 메시지 수신과 Hz

```text
메시지 callback
→ 현재 시각 저장
→ 오래된 timestamp 제거
→ 남은 개수 ÷ hz_window_sec
→ /ros/topics/hz
```

| 단계 | 파일·함수 | 함수 전체 L | 실제 핵심 L | 의미 |
|---:|---|---:|---:|---|
| 1 | `topic/runtime.py` `_latest_message_callback()` | L506-L522 | L507-L520 | 메시지 변환 후 수신 시각과 preview 저장 |
| 2 | `topic/subscriptions.py` `update_subscription_entry()` | L39-L54 | L46-L53 | timestamp 목록 갱신 |
| 3 | `topic/hz.py` `recent_timestamps()` | L14-L22 | L19-L22 | 계산 창보다 오래된 시각 제거 |
| 4 | `topic/hz.py` `build_hz_snapshot()` | L42-L71 | L49-L59 | `message_count / window_sec` 계산 |
| 5 | `topic/runtime.py` `topic_hz()` | L283-L318 | L317-L318 | 구독 확보 후 Hz snapshot 반환 |
| 6 | `monitoring.py` `get_ros_topic_hz()` | L37-L40 | L40 | `/ros/topics/hz` 응답 |

현재 기본 5초 창에서 첫 메시지는 `1 ÷ 5 = 0.2 Hz`다. 이는 “마지막 1초 동안 받은 개수”가 아니라 “설정된 5초 창에 남은 개수를 5로 나눈 값”이다.

## 외부 구독 계산

| 단계 | 함수 전체 L | 핵심 L | 의미 |
|---:|---:|---:|---|
| 내부 endpoint 조사 | `_monitor_subscriber_count()` L406-L426 | L414-L417 | Graph 기반 소유 endpoint 계산을 우선 사용 |
| endpoint 소유 Node 비교 | `_owned_subscription_endpoint_count()` L429-L466 | L451-L466 | `node_name + namespace`가 Dashboard Node와 같은 endpoint 수 계산 |
| 외부 endpoint 계산 | `update()` L125-L230 | L163-L172 | 전체 subscriber endpoint − 내부 endpoint |
| API 진단 필드 | `RosMonitor.snapshot()` L126-L171 | L153-L169 | Node 수와 endpoint 수를 별도 필드로 제공 |

예: 같은 Dashboard Node가 자동 감시와 Interface Lab Receive로 같은 Topic을 두 번 구독하면 `Subscriber Node=1`, `Subscriber endpoint=2`, `내부 endpoint=2`, `외부 endpoint=0`이다.

## 주요/전체 필터

- 주요: 내부 Topic이 아니면서 지원·등록 타입, active/수신/Hz/상세 감시 등 실제 감시 근거가 하나 이상 있는 Topic.
- 전체: Backend가 반환한 모든 Topic.
- 숨김 포함: 주요 항목을 선택한 상태에서도 전체 Topic 집합으로 범위를 넓힌다.

판정 함수 전체는 `primaryFilters.js isPrimaryTopic()` L21-L50, 실제 조건은 L35-L48, 내부 Topic 제외는 L71-L77이다.
