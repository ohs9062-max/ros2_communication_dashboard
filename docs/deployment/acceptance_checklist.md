# 설치 제품 검수 체크리스트

지원 기준은 인터넷과 sudo 권한이 있는 Ubuntu 24.04 `amd64`/`arm64` 장비다. 항목을 실제 장비에서 수행한
경우에만 체크한다. Container 검증은 ROS2 discovery, systemd, DDS와 재부팅 검증을 대체하지 않는다.

## 설치와 보존

- [ ] ROS2, Node.js, MariaDB가 없는 Fresh Ubuntu에서 `./scripts/install.sh` 성공
- [ ] MariaDB 수동 로그인 없이 전용 DB/계정/랜덤 비밀번호/schema 자동 준비
- [x] 설치 직후 `./scripts/status.sh`의 필수 항목 정상
- [x] `install.sh` 두 번째 실행 성공
- [x] 재설치 전후 Alert row와 해결 이력 보존
- [x] Interface Registry와 apply 상태 보존
- [x] `backend/.env`와 `/etc/ros2-dashboard/dashboard.env` 보존
- [x] TLS 인증서와 private key 보존
- [x] 일반 사용자가 workspace와 Frontend source를 계속 수정 가능

## Local AI 설치

- [ ] Ollama가 없는 Fresh Ubuntu에서 공식 Linux installer로 service 준비
- [x] installer는 Ollama runtime/service와 `/api/tags` 응답만 준비하고 model pull·show·chat을 실행하지 않음
- [x] 실행 가능한 Ollama와 systemd unit이 있으면 재설치 분기 생략
- [x] 기존 `backend/.env` Local AI 값 보존 및 누락 key만 `.env.example`에서 보완
- [ ] Local AI 첫 요청에서 설정 모델 누락 Modal → 비동기 pull → 실제 byte/percent 표시 → 원래 분석 1회 재개
- [ ] 이미 설치된 설정 모델은 pull 없이 기본/다른 관점 분석을 즉시 실행
- [ ] 여러 Browser 요청이 겹쳐도 Backend process에서 model pull은 하나만 실행
- [ ] 실제 전체 installer에서 Local AI 준비 실패 후 Dashboard 핵심 설치 완료

## 서비스 수명주기

- [x] `./scripts/start.sh` 성공
- [x] `./scripts/stop.sh`가 Monitor/Backend만 중지
- [x] `./scripts/status.sh`가 실패 component와 journal 명령 표시
- [x] `ros2-dashboard.target` enabled 상태
- [x] 재부팅 후 Monitor, Backend, Nginx, MariaDB 자동 복구
- [x] Monitor 중단 중 Backend가 종료되지 않고 마지막 snapshot/fallback 유지
- [x] MariaDB 장애와 복구 시 Backend memory fallback/reconnect 정상

## 기능 회귀

- [x] Topic discovery/수신/Publish 및 missing/stale/disconnected
- [x] Service discovery/Call/timeout/failure
- [x] Action discovery/Goal/Feedback/Result/Cancel
- [x] Node 통신 관계와 Graph 이탈/재등장
- [x] Alert 발생/resolve/재발과 MariaDB 이력
- [x] QoS compatible/partial/incompatible 및 Action 채널 구분
- [x] Interface 등록/upload/build/apply와 실행 History
- [x] Camera Image/CompressedImage demand preview
- [x] HTTPS REST와 WSS snapshot
- [x] 1440×1000 Overview/Topics/Services/Actions/Nodes/Alerts/Interface Lab 검수

## 데모 E2E (제품 설치와 별도)

- [x] demo nodes 실행과 Topic/Service/Action 왕복
- [x] Gazebo TurtleBot3 `/cmd_vel` 전진
- [x] 회전 후 zero velocity 정지
- [x] Dashboard Topic 화면에서 명령 통신 관찰

## 자동 테스트

- [x] Monitor 전체 pytest
- [x] ROS workspace `colcon build/test/test-result`
- [x] Backend 전체 pytest
- [x] Frontend unit/oxlint/production build
- [x] Python compileall
- [x] `git diff --check`

Dashboard 전체 host 검증 기준일은 2026-08-13이다. Local AI installer runtime/helper 분기는 2026-09-01에
검증했다. Ollama가 전혀 없는 별도 Fresh Ubuntu 최초 설치와 Browser 기반 실제 대용량 모델 pull은 수행한
경우에만 남은 미체크 항목을 완료로 바꾼다.
