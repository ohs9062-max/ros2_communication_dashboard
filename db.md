CREATE DATABASE ros2_dashboard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'ohs'@'localhost'
  IDENTIFIED BY '<backend/.env의 MARIADB_PASSWORD>';

GRANT ALL PRIVILEGES
  ON ros2_dashboard.*
  TO 'ohs'@'localhost';

FLUSH PRIVILEGES;
