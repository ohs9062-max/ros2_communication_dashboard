# 코드 추적 색인

## 1. 기능을 한 문장으로 설명

이 문서는 증상이나 기능 이름을 보고 현재 코드의 파일과 기능 단위 라인 범위를 바로 찾는 색인이다.

라인은 2026-07-27 현재 코드 기준이다. 이후 코드가 추가되면 범위를 다시 확인해야 한다.

## 2. Backend 시작과 종료

| 찾을 기능 | 실제 코드 위치 |
|---|---|
| FastAPI lifespan | `main.py L20~L30` |
| middleware/router | `main.py L32~L45` |
| health | `main.py L48~L57` |
| 설정/singleton | `app_state.py L1~L10` |
| Runtime 생성 | `ros_monitor.py L30~L78` |
| rclpy/Node/timer/thread 시작 | `ros_monitor.py L80~L94` |
| shutdown/join/destroy/clear | `ros_monitor.py L96~L120` |
| spin | `ros_monitor.py L562~L572` |
| Graph 주기 갱신 | `ros_monitor.py L574~L581` |

## 3. Monitoring API

| endpoint | 실제 코드 위치 | 다음 호출 |
|---|---|---|
| `/ros/topics` | `routers/monitoring.py L16~L28` | `RosMonitor.snapshot()` |
| `/ros/topics/latest` | `routers/monitoring.py L31~L35` | `latest_message()` |
| `/ros/topics/hz` | `routers/monitoring.py L37~L40` | `topic_hz()` |
| `/ros/services` | `routers/monitoring.py L43~L57` | `service_snapshot()` |
| `/ros/actions` | `routers/monitoring.py L60~L70` | `action_snapshot()` |
| `/ros/nodes` | `routers/monitoring.py L73~L83` | `node_snapshot()` |
| `/ros/alerts` | `routers/monitoring.py L86~L89` | `alerts()` |
| `/ws/monitor` | `routers/monitoring.py L92~L109` | `websocket_snapshot()` |

## 4. Topic 끝까지 추적

```text
config_loader.py L186~L309
→ topic/runtime.py L124~L222
→ topic/runtime.py L339~L450
→ topic/runtime.py L451~L468
→ topic/preview.py L15~L21
→ topic/runtime.py L74~L104
→ routers/monitoring.py L16~L40
→ rosApi.js L45~L55
→ useTopicDashboard.js L13~L174
→ TopicTable.jsx L44~L144
→ TopicDetailPanel.jsx L11~L161
```

| 세부 기능 | 코드 위치 |
|---|---|
| registered msg 병합 | `config_loader.py L268~L309` |
| Graph/update/cache | `topic/runtime.py L124~L222` |
| 지원 타입 판정 | `topic/runtime.py L311~L360` |
| Subscription | `topic/runtime.py L362~L412` |
| cleanup | `topic/runtime.py L413~L450` |
| callback/latest 저장 | `topic/runtime.py L451~L468` |
| Hz snapshot | `topic/runtime.py L469~L508`, `topic/hz.py L14~L70` |
| custom msg dict preview | `topic/preview.py L15~L21` |
| missing/stale Alert | `topic/alerts.py L169~L287` |

## 5. Service 끝까지 추적

```text
service/runtime.py L90~L152
→ service/models.py L28~L60
→ interface_lab/execution/service_call_runtime.py L85~L188
→ service_call_runtime.py L254~L278
→ ros_monitor.py L126~L164
→ service/alerts.py L10~L67
→ routers/monitoring.py L43~L57
→ ServiceTable.jsx L33~L145
→ ServiceDetailPanel.jsx L6~L207
```

| 세부 기능 | 코드 위치 |
|---|---|
| Graph와 disconnected | `service/runtime.py L90~L152` |
| Service item | `service/discovery.py L17~L56` |
| 사용자 Call | `service_call_runtime.py L85~L188` |
| request 변환 | `value_converter.py L37~L107` |
| history/summary | `service_call_runtime.py L189~L278`, `L462~L478` |
| Graph+Call 상태 병합 | `ros_monitor.py L126~L164`, `L584~L602` |
| Timeout Alert | `service/alerts.py L10~L67` |

Active check 호환 코드는 `service/active_check*.py`에 남아 있지만 `ros_monitor.py L574~L581`에서 실행하지 않는다.

## 6. Action 끝까지 추적

```text
action/runtime.py L88~L165
→ action/runtime.py L285~L461
→ action/subscriptions.py L122~L218
→ action/result_runtime.py L82~L224
→ action_goal_runtime.py L91~L239
→ action_goal_runtime.py L327~L355
→ ros_monitor.py L206~L229
→ action/alerts.py L21~L175
→ ActionTable.jsx L41~L158
→ ActionDetailPanel.jsx L6~L232
```

| 세부 기능 | 코드 위치 |
|---|---|
| Graph/Server/Client | `action/runtime.py L88~L284` |
| status/feedback Subscription | `action/runtime.py L285~L461` |
| status code mapping | `action/models.py L14~L56` |
| 관찰 Goal Result | `action/result_runtime.py L82~L224` |
| 사용자 Goal | `action_goal_runtime.py L91~L239` |
| history/summary | `action_goal_runtime.py L240~L355`, `L620~L643` |
| 실행 실패 Alert | `action/alerts.py L21~L175` |

## 7. Node와 Visualization

| 기능 | 코드 위치 |
|---|---|
| Node Graph/cache | `node/runtime.py L72~L161` |
| 관계 item | `node/discovery.py L14~L57` |
| Node Alert | `node/alerts.py L13~L42` |
| 주요 Node | `nodeFilters.js L22~L101` |
| participant map | `participants.js L1~L88` |
| graph nodes/edges | `graphTransform.js L18~L176` |
| layout/filter | `graphTransform.js L356~L689` |
| Visualization polling | `useVisualizationGraph.js L17~L275` |
| React Flow 화면 | `VisualizationPage.jsx L11~L385` |

## 8. Alert

```text
RosMonitor.alerts()                       ros_monitor.py L395~L463
→ build_alerts()                          topic/alerts.py L39~L67
→ build_service_alerts()                  service/alerts.py L10~L67
→ build_action_alerts()                   action/alerts.py L21~L175
→ build_node_alerts()                     node/alerts.py L13~L42
→ retain_alerts()                         topic/alerts.py L68~L137
→ build_alert_meta()                      topic/alerts.py L138~L168
→ /ros/alerts                             routers/monitoring.py L86~L89
→ Overview/Alerts                         OverviewPage.jsx L18~L133,
                                          AlertsPage.jsx L5~L102
```

## 9. Interface Lab 관리·Apply

| 기능 | 코드 위치 |
|---|---|
| workspace 경로 | `interface_lab/paths.py L8~L25` |
| single upload/registry | `management/registry.py L82~L210`, `L374~L472` |
| manual type/definition | `management/manual_interfaces.py L55~L191` |
| metadata 재생성 | `management/manual_interfaces.py L404~L488` |
| package upload | `management/packages.py L63~L222` |
| package 삭제 | `management/packages.py L228~L248` |
| Apply/build | `apply/runtime.py L100~L341` |
| import check | `apply/runtime.py L500~L589` |

## 10. Interface Lab 실행

| 기능 | 코드 위치 |
|---|---|
| Topic Receive | `execution/topic_runtime.py L113~L272` |
| Topic Publish | `execution/topic_runtime.py L273~L416` |
| Service Call | `execution/service_call_runtime.py L85~L188` |
| Action Goal | `execution/action_goal_runtime.py L91~L239` |
| 공통 schema/변환 | `common/value_converter.py L37~L143` |
| Frontend workspace | `InterfaceLabPage.jsx L45~L539` |

## 11. 증상별 빠른 경로

- custom msg 마지막 값 `{}`: `topic/runtime.py L451~L468` → `topic/preview.py L15~L21` → `TopicTable.jsx L44~L144`
- Topic Hz/stale: `topic/hz.py L14~L70` → `topic/alerts.py L169~L287`
- Service Timeout 미표시: `service_call_runtime.py L132~L184` → `ros_monitor.py L126~L164` → `ServiceTable.jsx L33~L145`
- Action 실패가 성공으로 보임: `action_goal_runtime.py L91~L239`, `L620~L643` → `ActionTable.jsx L41~L158`
- Alert가 해결 후 남음: `topic/alerts.py L68~L137`의 `retain_alerts()` 확인
- 주요 Node 누락: `/ros/nodes` 관계 → `primaryFilters.js L17~L79` → `nodeFilters.js L22~L101`

## 12. 핵심 요약

라인 하나보다 기능 단위 범위를 읽는다. 먼저 Router에서 RosMonitor로, 그다음 Runtime/cache, 마지막으로 Frontend hook과 component 순서로 따라가면 데이터가 사라진 지점을 찾기 쉽다.
