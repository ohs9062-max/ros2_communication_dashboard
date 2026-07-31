# Action 흐름

## 한 문장으로 보기

Action 목록은 Graph에서 Server/Client 관계를 발견하되 Dashboard 내부 Node를 제외해 보여주고 status·feedback을 관찰하며, 새 Goal 전송은 Interface Lab에서 사용자가 실행했을 때만 `ActionGoalRuntime`이 담당한다.

## 쉬운 용어

| 용어 | 뜻 |
|---|---|
| Action Server | 오래 걸릴 수 있는 작업을 실행하고 feedback/result를 제공하는 역할 |
| Action Client | Goal을 보내고 feedback/result를 받는 역할 |
| Goal | Action Server에 보내는 작업 요청 |
| Feedback | 작업 중간 진행 정보 |
| Result | 작업이 끝난 뒤 결과 |
| status | accepted, executing, succeeded, aborted 같은 Goal 상태 |
| Action 내부 통신 | Action 하나를 구현하기 위해 자동 생성되는 status/feedback Topic과 goal/result/cancel Service |

## Graph 발견과 관찰

```text
get_action_names_and_types()
→ Server/Client 관계 수
→ status/feedback subscription
→ Action Cache
→ Node 수와 Goal Activity 병합
→ GET /ros/actions
```

| 단계 | 파일·함수 | 함수 전체 L | 핵심 L | 먼저 볼 내용 |
|---:|---|---:|---:|---|
| 1 | `action/runtime.py` `update()` | `action/runtime.py` L88-L164 | `action/runtime.py` L94-L134 | Graph, 필터, 관계 수, 관찰 capability, Action item 생성 |
| 2 | `action/runtime.py` `update()` | `action/runtime.py` L88-L164 | `action/runtime.py` L136-L149 | 사라진 Action을 disconnected로 보존 |
| 3 | `action/runtime.py` `update()` | `action/runtime.py` L88-L164 | `action/runtime.py` L157-L163 | subscription 정리와 Result Runtime 연결 |
| 4 | `action/runtime.py` subscription 생성 함수 | `_ensure_subscriptions()` L285-L329, `_maybe_create_status_subscription()` L352-L384, `_maybe_create_feedback_subscription()` L386-L424 | `action/runtime.py` L307-L318, L364-L384, L400-L424 | status와 feedback subscription을 생성하고 Result 관찰 지원 여부를 합친다. |
| 5 | `action/runtime.py` `_status_callback()` | `action/runtime.py` L430-L444 | `action/runtime.py` L432-L443 | Goal status 수신값을 runtime cache에 반영 |
| 6 | `action/runtime.py` `_feedback_callback()` | `action/runtime.py` L446-L460 | `action/runtime.py` L448-L460 | feedback preview를 runtime cache에 반영 |
| 7 | `ros_monitor.py` `action_snapshot()` | `ros_monitor.py` L341-L424 | `ros_monitor.py` L343-L423 | Dashboard 제외 Node 수, 원본 endpoint 수, 상태 관찰·Interface Lab Client 상태, 등록·Goal 요약 병합 |
| 8 | `monitoring.py` `get_ros_actions()` | `monitoring.py` L60-L70 | `monitoring.py` L63-L69 | API JSON 반환 |
| 9 | `useActionDashboard.js` → `ActionsPage.jsx` | `useActionDashboard.js` L7-L74 → `ActionsPage.jsx` L17-L179 | `useActionDashboard.js` L11-L15, L31-L37, `ActionsPage.jsx` L35-L74 | Action·Node API를 polling하고 상세 참여 Node에서도 내부 Node를 제외한 뒤 주요·전체·Goal 상태·검색 조건으로 최종 목록을 표시한다. |

1~9는 Graph 발견과 관찰 결과의 화면 표시 흐름이다. `Server/Client Node 수 (Dashboard 제외)`에는 Dashboard Client가 들어가지 않고, 메인 목록의 `Dashboard 통신` 열은 `ActionGoalRuntime.dashboard_state_by_action()` L356-L364에 Interface Lab Client가 있을 때만 `Lab Client`를 표시한다. status·feedback 자동 관찰은 계속 동작하지만 메인 목록 배지에서는 생략하며, Endpoint 진단값은 Graph 원본을 유지한다.

## 사용자 Goal 실행

| 단계 | 파일·함수 | 함수 전체 L | 실제 핵심 L | 의미 |
|---:|---|---:|---:|---|
| 1 | `action_execution.py` `send_registered_action_goal()` | `action_execution.py` L27-L72 | `action_execution.py` L29-L53 | JSON과 Action name/type/goal 검사 |
| 2 | `action_execution.py` `send_registered_action_goal()` | `action_execution.py` L27-L72 | `action_execution.py` L55-L63 | `RosMonitor.send_action_goal()`로 전달 |
| 3 | `ros_monitor.py` `send_action_goal()` | `ros_monitor.py` L430-L444 | `ros_monitor.py` L439-L444 | `ActionGoalRuntime`에 위임 |
| 4 | `action_goal_runtime.py` `send_goal()` | `action_goal_runtime.py` L91-L238 | `action_goal_runtime.py` L100-L110 | timeout, Registry, Graph Server, monitor Node 검사 |
| 5 | `action_goal_runtime.py` `send_goal()` | `action_goal_runtime.py` L91-L238 | `action_goal_runtime.py` L118-L141 | Goal 타입 변환과 Action Client 준비 |
| 6 | `action_goal_runtime.py` `send_goal()` | `action_goal_runtime.py` L91-L238 | `action_goal_runtime.py` L143-L157 | `send_goal_async()`, feedback callback, Goal 수락 대기 |
| 7 | `action_goal_runtime.py` `send_goal()` | `action_goal_runtime.py` L91-L238 | `action_goal_runtime.py` L158-L174 | Goal 거절 처리 |
| 8 | `action_goal_runtime.py` `send_goal()` | `action_goal_runtime.py` L91-L238 | `action_goal_runtime.py` L176-L206 | `get_result_async()`, timeout, Result 변환 |
| 9 | `action_goal_runtime.py` `send_goal()` | `action_goal_runtime.py` L91-L238 | `action_goal_runtime.py` L207-L238 | 실패 분류, history 저장, 반환 |

Dashboard의 일반 Action Runtime은 관찰 경로이고, `ActionGoalRuntime`은 사용자 실행 경로다. 일반 목록을 열었다는 이유만으로 Goal을 보내지 않는다.

## 주요/전체 필터

- 주요: 등록된 Action 타입이거나 Goal·Feedback·Result 관찰 흔적이 있는 Action.
- 전체: Backend가 발견한 모든 Action.
- 대기 Action 포함: 주요 필터의 시작 집합도 전체로 넓힌다.
- 실행 중/성공/실패·취소/Goal 미관찰: 마지막 Goal과 Result 상태로 다시 거른다.

판정 함수 전체는 `primaryFilters.js isPrimaryAction()` L52-L69, 실제 조건은 `primaryFilters.js` L60-L67이며, 화면 집합 선택은 `ActionsPage.jsx` L35-L74, 상태 판정은 `ActionsPage.jsx` L181-L224이다.
