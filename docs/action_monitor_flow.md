# Action Monitoring 빠른 안내

Action의 최신 기준 문서는 [05_action_flow.md](05_action_flow.md)다.

코드를 바로 추적하려면 [11_code_trace_index.md](11_code_trace_index.md)의 Action 절에서 다음 순서로 읽는다.

```text
action/runtime.py L88~L165
→ action/subscriptions.py L122~L218
→ action/result_runtime.py L82~L224
→ action/alerts.py L21~L175
```

사용자가 Goal을 보내는 경로는 Monitoring과 다르며
`interface_lab/execution/action_goal_runtime.py L91~L239`가 담당한다.

서버 상태는 `action.status`, 최근 사용자 Goal 결과는
`last_goal_summary.last_goal_status`다. 둘을 같은 의미로 읽지 않는다.
