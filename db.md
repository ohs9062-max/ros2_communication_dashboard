# MariaDB Alert 저장소 준비

MariaDB는 실시간 ROS2 데이터가 아니라 Alert 발생·해결 이력만 저장한다. Backend는 DB나 테이블을 자동 생성하지
않으므로 운영자가 먼저 준비한다. 계정명과 비밀번호는 `backend/.env`의 값과 맞추고 저장소에 비밀값을 기록하지 않는다.

```sql
CREATE DATABASE ros2_dashboard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'ros2_dashboard'@'localhost'
  IDENTIFIED BY '<MARIADB_PASSWORD>';

GRANT ALL PRIVILEGES ON ros2_dashboard.*
  TO 'ros2_dashboard'@'localhost';

USE ros2_dashboard;

CREATE TABLE alert (
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

FLUSH PRIVILEGES;
```

별도 `status`, `acknowledged`, `occurrence_count`, `last_detected_at`, JSON detail 컬럼은 사용하지 않는다.
`resolved_at IS NULL`이면 현재 발생 중, 값이 있으면 해결된 이력이다. 자세한 lifecycle은
[`docs/alert_policy/05_alert_lifecycle.md`](docs/alert_policy/05_alert_lifecycle.md)를 따른다.
