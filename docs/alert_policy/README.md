# Alert Policy Documentation

이 디렉터리는 ROS2 Communication Monitor Dashboard의 모든 Alert 정책을 문서화합니다.

## Alert 소유권과 책임 경계

| 계층 | 책임 |
|---|---|
| **ROS2 Monitor** (`ros2_dashboard_monitor`) | Publisher/Subscriber, Server/Client, Graph 존재, latest, Hz, age, missing, stale 등 **ROS2 사실 기반 Alert 판정**. Alert 생성, 상태 보존(active/resolved), 해제 이력 |
| **FastAPI Backend** (`backend/app/alerts/`) | Monitor에서 전달받은 Alert의 **해결 이력**, 사용자 확인(dismiss) 상태, 조회 응답 관리 |
| **Frontend** | Alert 표시, 사용자 dismiss UI, 이력 조회 |

> **MariaDB**는 향후 Backend의 Alert 이력·조회·사용자 확인 영속 저장소로 사용합니다.
> ROS2 실시간 Monitor transport로는 사용하지 않습니다.

---

## Alert 공통 데이터 모델

모든 Alert는 아래 필드를 가집니다:

```text
id                : 고유 식별자 (source:name:code 형식)
level             : info | warning | error | critical
source            : topic | service | action | node | monitor_status
name              : 대상 리소스 이름 (/scan, /navigate_to_pose, 등)
code              : Alert 유형 식별 코드 (topic_stale, service_call_timeout, 등)
message           : 사용자에게 표시할 한줄 설명
status            : 대상 리소스의 현재 상태 문자열
last_received_at  : 마지막 수신/응답 시각 (Unix timestamp)
age_sec           : 마지막 수신으로부터 경과한 시간 (초)
detected_at       : Alert 최초 감지 시각 (Unix timestamp)
```

상태 보존 Alert(retained)는 아래 추가 필드를 가집니다:

```text
active            : boolean (현재 활성 여부)
alert_state       : active | resolved
first_detected_at : 최초 감지 시각
last_detected_at  : 마지막 감지 시각
resolved_at       : 해결 시각 (null이면 미해결)
```

---

## 통신별 Alert 정책 문서

| 문서 | 대상 통신 | Alert 코드 수 |
|---|---|---|
| [01_topic_alerts.md](./01_topic_alerts.md) | Topic (Publisher/Subscriber, 메시지 수신, Hz, Stale, MonitorStatus) | 5개 |
| [02_service_alerts.md](./02_service_alerts.md) | Service (연결 끊김, Call 타임아웃, Call 실패, Active Check) | 7개 |
| [03_action_alerts.md](./03_action_alerts.md) | Action (연결 끊김, Goal 거부/중단/취소/전송실패, Result 타임아웃/수신실패) | 7개 |
| [04_node_alerts.md](./04_node_alerts.md) | Node (Graph 이탈, 연결 끊김) | 1개 |
| [05_alert_lifecycle.md](./05_alert_lifecycle.md) | Alert 생명주기 (Active, Resolved, Retained, Dismissed, History) | - |

---

## 정상 대기 상태 정책 (Alert 제외 기준)

AGENTS.md에 따라, 아래 정상 대기 상태는 **기본 Alert 제외** 대상입니다:

| 상태 | 설명 | 근거 |
|---|---|---|
| Service server만 있고 client 없음 | 요청 대기형 Service의 정상 상태 | 서비스는 호출을 기다리는 것이 정상 |
| Action server만 있고 goal client 없음 | Goal 대기 상태 | Action은 Goal 요청을 기다리는 것이 정상 |
| Topic subscriber 없음 (일반 Topic) | 발행만 하는 Topic | 구독자가 없어도 발행자가 있으면 정상 |
| `command_names`에 포함된 Topic | 명령 Topic (예: `/cmd_vel`) | 의도적으로 Alert 생성을 제외 |

---

## Alert Level 요약

| Level | 의미 | 사용 기준 |
|---|---|---|
| `info` | 참고 정보 | 현재 코드에서는 직접 생성하지 않음 (MonitorStatus에서만 가능) |
| `warning` | 주의 필요 | 메시지 미수신, stale, Goal 거부/취소/Result 타임아웃, Call 타임아웃, Publisher 대기 |
| `error` | 오류 발생 | 연결 끊김, Goal 중단/전송실패, Call 실패, Result 수신 실패, Node 이탈 |
| `critical` | 위험 | MonitorStatus 메시지에서 보고한 critical 수준 |
