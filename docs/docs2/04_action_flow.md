# Action 흐름

## 수집과 관찰

```text
rclpy Action Graph
→ ActionRuntime.update()
→ Goal/Result/Cancel Service + Feedback/Status Topic
→ status/feedback/result observation
→ Action snapshot
→ Backend cache
→ Actions 화면
```

| 단계 | 현재 코드 위치 | 역할 |
|---:|---|---|
| 1 | `ros2_action/runtime.py ActionRuntime.update()` L84-L166 | Action Graph, filter, disconnected debounce와 runtime 조립 |
| 2 | `ros2_action/subscription_lifecycle.py` | Status/Feedback Subscription 생성·정리 |
| 3 | `ros2_action/subscriptions.py` L77-L314 | Goal status, Feedback, Result와 elapsed cache 갱신 |
| 4 | `action_snapshot.py assemble_action_snapshot()` L15-L136 | 외부 Node 수, Goal 요약, Interface Lab 상태, 5채널 QoS 병합 |
| 5 | `transport/routers/monitoring.py get_ros_actions()` L96-L106 | Monitor Action API |
| 6 | `frontend/src/hooks/useActionDashboard.js` L10-L85 | Action·Alert·Node polling과 상세 선택 |
| 7 | `frontend/src/pages/ActionsPage.jsx` L22-L163 | 주요/전체, 검색·Goal 상태 filter, 목록·상세 |

기본 목록은 상태, 이름, type, Action Server/Client Node 수, 마지막 Goal 상태, 마지막 Feedback,
마지막 Result, 실행 시간, 마지막 Goal 시각을 표시한다. 내부 5개 채널, raw Goal/Feedback/Result와 endpoint
QoS는 우측 상세에서 본다.

유효한 type에서 Action Server가 있으면 Graph 상태는 `active`, Server 없이 Client만 있으면
`waiting_server`, 둘 다 없으면 `inactive`다. type이 유효하지 않으면 `unknown`이다.

## 사용자 Goal과 Cancel

```text
POST /ros/interfaces/action-goal
→ transport router
→ InterfaceLabFacade
→ ActionGoalRuntime
→ ActionClient.send_goal_async
→ accept / feedback / result / cancel + history
```

- Goal route: `transport/routers/action_execution.py` L34-L86
- Cancel route: 같은 파일 L108-L124
- Goal runtime entry: `interface_lab/execution/action_goal_runtime.py send_goal()` L84-L124
- Cancel: 같은 파일 `cancel_goal()` L131-L145
- History/reset: 같은 파일 L146-L203
- Dashboard Lab Client 상태: 같은 파일 `dashboard_state_by_action()` L208-L213

사용자가 Goal을 보낼 때만 실제 ActionClient가 생성된다. rejected/canceled/result timeout은 warning,
aborted/send failure/result unavailable은 error Alert 후보가 된다.

## 채널별 QoS

Action QoS는 다음 5개 채널을 합치지 않는다.

```text
Goal Service
Result Service
Cancel Service
Feedback Topic
Status Topic
```

Goal/Result/Cancel은 Fast DDS server endpoint, Feedback/Status는 rclpy Topic endpoint를 사용한다.
Alert와 상세도 문제 채널을 분리한다. 같은 채널·role·QoS의 endpoint만 UI에서 그룹화하고 실제 GUID/GID
endpoint 데이터는 유지한다.

Client 생성 뒤 Goal/Result/Cancel은 상대 DDS endpoint signature 변경 시, Feedback/Status는 기존 Graph 및
Subscription cache가 갱신될 때 호환 상태를 바꾼다. snapshot은 리소스별 마지막 실행 Client의 저장된 5채널
상태를 사용하며 profile별 Client pool의 과거 삽입 순서로 최신 상태를 덮어쓰지 않는다.
