# HTTPS / WSS reverse proxy

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

`sudo ./scripts/install.sh`가 production Frontend를 빌드·복사하고 Nginx 설정과 인증서를 준비한다. 인증서가 없을
때만 localhost, 127.0.0.1과 현재 LAN IPv4를 SAN으로 넣은 self-signed 인증서를 생성한다. 기존 인증서와 private
key는 재설치 시 보존하며 key는 `0600`으로 유지한다. 기존 Nginx 설정은 적용 전에
`/var/backups/ros2-dashboard/<시각>/`에 백업한다.

환경별 경로 또는 포트를 직접 조정할 때는 `config/nginx/dashboard.env.example`을 참고한다.

```bash
sudo ./scripts/install_local_https.sh
sudo nginx -t
sudo systemctl reload nginx
```

Frontend는 `VITE_API_BASE_URL`을 비운 production build를 사용하므로 REST와 WebSocket이 현재 page origin을
따른다. HTTPS 페이지에서는 WebSocket URL이 자동으로 `wss://<현재-host>/ws/monitor`가 된다.

개발 모드의 Vite/HMR은 `scripts/run_dashboard_stack.sh`로 별도 실행한다. 제품 Nginx `/`는 Vite로 proxy하지
않으므로 개발 화면은 `http://127.0.0.1:5173`에서 직접 확인한다.

self-signed 인증서는 사내 로컬 장비용이다. 브라우저가 인증서를 신뢰하지 않으면 HTTPS/WSS가 거부될 수 있으며,
인터넷 공개 인증, 방화벽 설정과 사용자 인증은 현재 범위에 포함되지 않는다.

현재 host의 설치·재설치와 재부팅 후 HTTPS `200`, WSS `101 Switching Protocols`, 기존 인증서 해시와 private key
권한 보존을 확인했다.
