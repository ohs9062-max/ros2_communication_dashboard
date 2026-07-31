# Alert 흐름

## 한 문장으로 보기

Alert는 각 Runtime의 현재 상태와 사용자 실행 결과에서 후보를 만들고, `RosMonitor.alerts()`가 모두 합친 뒤 같은 장애의 발생·해결·재발 이력을 관리해 API로 반환한다.

## 쉬운 용어

| 용어 | 뜻 |
|---|---|
| Alert candidate | 현재 조건으로 방금 만들어진 경고 후보 |
| lifecycle | 경고가 처음 발생하고 해결되거나 재발하는 생명주기 |
| active | 장애 조건이 지금도 존재함 |
| resolved | 장애 조건은 해소됐지만 최근 이력으로 잠시 보관됨 |
| stale | Topic 메시지가 제한 시간보다 오래 들어오지 않음 |
| missing | Publisher와 감시 구독은 있지만 첫 메시지를 받지 못함 |
| waiting | 상대 역할이 없어 통신을 시작하지 못하고 기다리는 상태 |

## 공통 흐름

```text
Topic/Service/Action/Node 상태
→ source별 Alert builder
→ RosMonitor가 후보 합치기
→ retain_alerts() lifecycle 처리
→ meta severity 집계
→ GET /ros/alerts
```

| 단계 | 파일·함수 | 함수 전체 L | 핵심 L | 먼저 볼 내용 |
|---:|---|---:|---:|---|
| 1 | `ros_monitor.py` `alerts()` | `ros_monitor.py` L552-L621 | `ros_monitor.py` L555-L586 | 숨김 Service 포함 snapshot과 각 source Alert 조립 |
| 2 | `ros_monitor.py` `alerts()` | `ros_monitor.py` L552-L621 | `ros_monitor.py` L587-L609 | active/resolved lifecycle 적용 |
| 3 | `ros_monitor.py` `alerts()` | `ros_monitor.py` L552-L621 | `ros_monitor.py` L610-L621 | history와 meta를 API 형식으로 반환 |
| 4 | `topic/alerts.py` `retain_alerts()` | `topic/alerts.py` L60-L127 | `topic/alerts.py` L82-L96 | 현재 장애를 active로 갱신 |
| 5 | `topic/alerts.py` `retain_alerts()` | `topic/alerts.py` L60-L127 | `topic/alerts.py` L98-L125 | 해결 처리, 60초 보관, history 최대 50개 |
| 6 | `monitoring.py` `get_ros_alerts()` | `monitoring.py` L86-L89 | `monitoring.py` L89 | `/ros/alerts` 반환 |
| 7 | `rosApi.js` → 각 Dashboard Hook | `rosApi.js` L57-L59 | 각 `use*Dashboard.js`의 `usePolling(fetchAlerts, ...)` | Frontend가 Alert API를 polling하고 화면별 source에 맞는 Alert만 고른다. |
| 8 | `AlertsPage.jsx` `AlertsPage()` | `AlertsPage.jsx` L5-L102 | `AlertsPage.jsx` L12-L18, `AlertsPage.jsx` L67-L98 | 현재 active Alert와 해결 history를 분리하고 `현재 Alert`·`이전 Alert` 탭으로 표시한다. |

공통 흐름은 1~8로 보고, source별 실제 발생 조건만 아래 두 표에서 확인한다.

## Topic Alert

| 판단 | 함수 전체 L | 실제 핵심 L |
|---|---:|---:|
| 전체 Topic 후보 조립 | `topic/alerts.py` `build_alerts()` L27-L57 | `topic/alerts.py` L37-L55 |
| command Topic 제외 | `topic/alerts.py` `_topic_alerts()` L161-L225 | `topic/alerts.py` L170-L181 |
| disconnected | `topic/alerts.py` `_topic_alerts()` L161-L225 | `topic/alerts.py` L183-L199 |
| missing/stale 검사 진입 | `topic/alerts.py` `_topic_alerts()` L161-L225 | `topic/alerts.py` L201-L208 |
| waiting publisher | `topic/alerts.py` `_topic_alerts()` L161-L225 | `topic/alerts.py` L210-L223 |
| 실제 missing/stale 시간 비교 | `topic/alerts.py` `_topic_message_alerts()` L228-L279 | `topic/alerts.py` L236-L277 |

`required_stream_names`와 등록 Interface 타입만 기본 missing/stale 대상이며, `command_names`는 먼저 제외한다.

## Service·Action·Node Alert

| Source | Builder 전체 L | 핵심 L | 근거 |
|---|---:|---:|---|
| Service | `service/alerts.py` `build_service_alerts()` L10-L68 | `service/alerts.py` L17-L66 | 등록 주요 Service disconnected 또는 최근 사용자 Call timeout/실패 |
| Action | `action/alerts.py` `build_action_alerts()` L21-L151 | `action/alerts.py` L27-L148 | disconnected, aborted/canceled, Goal/Result 오류 |
| Node | `node/alerts.py` `build_node_alerts()` L13-L43 | `node/alerts.py` L18-L42 | 이전 발견 Node가 현재 Graph에서 사라짐 |

Graph 정보만으로 정상 종료와 비정상 종료를 구분할 수 없으므로 Node Alert는 “비정상 종료”가 아니라 “연결 종료 감지”를 의미한다.
