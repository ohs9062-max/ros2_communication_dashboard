# Alert 생명주기와 MariaDB 정책

## 목적과 적용 상태

Alert는 Monitor가 계산하는 현재 ROS2 상태와 사용자 실행 결과에서 생성됩니다. MariaDB의 목적은 이 현재
상태를 계산하는 것이 아니라, 발생하고 해결된 모든 Alert 이력을 Backend 재시작 뒤에도 영구 보존하는 것입니다.

Backend는 `AlertHistoryService`를 단일 저장 진입점으로 사용해 MariaDB와 동기화합니다.
DB 연결 실패 시 ROS2 Monitoring을 중단하지 않고 메모리 최대 50건 fallback을 사용하며 주기적으로 재연결합니다.
격리 TCP proxy 검증에서 DB 연결 중단 중 Backend 응답과 메모리 fallback이 유지되고 복구 뒤 같은 Backend가 기존
MariaDB 이력을 다시 조회하는 것을 확인했습니다.

## 현재 구현 생명주기

```text
source별 Alert builder
→ Monitor가 현재 후보 조립
→ retained active/resolved 상태 갱신
→ Backend AlertHistoryService가 active/resolved 분리
→ MariaDbAlertRepository transaction 동기화
→ GET /ros/alerts, GET /ros/alerts/history
```

- 같은 active Alert는 안정적인 `id`를 유지하며 polling마다 별도 history 항목을 만들지 않습니다.
- 상태형 Alert가 사라지면 resolved로 전환하고 `resolved_at`을 기록합니다.
- DB 연결 시 현재/이전 Alert는 MariaDB에서 조회하고 이전 이력은 전체 보존합니다.
- DB 장애 시 사용하는 Monitor/Backend 메모리 history 제한은 50건입니다.
- 현재 Alert dismiss 상태는 기존 동작을 유지하기 위해 Backend 메모리에 보관합니다.
- 현재 Alert 객체의 실제 필드와 source별 조건은 [README.md](./README.md)와 각 source 문서를 참고합니다.

## 확정 MariaDB 스키마

MariaDB에는 아래 단일 `alert` 테이블을 사용합니다. Backend runtime은 시작 시 테이블 존재 여부만 확인하고
스키마를 변경하지 않습니다. 제품의 `scripts/install.sh`가 `backend/schema/001_alert.sql`을 멱등 적용하며,
기존 테이블의 필수 컬럼 구조가 다르면 데이터를 변경하지 않고 실패합니다.

```sql
CREATE TABLE IF NOT EXISTS alert (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    alert_key VARCHAR(768) NOT NULL,

    source VARCHAR(64) NOT NULL,

    name VARCHAR(512) NOT NULL,

    code VARCHAR(64) NOT NULL,

    level VARCHAR(16) NOT NULL,

    message TEXT NOT NULL,

    detected_at DATETIME(6) NOT NULL,

    resolved_at DATETIME(6) NULL
);
```

| 컬럼 | 의미 | 예시 |
|---|---|---|
| `id` | DB 내부 식별 번호 | `1042` |
| `alert_key` | 동일 Alert 종류와 대상을 구분하는 안정적인 키 | `topic:/scan:topic_stale` |
| `source` | Alert 출처 | `topic`, `service`, `action`, `node`, `monitor_status` |
| `name` | Alert 대상 이름 | `/scan`, `/navigate_to_pose` |
| `code` | 실제 Alert code | `topic_stale`, `action_goal_aborted` |
| `level` | 원래 심각도 | `warning`, `error`, `critical` |
| `message` | 사용자에게 보여줄 설명 | `Topic message is stale.` |
| `detected_at` | 이번 발생 건의 최초 감지 시각 | `2026-08-11 09:30:00.123456` |
| `resolved_at` | 정상 복귀 시각. `NULL`이면 현재 발생 중 | `2026-08-11 09:31:05.000000` |

Lifecycle 상태를 저장하는 별도 `status` 컬럼은 두지 않습니다. `resolved_at IS NULL`이면 발생 중,
`resolved_at IS NOT NULL`이면 해결됨으로 파생합니다. level은 lifecycle 상태로 덮어쓰지 않습니다.

`detected_at`과 `resolved_at`은 MariaDB의 `DATETIME(6)`에 KST(`UTC+09:00`) 벽시계 값으로 저장합니다.
Backend는 Monitor의 epoch timestamp를 저장할 때 KST로 변환하고, DB 값을 API epoch timestamp로 바꿀 때도
timezone 없는 `DATETIME`을 KST로 해석합니다. 따라서 DB 직접 조회와 한국 시간 기준 UI가 같은 시각을 나타냅니다.

## 저장, 해결, 재발

### 최초 발생

1. Backend가 Monitor에서 Alert 후보를 받습니다.
2. 같은 `alert_key`이며 `resolved_at IS NULL`인 행이 있는지 확인합니다.


3. 없으면 `detected_at`을 최초 감지 시각으로 하여 새 row를 INSERT합니다.

### 장애 지속

같은 `alert_key`의 미해결 row가 있으면 현재 진행 중인 동일 장애입니다. Polling마다 새 row를 INSERT하지
않으며 `detected_at`도 변경하지 않습니다.

### 정상 복귀

현재 snapshot에서 active 조건이 사라지면 해당 미해결 row의 `resolved_at`을 해결 시각으로 UPDATE합니다.

### 해결 후 재발

같은 `alert_key`의 과거 row가 모두 해결된 뒤 장애가 다시 발생하면 별개의 발생 건입니다. 새 `detected_at`과
`resolved_at NULL`로 새 row를 INSERT합니다.

```text
첫 발생 → INSERT(row 1, resolved_at NULL)
지속    → INSERT 없음
해결    → UPDATE(row 1, resolved_at = 해결 시각)
재발    → INSERT(row 2, resolved_at NULL)
```

주어진 스키마에는 “같은 `alert_key`당 미해결 row 1개”를 직접 강제하는 unique constraint가 없습니다.
Repository는 MariaDB advisory lock과 transaction의 `SELECT ... FOR UPDATE`를 함께 사용해 여러 polling이나
Backend worker에서도 확인과 INSERT를 직렬화합니다. 스키마에 명시되지 않은 컬럼은 추가하지 않습니다.

## 저장 범위

- 현재 코드에서 실제 생성되는 21종 Alert의 모든 발생 건을 저장합니다.
- Action QoS는 `action:<name>:action_qos_incompatible:<channel>`을 `alert_key`로 사용해 채널별 발생·해결을 분리합니다.
- DB에는 50건 제한을 두지 않고 전체 이력을 보존합니다.
- DB 장애가 Monitor의 ROS2 상태 계산과 수집을 중단시키면 안 됩니다.
- credential과 연결 문자열은 Backend `.env`, DB 처리는 Repository 계층에서 관리합니다. Backend runtime에는
  migration이 없고 제품 설치기만 `backend/schema/001_alert.sql`을 멱등 적용합니다. 기존 필수 schema가 다르면
  데이터를 변경하지 않고 설치를 실패시킵니다.
- Router에서 직접 SQL을 실행하지 않습니다.

## Alert 화면 정책

### 현재 Alert

조회 조건은 `resolved_at IS NULL`입니다.

| 순서 | 컬럼 | 표시 |
|---:|---|---|
| 1 | 상태 | `발생 중` |
| 2 | 레벨 | 원래 level을 `경고`/`오류`/`치명적`으로 표시 |
| 3 | 출처 | `source` |
| 4 | 이름 | `name` |
| 5 | 메시지 | `message` |
| 6 | 코드 | `code` |
| 7 | 감지 시각 | `detected_at` |

현재 Alert에는 해결 시각 컬럼을 표시하지 않습니다.

### 이전 Alert

조회 조건은 `resolved_at IS NOT NULL`이며 `resolved_at DESC`로 정렬합니다.

| 순서 | 컬럼 | 표시 |
|---:|---|---|
| 1 | 상태 | `해결됨` |
| 2 | 레벨 | 발생 당시 원래 level 유지 |
| 3 | 출처 | `source` |
| 4 | 이름 | `name` |
| 5 | 메시지 | `message` |
| 6 | 코드 | `code` |
| 7 | 감지 시각 | `detected_at` |
| 8 | 해결 시각 | `resolved_at` |

`해결됨 | 오류 | action`처럼 lifecycle 상태와 심각도를 별도 컬럼과 배지로 표시합니다.

## 검색과 페이지 조회

- 검색 대상은 `name` 컬럼입니다. “노드 검색”으로 한정하지 않습니다.
- `/scan`, `/navigate_to_pose`, `/RobotControl`, `/demo_can_control_server`처럼 Topic, Service, Action,
  Node 이름을 같은 규칙으로 검색합니다.
- 검색 조건이 있으면 먼저 `name` 조건을 적용한 결과에 페이지 처리를 적용합니다.
- 이전 Alert는 최신 해결 순이며 페이지당 50개입니다.
- UI의 50개 제한은 조회 단위일 뿐 DB 보존 한도가 아닙니다.

## 현재 Backend 연결 흐름

```text
Monitor 현재 Alert snapshot
→ Backend lifecycle service가 alert_key 기준 active set 비교
→ Repository transaction에서 기존 미해결 row 확인
→ 최초 발생 INSERT / 정상 복귀 UPDATE / 지속 중 INSERT 없음
→ 현재 API: resolved_at IS NULL 조회
→ 이전 API: name 검색 + resolved_at DESC + 50개 페이지 조회
→ Frontend 현재 Alert / 이전 Alert 표시
```

기존 `/ros/alerts` 응답 key와 삭제 동작을 유지하며 schema·Repository, Backend service, API,
Frontend 페이지 조회를 각 책임 경계에 맞게 관리합니다.

## 연결 설정

Backend `.env`에서 `ALERT_DB_ENABLED`, `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_DATABASE`,
`MARIADB_USER`, `MARIADB_PASSWORD`를 설정합니다. 로컬 Unix socket은 `MARIADB_UNIX_SOCKET`으로 선택할 수
있고, timeout/retry는 `MARIADB_CONNECT_TIMEOUT_SEC`, `MARIADB_RETRY_INTERVAL_SEC`로 관리합니다.
비밀번호는 코드, 문서, 로그에 기록하지 않습니다.

제품 설치기는 Fresh Ubuntu의 MariaDB root unix_socket 인증으로 전용 DB와 계정을 자동 준비합니다. 비밀번호가
비어 있을 때만 랜덤 secret을 생성하고 기존 `.env` 값은 재설치에서도 유지합니다. Schema/검증은 설치기 root
경로가 담당하며 Backend 계정에는 해당 DB의 SELECT, INSERT, UPDATE, DELETE만 부여합니다.
