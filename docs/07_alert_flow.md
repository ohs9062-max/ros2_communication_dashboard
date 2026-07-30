# Alert 흐름

## 1. 기능을 한 문장으로 설명

Alert 기능은 Topic, Service, Action, Node에서 발견한 현재 문제를 한 목록으로 모으고, 해결된 문제도 60초 동안 확인할 수 있게 한다.

Alert cache는 DB가 아니라 Backend 메모리에 있다. Backend를 재시작하면 초기화된다.

## 2. 전체 흐름

```text
각 Runtime이 상태와 최근 실행 결과 저장
→ Topic/Service/Action/Node Alert builder
→ RosMonitor.alerts()에서 합치기
→ retain_alerts()
→ active 또는 resolved 판정
→ build_alert_meta()
→ /ros/alerts
→ Overview 집계와 Alerts 화면
```

## 3. 단계별 쉬운 설명

### 1) 각 기능이 문제 조건을 찾는다

- Topic: `topic/alerts.py L27~L57`, `L161~L281`
- Service: `service/alerts.py L10~L67`
- Action: `action/alerts.py L21~L175`
- Node: `node/alerts.py L13~L42`

builder는 “현재 상태가 Alert 조건인가?”를 판단해 공통 dict를 만든다.

### 2) RosMonitor가 Alert를 합친다

- 파일: `ros_monitor.py L496~L564`
- 역할: 네 builder 결과를 한 배열로 합치고 상태형 유지 대상 code를 지정한다.
- 다음 흐름: `retain_alerts()`가 이전 cache와 비교한다.

### 3) active 상태를 유지한다

- 파일: `topic/alerts.py L60~L127`
- 장애가 계속 감지되면:
  - `active=true`
  - `alert_state=active`
  - `last_detected_at` 갱신
  - warning/error/critical 현재 집계에 포함

### 4) 정상 복구 시 resolved로 바꾼다

- 파일: `topic/alerts.py L60~L127`
- 조건이 사라진 즉시:
  - `active=false`
  - `alert_state=resolved`
  - `resolved_at` 기록
  - 현재 장애 severity 집계에서 제외
- 해결된 항목은 `resolved_at`부터 60초 동안 현재/최근 목록 cache에 남는다.

### 5) 해결 이력을 최대 50개 저장한다

- 파일: `ros_monitor.py L496~L564`
- 해결 순간 별도 history snapshot을 만들고 최근 50개만 메모리에 보관한다.
- 같은 장애가 60초 안에 다시 생기면 같은 `id`를 다시 active로 전환한다.

### 6) meta를 계산한다

- 파일: `topic/alerts.py L130~L158`
- 역할: resolved를 제외한 active 항목만 warning/error/critical 수에 포함한다.

### 7) API와 화면에 전달한다

- 파일: `routers/monitoring.py L86~L89`
- 파일: `pages/OverviewPage.jsx L18~L133`, `L371~L419`
- 파일: `pages/AlertsPage.jsx L5~L102`
- 파일: `components/AlertsPreview.jsx L5~L96`
- 파일: `components/AlertsList.jsx L19~L77`

Overview는 접었을 때 최근 3개, 펼치면 최대 10개를 보여준다. Alerts 화면은 현재 Alert와 해결된 이전 Alert를 나눠 보여준다.

## 4. 현재 Alert 조건

### Topic

| 조건 | level | code |
|---|---|---|
| 메시지 한 번도 미수신 | warning | `topic_message_missing` |
| 수신 지연 | warning | `topic_stale` |
| Graph에서 사라짐 | error | `topic_disconnected` |

### Service

| 조건 | level | code |
|---|---|---|
| 최근 사용자 Call Timeout | warning | `service_call_timeout` |
| 등록 주요 Service 연결 끊김 | error | `service_disconnected` |

Service active check 자동 호출은 현재 실행되지 않으므로 active-check Alert를 현재 동작으로 설명하지 않는다.

### Action

| 조건 | level | code |
|---|---|---|
| aborted | error | `action_goal_aborted` |
| canceled | warning | `action_goal_canceled` |
| Goal 거절 | warning | `action_goal_rejected` |
| Goal 전송/수락 실패 | error | `action_goal_send_failed` |
| Result Timeout | warning | `action_result_timeout` |
| Result 수신 실패 | error | `action_result_unavailable` |
| Graph에서 사라짐 | error | `action_disconnected` |

### Node와 MonitorStatus

- Node 연결 끊김: error, `node_stale`
- MonitorStatus warning/error/critical: 메시지 level에 따라 생성

MonitorStatus는 메시지가 보고한 이벤트 성격을 그대로 전달하며 모든 code를 억지로 상태형 history로 바꾸지는 않는다.

## 5. 입력 데이터

- Runtime Graph 상태
- Topic 수신 시각
- Service 최근 사용자 Call summary
- Action Runtime과 최근 Goal summary

## 6. 처리 과정

Alert `id`는 source, 리소스 이름, code 조합으로 안정적으로 만든다. 같은 문제는 같은 id를 사용해야 재발과 해결을 올바르게 추적할 수 있다.

## 7. 출력 데이터

- `data`: active와 60초 이내 resolved 항목
- `history`: 해결 순간 snapshot 최대 50개
- `meta`: active severity 집계

## 8. 다음 단계와 연결

WebSocket도 현재 Alert 목록을 전달한다. 자세한 전달 경로는 [08_websocket_flow.md](08_websocket_flow.md), 화면 구성은 [09_frontend_flow.md](09_frontend_flow.md)로 이어진다.

## 9. 핵심 요약

1. active 문제만 현재 warning/error 집계에 들어간다.
2. 해결되면 즉시 resolved가 되고 60초 뒤 cache에서 제거된다.
3. Service 사용자 Timeout과 Action 실행 실패도 현재 상태형 Alert에 포함된다.
