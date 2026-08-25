# HTTPS / WSS reverse proxy

이 문서의 대상은 외부 서버로의 production 배포가 아니라 Dashboard가 설치된 **로컬 ROS2 장비에서 사용하는
Nginx HTTPS/WSS 실행 환경**이다. Browser는 같은 장비의 localhost 또는 LAN IP로 접속한다. 소스 변경 뒤
`frontend/dist`를 `/var/lib/ros2-dashboard/frontend`에 복사하는 과정은 이 문서에서 로컬 HTTPS 실행 파일
동기화라고 부르며, 별도 원격 배포를 뜻하지 않는다.

제품 모드의 TLS는 Nginx에서 종료한다. Browser는 HTTPS/WSS를 사용하고, Nginx는 production Frontend 정적
파일을 직접 제공하면서 FastAPI REST와 `ws://127.0.0.1:8000/ws/monitor`를 proxy한다. FastAPI, Monitor,
Frontend build에 인증서 설정을 넣지 않는다.

```text
Browser HTTPS/WSS
  → Nginx :443
    /assets, /              → /var/lib/ros2-dashboard/frontend
    /health, /ros           → FastAPI 127.0.0.1:8000
    /user-preferences       → FastAPI 127.0.0.1:8000
    /ws/monitor             → FastAPI WebSocket 127.0.0.1:8000
```

`./scripts/install.sh`가 시작 시 sudo 인증을 요청한 뒤 production Frontend를 빌드·복사하고 Nginx 설정과 인증서를 준비한다. 기본 LAN
IPv4는 사용자가 지정한 `DASHBOARD_LOCAL_IP`, 활성 default route interface 주소, 추가 활성 IPv4 순으로 결정한다.
Docker/Podman/libvirt/container bridge는 자동 후보에서 제외하고 IPv6 주소는 현재 자동 인증서 SAN 대상에 넣지 않는다.
결정된 주소와 HTTPS port는 `/etc/ros2-dashboard/network.env`에 기록되어 설치 검증과 `status.sh`가 같이 사용한다.

새 self-signed 인증서는 localhost, 127.0.0.1, 선택된 기본·추가 LAN IPv4를 SAN으로 가진다. 설치기가 생성한
인증서는 certificate fingerprint marker로 구분하며 DHCP 변경으로 SAN이 부족해지면 기존 TLS 파일을 백업한 뒤에만
갱신한다. marker가 없거나 fingerprint가 달라진 인증서는 사용자 관리 인증서로 간주해 자동 덮어쓰지 않고 필요한
SAN을 안내하며 설치를 중단한다. private key는 `0600`으로 유지한다. 기존 Nginx 설정은 적용 전에
`/var/backups/ros2-dashboard/<시각>/`에 백업한다.

환경별 주소, 경로 또는 포트를 직접 조정할 때는 `config/nginx/dashboard.env.example`을 참고한다.
`DASHBOARD_SERVER_NAME_MODE=auto`는 복사된 과거 IP를 현재 활성 주소로 교체하면서 DNS 이름은 보존하고,
`manual`은 사용자가 지정한 `DASHBOARD_SERVER_NAME`을 그대로 유지한다. 443 이외의 포트는 Nginx, 설치 검증,
완료 URL과 `status.sh`에 동일하게 적용된다.

```bash
sudo ./scripts/install_local_https.sh
sudo nginx -t
sudo systemctl reload nginx
```

Frontend는 `VITE_API_BASE_URL`을 비운 production build를 사용하므로 REST와 WebSocket이 현재 page origin을
따른다. HTTPS 페이지에서는 WebSocket URL이 자동으로 `wss://<현재-host>/ws/monitor`가 된다.

`npm run build`는 checkout의 `frontend/dist`만 갱신한다. 로컬 HTTPS 화면이 새 UI를 제공하려면 설치 정적 경로
`/var/lib/ros2-dashboard/frontend`도 같은 build여야 한다. UI 미반영 시에는 source dist, 설치 정적 경로,
`https://localhost` 응답의 `index.html`이 참조하는 asset hash를 대조한다. hash가 다르면 브라우저 캐시 문제가
아니라 로컬 HTTPS 정적 파일 미동기화다.

개발 모드의 Vite/HMR은 `scripts/run_dashboard_stack.sh`로 별도 실행한다. 제품 Nginx `/`는 Vite로 proxy하지
않으므로 개발 화면은 `http://127.0.0.1:5173`에서 직접 확인한다.

self-signed 인증서는 사내 로컬 장비용이다. 브라우저가 인증서를 신뢰하지 않으면 HTTPS/WSS가 거부될 수 있으며,
인터넷 공개 인증, 방화벽 설정과 사용자 인증은 현재 범위에 포함되지 않는다.
UFW가 active인데 선택한 HTTPS TCP port의 allow rule을 확인하지 못하면 설치기는 정책을 바꾸지 않고 명령과 함께
경고한다. localhost 검증은 필수이며 장비가 자기 LAN 주소로 접속할 수 있으면 production HTML, `/health`, TLS SAN,
WSS upgrade까지 확인한다. host firewall 또는 hairpin routing 때문에 자기 주소 접속만 실패하면 설치는 유지하되
다른 LAN 장비에서 확인할 URL을 명확히 출력한다.

현재 실행 중인 host에서는 선택 LAN IPv4의 HTTPS `200`, `/health` `200`, WSS `101 Switching Protocols`와
8000/8765/8766의 localhost bind를 확인했다. 이번 네트워크 선택 변경을 적용한 전체 재설치는 별도 물리 장비/VM에서
추가 확인해야 한다.
