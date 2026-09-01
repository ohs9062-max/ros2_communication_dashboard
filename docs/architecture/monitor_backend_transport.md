# Monitor ↔ Backend transport

## 선택

localhost HTTP/JSON을 사용합니다. 기존 FastAPI request/response 모델을 가장 적게
변경하면서 프로세스 경계를 명확히 만들고, Unix socket 배포 설정이나 별도 broker 없이
상태 확인과 장애 로그를 표준 HTTP 도구로 확인할 수 있기 때문입니다. MariaDB는 실시간
전달에 사용하지 않습니다.

Monitor는 기본적으로 `127.0.0.1:8765`에만 bind합니다. Backend의
`MONITOR_BASE_URL`로 변경할 수 있습니다. 외부 클라이언트는 이 포트가 아니라
Backend의 공개 API만 사용합니다.

## 흐름

```text
ROS2 Graph
  → ros2_dashboard_monitor
  → GET /transport/snapshot
  → Backend MonitorEventConsumer
  → thread-safe MonitorCache / AlertHistoryService
  → REST / ws/monitor
  → React
```

## Snapshot schema

`GET /transport/snapshot`:

```json
{
  "success": true,
  "data": {
    "topics": {},
    "services": {},
    "actions": {},
    "nodes": {},
    "domains": {},
    "alerts": {},
    "websocket": {},
    "interface_apply": {}
  }
}
```

Backend는 1초 기본 주기로 이를 polling합니다. 실패 시 마지막 cache를 유지하고
`/health`의 `monitor_connected`, `monitor_error`에 장애 원인을 노출합니다.

Topic payload는 Graph 원본 `status`와 목록·요약에 사용하는 `effective_status`를 함께 보존합니다. Service와
Action의 최근 사용자 실행 결과도 각 resource snapshot에 합쳐지며 Frontend는 같은 snapshot을 공통 presentation
selector로 표시합니다. Camera binary/data URL과 Topic/Service/Action recent history 전체는 정기 snapshot과
WebSocket에 포함하지 않습니다. Camera는 `/ros/topics/image-preview`, 최근 통신값은 각 resource의
`/ros/.../history` 상세 요청 경로로만 전달합니다.

Service history는 Monitor가 실제 값을 확보하는 Interface Lab Call만 반환합니다. Fast DDS observer는 endpoint
discovery/QoS만 수집하므로 외부 Client의 Request/Response payload를 만들지 않습니다. Action history는 Interface Lab
Goal과 실제 Status/Feedback Subscription, terminal Status 뒤 GetResult로 얻은 Result를 합칩니다. 외부 Goal과 rejected
응답은 Service payload라 관찰할 수 없으며, 관찰 event는 source와 `goal=null`을 명시합니다.

## Commands

기존 `/ros/interfaces/*` request body와 response key를 유지한 채 Backend가 raw body,
query string, content type을 Monitor로 전달합니다. 따라서 Topic Publish/Receive,
Service Call, Action Goal/Cancel, interface upload/apply/import-check가 동일 API 경로를
사용합니다. Multipart 파일도 body를 변경하지 않고 전달합니다.

사용자 별표 YAML은 Backend만 저장합니다. Backend는 변경된 목록을
`PUT /transport/priority`로 보내며 Monitor는 메모리 mirror만 유지합니다.

## Alert AI

Alert AI는 Monitor proxy command가 아니라 Backend가 소유한다. Cloud 분석은
`POST /ros/alerts/ai-diagnosis`, Local 분석은 `POST /ros/alerts/ai-diagnosis/local`을 사용하며 서로 fallback하지
않는다. Local 모델 상태와 다운로드 시작은 각각
`GET`/`POST /ros/alerts/ai-diagnosis/local/model`이다. Backend는 Ollama `/api/pull`의 streaming 진행률을 process 내
background task로 유지하므로 Browser 요청을 장시간 붙잡지 않고, 모델 준비 뒤 처음 요청한 기본 또는 다른 관점 분석을
한 번 실행한다.

현재 Cloud와 Local은 같은 `AlertDiagnosisService._build_context()`를 사용한다. 선택한 Alert, 현재 Monitor cache의
resource summary, Topic·Service·Action에 한정한 최근 history 최대 5건을 넣고, 현재 Runtime이 Alert 당시 snapshot이
아님을 명시한다. 두 경로는 같은 `SYSTEM_INSTRUCTION`과 `DIAGNOSIS_SCHEMA`로 structured JSON을 검증한다. Local은
Ollama `/api/chat`에 요청당 한 번만 보내며 `num_predict=2048`, 한국어 설명 검증과 Ollama가 준
`prompt_eval_count`·`eval_count`·duration INFO 로그를 사용한다.

## Failure behavior

- Monitor 중단: Backend와 Frontend WebSocket은 계속 실행되고 cache 연결 상태가 false가 됩니다.
- Backend 중단: Monitor의 ROS2 수집은 계속 실행됩니다.
- command 전달 실패: Backend가 HTTP 503과 구체적인 연결 오류를 반환합니다.
- polling 실패: 마지막 성공 snapshot을 보존합니다.

실제 30초 Monitor timeout 동안 Backend PID와 마지막 Topic snapshot이 유지되고 Monitor 복구 후 같은 Backend가
자동 재연결되는 것을 확인했습니다. DB 장애도 snapshot transport와 분리돼 Alert 조회만 메모리 fallback으로
전환됩니다.
