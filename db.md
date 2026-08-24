# MariaDB Alert 저장소

MariaDB는 ROS2 snapshot이나 Interface Lab 실행 이력이 아니라 Alert 발생·해결 이력만 저장한다.

## 제품 설치

```bash
cd ~/rang/ros2_dashboard
./scripts/install.sh
```

설치기는 `backend/.env`의 DB 설정을 사용해 MariaDB service, DB와 사용자, 최소 SELECT/INSERT/UPDATE/DELETE 권한,
`backend/schema/001_alert.sql`의 `alert` 테이블을 멱등 준비한다. 기존 DB와 row는 삭제하지 않으며 필수 9개 컬럼이나
`id` primary key가 다르면 자동 변형하지 않고 실패한다.

```bash
cd ~/rang/ros2_dashboard
./backend/.venv/bin/python scripts/check_database.py
```

## 현재 스키마

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`resolved_at IS NULL`이면 현재 발생 중이고 값이 있으면 해결 이력이다. `status`, `acknowledged`,
`occurrence_count`, `last_detected_at`, JSON detail 컬럼은 사용하지 않는다.

DB 장애 중 Backend는 메모리 fallback으로 Monitoring을 유지하고 설정 주기로 재연결한다. 메모리 fallback에서만
생긴 이력은 Backend 재시작 시 사라질 수 있다. 자세한 전이는
[`docs/alert_policy/05_alert_lifecycle.md`](docs/alert_policy/05_alert_lifecycle.md)를 따른다.
