# HTTPS / WSS reverse proxy

TLS는 Nginx에서 종료한다. 외부 Browser는 HTTPS와 WSS만 사용하고, Nginx는 localhost의 기존
FastAPI `http://127.0.0.1:8000` 및 `ws://127.0.0.1:8000/ws/monitor`로 전달한다. FastAPI에
인증서나 TLS 설정을 추가하지 않는다.

## 설정과 실행

로컬 Ubuntu에서는 `config/nginx/dashboard.env.example`을 참고해 Git에서 제외된
`config/nginx/dashboard.env`를 만든 뒤 설치 스크립트를 실행한다. 스크립트는 인증서가 없으면 localhost,
127.0.0.1, 현재 LAN IPv4를 SAN에 넣은 self-signed 인증서를 생성하고, Frontend dist와 Nginx conf.d 설정을
설치한다. Nginx는 systemd enabled 상태로 유지된다.

```bash
cd frontend && npm run build && cd ..
sudo ./scripts/install_local_https.sh
sudo nginx -T | grep -A5 ros2-dashboard
sudo ss -lntp | grep ':443'
```

Frontend는 `VITE_API_BASE_URL`이 비어 있으면 현재 page origin을 사용한다. 따라서 HTTPS로 접속하면
REST는 같은 HTTPS host, WebSocket은 자동으로 `wss://<현재-host>/ws/monitor`를 사용한다. 로컬
`npm run dev`에서는 Vite가 `/health`, `/ros`, `/ws`를 기존 Backend 8000 포트로 proxy하므로 HTTP/WS
개발 방식도 유지된다. API를 별도 origin으로 운영해야 할 때만 `VITE_API_BASE_URL`을 설정한다.

개발용 self-signed 인증서를 사용할 수 있지만 Browser가 인증서를 신뢰하도록 등록해야 한다. 인증서가
신뢰되지 않으면 HTTPS 또는 WSS 연결이 거부될 수 있다.
