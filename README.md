# ROS2 Communication Monitor

단일 ROS2 기기의 Node, Topic, Service, Action 통신 상태와 장애 원인을 확인하는 사내 진단 Dashboard다.
Topic 데이터 흐름, Service/Action 실행 결과, QoS 호환성, Alert 이력, Camera Preview와 Interface Lab을 제공한다.

## 지원 환경

최초 설치에 필요한 사전 조건은 다음뿐이다.

- Ubuntu 24.04 (`amd64` 또는 `arm64`)
- 인터넷 연결
- `sudo` 권한
- 이 저장소의 소스

`scripts/install.sh`가 ROS2 Jazzy, ROS 개발 도구, Node.js, Python 의존성, MariaDB, Nginx를 설치하고
ROS workspace와 production Frontend를 빌드한다. 또한 Backend `.env`의 `LOCAL_LLM_URL`,
`LOCAL_LLM_MODEL`, `LOCAL_LLM_TIMEOUT`을 기준으로 localhost Ollama runtime과 service를 준비한다.
이미 실행 가능한 Ollama는 재설치하거나 재시작하지 않으며 Local AI runtime 준비 실패는 원인을 경고하고
Dashboard 핵심 설치를 계속한다. 설정 모델은 사용자가 처음 Local AI 분석을 요청할 때 Dashboard에서 설치 여부를
확인하고, 누락된 경우 다운로드 확인 Modal과 Ollama의 실제 byte/percent 진행률을 표시한다. Gazebo, TurtleBot3, 실제 장비 드라이버와 demo package 의존성은
제품 필수 설치에서 제외한다. 설치 프로세스는 `C.UTF-8`을 사용하지만 시스템 locale과 사용자 언어,
netplan/NetworkManager 연결 설정은 변경하지 않는다.

기존 Python, Node.js와 다른 ROS2 배포판은 삭제하거나 기본 버전을 교체하지 않는다. Dashboard Backend는
side-by-side `/usr/bin/python3.12`로 만든 전용 `backend/.venv`, Monitor는 명시적인 ROS2 Jazzy/Python 3.12,
Frontend build는 `/opt/ros2-dashboard/toolchains/node`의 전용 Node.js를 사용한다.

## 최초 설치

일반 사용자 계정으로 저장소를 받은 뒤 다음을 실행한다.

```bash
git clone <repository>
cd ros2_dashboard
cp -n backend/.env.example backend/.env
# backend/.env의 ROS_DOMAIN_ID와 RMW_IMPLEMENTATION을 장비에 맞게 설정
./scripts/install.sh
```

설치 시작 시 관리자 권한이 필요한 이유를 안내하고 `sudo` 인증을 한 번 요청한다. 빌드와 전용 venv 생성은
로그인한 일반 사용자로 실행하고, 패키지·systemd·Nginx·MariaDB 작업에만 관리자 권한을 사용한다.

설치 스크립트는 재실행할 수 있다. 기존 MariaDB Alert 이력, Interface Registry, Backend `.env`,
runtime 환경 설정과 TLS 인증서는 삭제하거나 초기화하지 않는다. 상세 설치 로그는
`/var/log/ros2-dashboard/install.log`에 저장되며 기존 systemd/Nginx 설정은
`/var/backups/ros2-dashboard/<시각>/`에 백업한다. 제품 unit을 정지한 뒤에도 `8000` 또는 `8765`가 점유돼 있으면
다른 프로세스를 정상 설치로 오인하지 않고 중단한다.

Local AI 기본값은 `backend/.env.example`에서 새 `.env`로 복사하거나 누락 key에만 보완한다. 기존 Local AI
설정과 기존 Ollama 모델은 덮어쓰거나 삭제하지 않는다. 설치 스크립트는 모델을 다운로드하거나 추론 검증하지 않는다.
기본 loopback URL이 아닌 값을 사용자가 지정한 경우
설치기는 해당 외부 endpoint를 변경하지 않고 Local AI 준비를 건너뛴다.

`backend/.venv`, ROS workspace build/install/log와 Frontend node_modules/dist는 Git에 포함하지 않는 생성물이다.
설치기는 Backend venv가 현재 checkout·machine·Python과 일치하지 않으면 venv만 새로 만들고
`backend/.venv/bin/python -m pip`로 의존성을 설치한다.

## 실행, 상태 확인, 종료

```bash
./scripts/start.sh
./scripts/status.sh
./scripts/stop.sh
```

`start.sh`는 현재 shell에 명시된 ROS runtime 값을 우선하고, 없으면 `backend/.env`의 마지막 저장값을 사용한다.
결정된 값을 `backend/.env`와 `/etc/ros2-dashboard/dashboard.env`에 동기화하고 값이 바뀌면 Monitor를 재시작한다.
제품 HTTPS 주소는 기본적으로 활성 default route interface의 IPv4를 사용한다. 다중 NIC에서 특정 주소를 우선할
때는 `DASHBOARD_LOCAL_IP=<현재 장비에 할당된 IPv4> ./scripts/install.sh`로 지정할 수 있다. 선택 주소와 port는
`/etc/ros2-dashboard/network.env`에 저장되어 설치 검증과 `status.sh`가 같은 URL을 사용한다.

동일한 작업을 systemd로 직접 수행할 수도 있다.

```bash
sudo systemctl start ros2-dashboard.target
sudo systemctl stop ros2-dashboard.target
systemctl status ros2-dashboard.target
```

설치 시 target은 부팅 자동 시작으로 활성화된다. `stop.sh`는 Dashboard 전용 Monitor와 Backend만 종료하고,
다른 프로그램도 사용할 수 있는 MariaDB와 Nginx는 중지하지 않는다.

## 접속 주소

```text
https://localhost[:설정 port]/
https://<장비 LAN IP>[:설정 port]/
```

이 주소는 별도 원격 production 서버가 아니라 Dashboard와 ROS2가 실행되는 로컬 장비의 Nginx HTTPS 환경이다.
일반 사용과 UI 확인은 Vite 개발 주소가 아니라 위 HTTPS 주소를 기준으로 한다.

최초 설치는 `/etc/nginx/ssl/ros2-dashboard.crt`와 `.key`에 self-signed 인증서를 만든다. 브라우저에서 해당
인증서를 신뢰해야 HTTPS/WSS 연결이 허용된다. Nginx는 `/var/lib/ros2-dashboard/frontend`의 production build를
정적으로 제공하며 Backend REST와 WebSocket을 localhost로 proxy한다. 제품 실행에 Vite 개발 서버는 사용하지 않는다.

## 설정

- ROS runtime 기준값: `backend/.env`
  - `ROS_DOMAIN_ID`
  - `RMW_IMPLEMENTATION` (기본 `rmw_fastrtps_cpp`)
- systemd 반영 파일: `/etc/ros2-dashboard/dashboard.env` (직접 수정하지 않음)
- 설치된 HTTPS 주소/port: `/etc/ros2-dashboard/network.env` (installer가 자동 갱신)
- Monitor 정책: `ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml`
- Interface Registry: 같은 Monitor config 디렉터리의 registry/apply YAML
- Backend/DB: `backend/.env` (설치 시 최초 생성, 권한 `0600`)
- Nginx/TLS: `config/nginx/dashboard.env.example`, `/etc/nginx/ssl/`

`backend/.env`의 기본 ROS Domain/RMW 변경은 runtime env 동기화가 필요하므로 `start.sh`로 반영한다.
Domains 화면에서는 여러 `ROS_DOMAIN_ID`를 동적으로 추가·관리할 수 있으며, Monitor의 `MultiDomainRosMonitor`가
각 Domain별 runtime을 생성하여 다중 Domain 통신 상태를 동시에 감시한다.
Backend/DB 설정만 바꾼 경우에는 Backend service를 재시작한다.

```bash
./scripts/start.sh
sudo systemctl restart ros2-dashboard-backend.service
```

## 구성과 주요 기능

```text
ROS2 Graph / user data
  → ROS2 Monitor + optional Fast DDS observer (127.0.0.1:8765 / 8766)
  → FastAPI Backend (127.0.0.1:8000)
  → Nginx HTTPS/WSS + React production build

MariaDB
  ← Backend Alert lifecycle
```

- Topic missing/stale/disconnected, Pub/Sub, Hz/latest/age, bounded 최근 데이터와 Camera Preview
- Service Server/Client, 사용자 Call과 요청형 Interface Lab Request/Response 이력
- Action Goal/Feedback/Result/Cancel, Interface Lab 실행 및 실제 관찰한 Status/Feedback/Result 이력, 5개 채널 QoS
- Node 통신 역할과 Graph 이탈 감지
- Graph/Fast DDS/RMW 근거를 구분한 QoS 진단과 Alert
- Interface Lab의 등록·build/apply, Topic Publish/Receive, Service Call, Action Goal
- 등록·import 타입 기반 Service/Action Server 개설, Request/Goal/Cancel/Result 처리와 runtime history

목록의 대표 상태는 Backend snapshot을 다시 임의 판정하지 않는다. Topic은 `effective_status`, Service와 Action은
각 도메인의 공통 presentation selector를 사용한다. 최근 값·Request/Response·Feedback/Result를 누르면 전체
payload를 pretty JSON으로 확인할 수 있고, 상세 QoS는 같은 role/scope/profile endpoint를 묶되 GUID/GID identity는
접힌 상세에 모두 보존한다.

MariaDB에는 현재/해결 Alert 이력만 저장한다. ROS2 snapshot과 Interface Lab 실행 이력은 DB 전달 수단이 아니다.
설치 시 전용 DB·계정과 랜덤 비밀번호를 자동 준비하고 `backend/schema/001_alert.sql`을 멱등 적용한다. 사용자가
MariaDB에 직접 로그인할 필요는 없으며 기존 비밀번호와 Alert 이력은 재설치해도 유지한다.

## 개발 모드

제품 systemd 경로와 별개로 기존 개발 workflow를 유지한다.

```bash
./scripts/run_dashboard_stack.sh
# Ctrl+C 또는 별도 터미널에서
./scripts/stop_dashboard_stack.sh
```

개발 모드는 Vite 5173을 사용한다. 제품 서비스와 포트가 겹치므로 동시에 실행하지 않는다.

## 문제 해결

```bash
./scripts/status.sh
journalctl -u ros2-dashboard-monitor -n 100 --no-pager
journalctl -u ros2-dashboard-backend -n 100 --no-pager
sudo nginx -t
systemctl status mariadb nginx
```

- Monitor 연결 실패: `ROS_DOMAIN_ID`, RMW 설정, ROS Graph와 Monitor journal을 확인한다.
- MariaDB 연결 실패: `backend/.env`, `systemctl status mariadb`, Backend journal을 확인한다.
- ROS2 Graph 미발견: Dashboard와 장비가 같은 domain/RMW/discovery 범위인지 확인한다.
- HTTPS/WSS 실패: self-signed 인증서 신뢰 여부와 `sudo nginx -t`를 확인한다.
- 설치 실패: `/var/log/ros2-dashboard/install.log`의 마지막 실패 단계를 확인한다.

검수 절차는 [설치 제품 검수 체크리스트](docs/deployment/acceptance_checklist.md), 운영 정책과 책임 경계는
[AGENTS.md](AGENTS.md)를 기준으로 한다.

현재 Ubuntu 24.04 host에서는 설치·재설치, 보존, start/stop/status, 장애 fallback/reconnect와 재부팅 자동 복구를
확인했다. ROS2·Node.js·MariaDB가 전혀 없는 별도 Fresh Ubuntu 최초 설치만 체크리스트의 미검증 항목으로 남아 있다.
