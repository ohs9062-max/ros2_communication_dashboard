# Node 흐름

## 수집

```text
get_node_names_and_namespaces()
→ Node별 Topic/Service/Action 역할 조회
→ NodeRuntime cache
→ Node snapshot
→ Backend cache
→ Nodes 화면
```

| 단계 | 현재 코드 위치 | 역할 |
|---:|---|---|
| 1 | `ros2_node/runtime.py NodeRuntime.update()` L74-L168 | Node filter와 여섯 통신 역할 수집, disconnected debounce |
| 2 | `ros2_node/runtime.py _graph_by_node()` L177-L195 | Topic/Service Graph 역할 조회 |
| 3 | `ros2_node/runtime.py _action_servers_by_node()` L196-L216 | Action Server 조회 |
| 4 | `ros2_node/runtime.py _action_clients_by_node()` L217-L235 | Action Client 조회 |
| 5 | `node_snapshot.py assemble_node_snapshot()` L13-L67 | 리소스 snapshot과 Node 연결, primary/internal 표시 |
| 6 | `transport/routers/monitoring.py get_ros_nodes()` L124-L134 | Monitor Node API |
| 7 | `frontend/src/hooks/useNodeDashboard.js` L9-L71 | 목록·Alert polling, 검색·선택 상태 |
| 8 | `frontend/src/pages/NodesPage.jsx` L23-L174 | 주요/전체/실행/종료/내부 filter와 목록·상세 |

Node는 Graph에서 보이면 `active`, 이전에 보였으나 확인 횟수/시간 debounce 뒤 사라졌으면
`disconnected`다. 재등장하면 active로 복귀한다. 별도 process heartbeat가 없으므로 실제 프로세스 사망과
일시적인 Graph 비가시성을 구분하지 않으며 사용자 문구도 “ROS2 Graph에서 사라짐” 의미를 유지한다.

## 이름과 통신 역할

`ros2_node/models.py full_node_name()` L18-L26가 namespace와 name을 하나의 정규화된 full name으로 만든다.
기본 목록은 상태, full Node 이름, 발행/구독 Topic 수, Service Server/Client 수, Action Server/Client 수,
마지막 확인을 표시한다. 실제 연결 리소스 이름 전체는 우측 상세에 둔다.

`topology.py build_role_node_index()` L19-L41와 `related_nodes()` L42-L54는 Node의 여섯 역할을
Topic/Service/Action 목록 방향으로 역집계한다. 각 리소스 목록에서는 내부 Monitor Node를 제외하지만 raw
endpoint 진단값과 Interface Lab 실행 사실은 유지한다.

주요 여부는 Monitor가 system primary와 사용자 별표를 합쳐 `is_primary`로 제공한다.
Frontend `utils/nodeFilters.js` L1-L24은 내부 Node와 최종 `is_primary`를 포함한 목록 filter를 사용한다.
