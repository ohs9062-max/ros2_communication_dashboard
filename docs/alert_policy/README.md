# Alert Policy Documentation

이 디렉터리는 ROS2 Dashboard의 실제 Alert 생성 기준, 생명주기, MariaDB 영속 이력과 화면 정책을 정리합니다.
코드와 문서가 다르면 실제 코드를 먼저 확인하고 문서를 함께 갱신합니다.

## 책임 경계

| 계층 | 책임 |
|---|---|
| ROS2 Monitor | ROS2 Graph와 사용자 실행 결과를 기반으로 Alert 후보와 현재 상태 계산 |
| FastAPI Backend | Monitor Alert 수신, 현재/해결 전이 관리, MariaDB 이력 저장과 조회 |
| MariaDB | 과거 Alert 이력 영구 보존. 실시간 Monitor transport로 사용하지 않음 |
| Frontend | 현재 Alert와 이전 Alert 표시, 이전 Alert `name` 검색과 페이지 이동 |

Backend는 현재 MariaDB 저장/조회 경로를 사용합니다. DB 연결 실패 시 ROS2 Monitoring을 유지하기 위해
메모리 이력으로 fallback하며, 이 fallback 이력만 Backend 재시작 시 사라집니다. 확정 스키마와 전이 정책은
[05_alert_lifecycle.md](./05_alert_lifecycle.md)를 기준으로 합니다.

## 현재 실제 Alert 21종

| 문서 | Source | 코드 수 |
|---|---|---:|
| [01_topic_alerts.md](./01_topic_alerts.md) | `topic` | 5 |
| [01_topic_alerts.md](./01_topic_alerts.md) | `monitor_status` | 3 |
| [02_service_alerts.md](./02_service_alerts.md) | `service` | 4 |
| [03_action_alerts.md](./03_action_alerts.md) | `action` | 8 |
| [04_node_alerts.md](./04_node_alerts.md) | `node` | 1 |

전체 목록은 [00_total_alert.md](./00_total_alert.md)에 있습니다. QoS는 확정된 `incompatible`만
Topic/Service/Action Alert에 포함하며 `partial`, `unknown`, `observed`, `graph_unavailable`은 제외합니다.
`service_waiting_server`, `action_waiting_server`와 Service Active Check 내부 상태도 현재 Alert builder가
실제 Alert code로 생성하지 않습니다.

## 공통 표시 원칙

- lifecycle 상태는 `발생 중` 또는 `해결됨`입니다.
- level은 `warning`, `error`, `critical`이며 상태와 별도로 유지합니다.
- 현재 Alert는 `resolved_at IS NULL`, 이전 Alert는 `resolved_at IS NOT NULL`로 구분합니다.
- DB에는 전체 이력을 보존하고, 이전 Alert 화면만 최신 해결 순으로 50개씩 조회합니다.
- 이전 Alert 검색은 Node에 한정하지 않고 Topic, Service, Action, Node의 `name` 전체를 대상으로 합니다.

## 정상 대기 상태

Service server만 있고 client가 없는 상태, Action server만 있고 goal client가 없는 상태, 일반 Topic에
subscriber가 없는 상태는 기본 Alert가 아닙니다. 필수 stream/command 정책에 명시된 대상만 별도 기준으로
판정하며, Graph에 보인다는 사실만으로 메시지 수신 정상이나 QoS 호환을 단정하지 않습니다.
