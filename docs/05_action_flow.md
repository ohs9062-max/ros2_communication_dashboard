# Action Monitoring과 Goal 실행 흐름

## 1. 기능을 한 문장으로 설명

Action 기능은 Server/Client 관계를 관찰하고, Goal의 수락·실행·취소·성공·실패 상태와 Feedback, Result를 화면과 Alert에 연결한다.

Action은 오래 걸리는 작업에 사용한다. Client가 Goal을 보내면 Server가 수락 또는 거절하고, 실행 중 Feedback을 보내며, 끝나면 Result를 돌려준다.

## 2. 전체 흐름

```text
ROS2 Action Graph 발견
→ Server/Client 상태 저장
→ status/feedback Topic 관찰
→ 사용자가 Interface Lab에서 Goal 전송
→ 수락 또는 거절
→ Feedback 수신
→ Result 수신 또는 Timeout
→ ROS status code를 문자열 상태로 변환
→ /ros/actions에 Monitoring과 사용자 history 병합
→ Action 목록/상세/Alert 표시
```

## 3. 단계별 쉬운 설명

### 1) Graph에서 Action을 발견한다

- 파일: `action/runtime.py L88~L165`
- 역할: Action name/type과 Server/Client 관계를 가져오고 이전 목록과 비교한다.
- 파일: `action/runtime.py L186~L284`
- 역할: Node별 Action Server/Client 관계를 센다.
- 출력: Graph 상태가 담긴 Action item

### 2) 서버 상태를 계산한다

- 파일: `action/models.py L37~L60`

| 조건 | 서버 상태 |
|---|---|
| Server 있음 | `active` |
| Client만 있음 | `waiting_server` |
| 둘 다 없음 | `inactive` |
| 타입 불명 | `unknown` |
| 이전 발견 후 사라짐 | `disconnected` |

이 서버 상태와 최근 Goal 결과는 다른 정보다. 화면 첫 열은 `서버 상태`, 별도 `마지막 Goal` 열은 실행 결과를 표시한다.

### 3) status와 Feedback을 구독한다

- 파일: `action/runtime.py L285~L425`
- 파일: `action/runtime.py L426~L461`
- 역할: `<action>/_action/status`, `<action>/_action/feedback` Subscription을 만들고 callback을 연결한다.
- 파일: `action/subscriptions.py L122~L176`
- 역할: Goal ID별 상태, 마지막 상태 시각, Feedback preview, 실행 시간을 cache에 저장한다.

### 4) ROS status code를 읽기 쉬운 상태로 바꾼다

- 파일: `action/models.py L14~L56`

| ROS2 status | 저장값 | 화면 |
|---|---|---|
| `STATUS_ACCEPTED`(1) | `accepted` | Goal 수락, 파랑 |
| `STATUS_EXECUTING`(2) | `executing` | 실행 중, 파랑 |
| `STATUS_CANCELING`(3) | `canceling` | 취소 중, 노랑 |
| `STATUS_SUCCEEDED`(4) | `succeeded` | 성공, 초록 |
| `STATUS_CANCELED`(5) | `canceled` | 취소됨, 노랑 |
| `STATUS_ABORTED`(6) | `aborted` | 실패 종료, 빨강 |

### 5) 관찰된 terminal Goal의 Result를 조회한다

- 파일: `action/subscriptions.py L177~L218`
- 파일: `action/result_runtime.py L82~L224`
- 역할: status에서 실제로 관찰한 succeeded/canceled/aborted Goal ID만 `get_result` 대상으로 삼는다.
- 중요: Monitoring은 상태 확인을 위해 새 Goal을 만들지 않는다.

### 6) 사용자가 Interface Lab에서 Goal을 보낸다

- 파일: `routers/action_execution.py L15~L75`
- 파일: `interface_lab/execution/action_goal_runtime.py L91~L239`
- 처리:
  1. 등록 action과 Graph 타입 exact match 확인
  2. Goal JSON을 ROS 객체로 검증
  3. `send_goal_async()` 실행
  4. 수락/거절 확인
  5. Feedback callback 저장
  6. `get_result_async()` 결과 대기
  7. history 저장

### 7) 실패 종류를 구분한다

- 파일: `interface_lab/execution/action_goal_runtime.py L91~L239`
- 파일: `interface_lab/execution/action_goal_runtime.py L620~L643`

| 저장 상태 | 의미 |
|---|---|
| `goal_rejected` | Server가 Goal을 거절 |
| `goal_send_failed` | Goal 전송 준비 또는 전송 실패 |
| `goal_accept_timeout` | 제한 시간 안에 수락 결과 없음 |
| `result_timeout` | 수락됐지만 제한 시간 안에 Result 없음 |
| `result_receive_failed` | Result future 처리 실패 |
| `aborted` | 실행 후 실패 종료 |
| `canceled` | 취소 완료 |

Result message 안의 사용자 필드 `success=false`와 ROS terminal status는 같은 의미가 아니다. Dashboard의 Action 상태는 ROS status code를 기준으로 유지하고 Result JSON은 별도로 보여준다.

### 8) Monitoring과 사용자 실행 결과를 합친다

- 파일: `interface_lab/execution/action_goal_runtime.py L240~L355`
- 파일: `ros_monitor.py L274~L318`
- 역할: 활성 Node 관계를 역집계해 Server/Client Node 수를 추가하고 사용자 Goal history의 최신 summary를 Graph Action item에 `last_goal_summary`로 붙인다.
- 출력: 서버 상태, Runtime 관찰 상태, 사용자 Goal 결과가 함께 있는 `/ros/actions` item

### 9) Action Alert를 만든다

- 파일: `action/alerts.py L21~L175`

| 조건 | level | code |
|---|---|---|
| aborted | error | `action_goal_aborted` |
| canceled | warning | `action_goal_canceled` |
| Goal 거절 | warning | `action_goal_rejected` |
| Goal 전송/수락 실패 | error | `action_goal_send_failed` |
| Result Timeout | warning | `action_result_timeout` |
| Result 수신 실패 | error | `action_result_unavailable` |
| Graph에서 사라짐 | error | `action_disconnected` |

정상 Goal 결과가 최신 상태가 되면 이전 상태형 Alert는 resolved로 전환된다.

### 10) Frontend가 목록과 상세에 표시한다

- 파일: `hooks/useActionDashboard.js L7~L74`
- 파일: `components/ActionTable.jsx L41~L158`
- 목록: Server/Client Node 수, 서버 상태, 마지막 Goal, Goal 전송 시각, Feedback 값, Goal 값, Feedback/Result 상태, 실행 시간을 표시한다.
- 파일: `components/ActionDetailPanel.jsx L6~L246`
- 상세: Goal 상태, Feedback, Result, 실행 시간, 실패 사유와 JSON을 표시한다.
- 파일: `components/StatusBadge.jsx L1~L125`
- 역할: 상태를 한국어 문구와 색으로 바꾼다.

## 4. 사용자 취소 기능 범위

현재 프로젝트에는 사용자가 cancel 요청을 보내는 버튼과 Backend cancel API가 없다. 따라서 “사용자 취소 요청 실패” 상태와 Alert도 실제 발생 경로가 없다. 외부 Client나 Server에서 관찰된 `canceling/canceled`는 정상 표시한다.

## 5. 입력 데이터

- Action name/type과 Server/Client 관계
- status/feedback 내부 Topic
- Interface Lab Goal JSON과 timeout

## 6. 처리 과정

Monitoring cache와 사용자 Goal history를 분리해 저장하고 `/ros/actions`에서 합친다. 이 때문에 Server가 살아 있어도 최근 Goal이 aborted, canceled, rejected 또는 Timeout이었다는 사실을 잃지 않는다.

## 7. 출력 데이터

- `status`: 서버 Graph 상태
- `runtime`: 관찰된 Goal/Feedback/Result
- `last_goal_summary`: 사용자 실행의 최신 결과
- 상태별 Action Alert

## 8. 다음 단계와 연결

Alert 유지 방식은 [07_alert_flow.md](07_alert_flow.md), Interface Lab 화면은 [12_interface_lab_flow.md](12_interface_lab_flow.md)로 이어진다.

## 9. 핵심 요약

1. 서버 상태와 최근 Goal 결과는 반드시 별도로 읽어야 한다.
2. accepted부터 aborted까지 ROS2 표준 status를 그대로 구분한다.
3. 거절·전송 실패·Result Timeout도 목록, 상세, Alert에 연결된다.
