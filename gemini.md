# ROS2 Dashboard Local AI (Ollama + Gemma) 연동 및 검증 작업 보고서

## 1. 개요

ROS2 Dashboard의 Alerts 상세 Modal에 On-demand Local AI 진단 기능(`[로컬 AI 분석]`)을 성공적으로 연동하고, HTTPS 실환경 검증을 완료했습니다. 기존 Cloud AI(Gemini)와 독립적으로 운영되며, 단일 ROS2 기기의 Alert 원인 분석 및 확인 순서를 구조화된 JSON으로 반환합니다.

---

## 2. 시스템 구성 및 기술 스택

- **Local LLM Engine**: Ollama (`127.0.0.1:11434`)
- **모델**: `gemma3:4b-it-q4_K_M`
- **통신 방식**: FastAPI Backend → Ollama REST API (`POST /api/chat`)
- **출력 포맷**: Structured Output (JSON Schema)
- **보안 및 격리**: 
  - Cloud(Gemini)와 Local(Gemma)은 상호 fallback하지 않음
  - 브라우저 `sessionStorage` 캐시 키 분리 (`alert_ai_diagnosis:<id>` vs `alert_ai_diagnosis:local:<id>`)
  - 환경변수(`LOCAL_LLM_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_TIMEOUT`)는 백엔드 `.env`에서만 관리

---

## 3. 핵심 변경 사항

### 3.1 Backend
- **backend/app/settings.py**: `LOCAL_LLM_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_TIMEOUT` 환경변수 로더 추가
- **backend/app/alerts/ai_diagnosis.py**:
  - `AlertDiagnosisService.diagnose_local()` 메서드 및 `_request_local_llm()` 통신 어댑터 구현
  - Ollama `/api/chat` 대상 JSON Schema 기반 structured output 요청
  - `LocalLlmConfigurationError`, `LocalLlmRequestError` 예외 처리 및 격리
- **backend/app/routers/alerts.py**:
  - 엔드포인트 `POST /ros/alerts/ai-diagnosis/local` 추가
  - 오류 발생 시 안전한 HTTP 502/503 에러 변환 (내부 provider 세부 정보 은닉)
- **backend/tests/test_alert_ai_diagnosis.py**:
  - Local AI 요청/응답 검증, Gemini API Key 독립성, transport failure 격리 단위 테스트 추가

### 3.2 Frontend
- **frontend/src/api/monitoring.js**: `diagnoseAlertLocally()` API 클라이언트 함수 추가
- **frontend/src/pages/AlertsPage.jsx**:
  - `localAiAnalysis`, `localAiLoading`, `localAiError` 상태 및 `analyzeSelectedAlertLocally` 핸들러 구현
  - `sessionStorage` 내 `alert_ai_diagnosis:local:<id>` 캐싱 분리 및 모달 재오픈 시 자동 복원
- **frontend/src/components/AlertDetailModal.jsx**:
  - `[로컬 AI 분석]` / `[로컬 분석 중...]` / `[로컬 다시 분석]` 버튼 상태 UI 연결
  - Alert 상세 Modal 최외곽 컨테이너 맨 아래 border 영역(`.alert-detail-modal-footer`)에 `분석 모델 : <model> · <Local|Cloud>` 렌더링
- **frontend/src/App.css**:
  - Alert 상세 Modal 높이 유연화(`height: auto`, `min-height: min(680px, 85vh)`, `max-height: calc(100vh - 40px)`, `width: min(82vw, 1540px)`)로 불필요한 스크롤 제거
  - Modal 최외곽 하단에 `min-height: 48px`, `padding: 12px 24px`, `border-top: 1px solid var(--border)`의 bottom bar footer 스타일 적용 및 폰트 크기 확대 (13px / 13.5px)




---

## 4. HTTPS 실환경 검증 및 장애 분석

### 4.1 중단 당시 HTTPS 502 오류 원인 분석
- **현상**: systemd 백엔드 서비스 실행 환경에서 `POST /ros/alerts/ai-diagnosis/local` 호출 시 HTTP 502 Bad Gateway 반환
- **원인 확정**: 
  - systemd 서비스 환경이나 Nginx/Ollama 네트워크 단절 문제가 아니었음.
  - 당시 Ollama 서비스 저널 확인 결과(`task 245 / task 2296`), 모델이 `num_predict: 2048` 토큰 제한에 도달할 때까지 토큰을 생성하다 강제 중단되어 닫히지 않은 불완전한 JSON 문자열을 반환함.
  - 백엔드 `_parse_structured_diagnosis()`에서 `JSONDecodeError`가 발생하여 `LocalLlmRequestError`로 포착되었고, 라우터가 이를 클라이언트에 `502 Bad Gateway`로 전달한 것임.

### 4.2 실환경 재검증 결과
- **Local AI 호출**: `POST https://127.0.0.1/ros/alerts/ai-diagnosis/local`
  - **상태 코드**: `HTTP 200 OK`
  - **응답 시간**: 약 **4.49초** (Topic, Service, Action, Node Alert 평균 2.8~4.7초)
  - **반환 Model**: `gemma3:4b-it-q4_K_M`
  - **출력 필드**: `summary`, `evidence`, `likely_causes`, `recommended_checks`, `model`
- **Cloud AI 호출**: `POST https://127.0.0.1/ros/alerts/ai-diagnosis`
  - **상태 코드**: `HTTP 200 OK`
  - **응답 시간**: 약 **2.39초**
  - **반환 Model**: `gemini-3.5-flash-lite`

---

## 5. 테스트 결과 요약

| 검증 항목 | 결과 | 비고 |
|---|---|---|
| **Backend Pytest** | `37 passed, 2 skipped` | Local AI 어댑터 및 라우터 단위 테스트 포함 |
| **Frontend Unit Test** | `20 passed` | 20개 테스트 모듈 전체 통과 |
| **Frontend Lint (`oxlint`)** | `1 warning, 0 error` | 기존 `VisualizationPage` 미사용 인자 warning 1건만 유지 |
| **Frontend Build (`vite build`)** | 정상 통과 | `/var/lib/ros2-dashboard/frontend` 정적 파일 동기화 일치 |
| **Git Diff Check** | 정상 통과 | 공백/개행 오류 없음 (`git diff --check`) |

---

## 6. 유지보수 및 운영 시 숙지사항 (3줄 요약)

1. **Local AI는 `POST /ros/alerts/ai-diagnosis/local`을 통해 로컬 Ollama(`127.0.0.1:11434`)의 `gemma3:4b-it-q4_K_M`과 JSON Schema 기반으로 직접 통신합니다.**
2. **이전 502 오류는 네트워크 단절이 아닌 LLM 토큰 한도(2048) 초과로 인한 불완전 JSON 파싱 이슈였으며, 현재 HTTPS 환경에서 4초대 200 OK로 안정 동작합니다.**
3. **Cloud(Gemini)와 Local(Gemma)은 `sessionStorage` 캐시 및 API가 완전 분리되어 독립적으로 동작하며 상호 fallback하지 않습니다.**
