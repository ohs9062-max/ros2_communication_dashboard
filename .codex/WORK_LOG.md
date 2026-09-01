# WORK LOG

이 파일은 최근 AI 작업 인수인계 기록만 유지한다. 현재 프로젝트 요약은
`.codex/CURRENT_STATUS.md`, 오래된 기록은 `.codex/archive/`를 확인한다.
모든 새 작업은 날짜와 함께 파일 하단에 추가한다.

## 2026-08-31 - Alert 클릭 목적지 Alerts 탭 통일

- `AlertsPreview`와 `AlertsList`의 공통 click delegate는 유지하고, Overview·Topic·Service·Action·Node·Alerts의
  기존 source별 Alert handler를 모두 `onNavigate('alerts')`로 통일했다. Topic/Service/Action/Node 상세 선택,
  Alert 데이터와 Backend/Monitor/DB lifecycle은 변경하지 않았다.
- 기존 Alerts route `/alerts`를 그대로 사용한다. Frontend unit 전체, lint(기존 `VisualizationPage` 미사용 인자 warning 1건),
  production build와 diff check를 통과했고, `Alerts`, `Topics`, `Services`, `Actions`, `Nodes` local HTTPS route가 모두 200이다.
- build를 `/var/lib/ros2-dashboard/frontend`에 동기화했다. source/target `index.html` SHA-256은
  `4532310370bfa29c984d36423d80f8aa5c2e55085f336d5096bd9c697f0196e0`이다.

## 2026-08-31 - Alerts 상세 Modal Gemini AI 진단 연결

- Alerts 행 클릭 시 기존 목록 디자인을 유지한 상세 Modal을 열고, 오른쪽 `AI 피드백`의 `[AI 분석]`을 사용자가
  직접 누를 때만 Backend `POST /ros/alerts/ai-diagnosis`를 호출하도록 구현했다. Modal open·Alert 발생·resource
  조회에서는 Gemini를 호출하지 않으며 요청 중 ref lock과 disabled/loading으로 동일 Alert 중복 호출을 막는다.
- Backend는 기존 `.env` loader와 `httpx`를 재사용한다. 선택 Alert, exact Domain resource의 현재 Monitor 상태와
  기존 Topic/Service/Action history 최근 5건만 제한해 전달하고, 현재 상태가 Alert 발생 시점 snapshot이 아님을
  명시한다. Monitor Runtime, Alert lifecycle/DB schema, history API 계약은 변경하지 않았다.
- Gemini REST structured output을 `gemini-2.5-flash` → `gemini-2.5-flash-lite` →
  `gemini-3.5-flash-lite` 순서로 호출한다. 404/429/일시적 5xx·timeout/transport 오류만 순차 fallback하고
  인증·권한·validation 오류는 즉시 안전한 Backend 오류로 종료한다.
- Backend 전체 test는 29 passed·2 skipped, Frontend unit 전체·lint(기존 `VisualizationPage` warning 1건)·production
  build와 diff check를 통과했다. API key는 Backend `.env`에만 두고 Frontend source/build에 포함되지 않음을 확인했다.
- build를 로컬 HTTPS 정적 경로에 동기화하고 Backend를 재시작했다. 운영 ROS 정보는 외부 전송하지 않고 비민감
  합성 Node Alert로 실제 HTTPS endpoint를 호출해 `gemini-3.5-flash-lite`의 `summary/evidence/likely_causes/
  recommended_checks` 구조화 응답 성공을 확인했다.

## 2026-08-31 - Alerts 상세 Modal 가로 폭 확대

- 공통 `.preview-modal`의 뒤쪽 760px 폭 규칙이 상세 Modal의 단일 class selector를 덮어쓴 원인을 수정했다.
  Desktop Modal은 `.preview-modal.alert-detail-modal`의 더 높은 selector 우선순위로 `width: min(78vw, 1540px)`,
  `height: min(84vh, 900px)`를 적용했다. 1920×1080에서 약 1498px, 1440×900에서 약 1123px 폭이다.
- 2열은 왼쪽 약 48%·AI 피드백 오른쪽 약 52%로 조정했다. 현재 통신 상태 JSON은 최대
  `min(30vh, 280px)`의 내부 scroll만 사용해 Alert 기본 정보보다 과도하게 공간을 차지하지 않으며, 900px 이하의
  기존 단일 열 반응형·높이/scroll 동작은 유지했다. Alert/AI/Backend/Monitor 로직은 변경하지 않았다.

## 2026-08-31 - Alerts AI 분석 버튼 상태 문구 명확화

- `AlertDetailModal`의 기존 `aiLoading`, `aiError`, `aiAnalysis`만으로 버튼 문구를 표시한다. 초기 `AI 분석`,
  요청 중 `분석 중...`, 실패 후 `분석 재시도`, 성공 결과 표시 후 `다시 분석`이며 `onAnalyze`, disabled와 기존
  요청·fallback·중복 방지 로직은 변경하지 않았다.

## 2026-08-31 - Alerts AI 분석 결과 탭 세션 유지

- 성공한 Gemini 구조화 결과만 `sessionStorage`의 `alert_ai_diagnosis:<alert.id>`에 저장한다. Alert ID는 기존
  domain을 포함한 안정 ID여서 같은 resource name의 다른 Alert와 결과를 공유하지 않는다.
- Alert Modal open은 해당 key만 읽어 기존 `aiAnalysis` state에 복원하며 Gemini endpoint를 호출하지 않는다. key가
  없거나 JSON parse/구조 검증에 실패하면 해당 entry를 제거하고 초기 상태를 표시한다. 다른 Alert 선택 시에는 항상
  새 Alert key를 조회해 이전 결과가 섞이지 않는다.
- `[다시 분석]`은 기존 요청을 그대로 수행하며 성공 결과만 화면과 같은 key에 덮어쓴다. 실패 결과는 저장하지 않고,
  Backend/Monitor/DB/API/Modal UI는 변경하지 않았다.
- Frontend unit 전체, lint(기존 `VisualizationPage` warning 1건), production build와 diff check를 통과했다.
  build를 로컬 HTTPS 경로에 동기화했고 source/target `index.html` SHA-256과 Alerts lazy bundle의 sessionStorage
  cache code가 일치하며 `https://127.0.0.1/alerts`는 200을 반환했다.

## 2026-08-31 - 외부 Alert 클릭 후 exact 목록 행 선택

- Overview·Topic·Service·Action·Node의 Alert preview click은 기존 `/alerts` route를 유지한 채 browser history state로
  `alertId`를 전달한다. AlertsPage는 현재 목록을 먼저, 이전 목록을 다음으로 확인해 해당 탭을 선택하고 별도
  `highlightedAlertId`만 설정한다.
- `AlertsList`는 기존 `.topic-table tbody tr.selected` 스타일을 재사용해 일치 행만 강조한다. Modal의
  `selectedAlert` state는 갱신하지 않으므로 외부 Alert click으로 상세 Modal이 자동으로 열리지 않는다.
- Frontend unit 전체, lint(기존 `VisualizationPage` 미사용 인자 warning 1건), production build와 diff check를
  통과했다. build를 local HTTPS 정적 경로에 반영했고 `https://127.0.0.1/alerts`가 200이며 source/target
  `index.html` SHA-256은 `4747669d99197edfcf6063f438abae5e5447b4c557a5954f6a07ec16b7d37abb`로 일치한다.

## 2026-08-31 - Gemini 3단 fallback 404 원인 검수

- 코드 변경 없이 실제 configured `v1beta` 환경의 models/list와 합성 structured-output 요청을 모델별 1회씩
  검수했다. 세 모델은 모두 list에 있고 `generateContent` method도 표기되지만, `gemini-2.5-flash`와
  `gemini-2.5-flash-lite`는 HTTP 404 `NOT_FOUND`와 “new users에 더 이상 제공되지 않음”이라는 제공자 메시지를
  반환했다. `gemini-3.5-flash-lite`만 HTTP 200으로 실제 generation에 성공했다.
- URL은 `<configured-base>/models/<model>:generateContent`이며 base version은 `/v1beta`다. model string은 prefix
  없이 한 번만 조립돼 endpoint/version/model-prefix 구성 오류 근거는 없다. 현재 404는 fallback 대상이므로 AI 분석
  1회마다 1·2순위 404 두 번 뒤 3순위까지 총 세 요청을 보낸다.
- `backend/tests/test_alert_ai_diagnosis.py` 12 passed를 확인했다. 404 응답에는 usage metadata가 없어 token 과금 여부는
  현재 API 응답/로그만으로 확정하지 않았다. 최소 후속안은 실제 성공한 model을 우선순위로 정리하는 것이며 사용자 승인 전
  코드는 수정하지 않았다.

## 2026-08-31 - Gemini 비용 중심 fallback 우선순위 적용

- 변경 전 models/list와 실제 structured-output 합성 요청을 독립 검수해 `gemini-3.5-flash-lite`,
  `gemini-3.1-flash-lite`, `gemini-3.7-flash`가 모두 list에 존재하고 `generateContent`를 지원하며 HTTP 200 및
  기존 JSON schema 파싱에 성공함을 확인했다.
- 기존 model tuple만 위 순서로 교체해 사용 불가한 `gemini-2.5-flash`와 `gemini-2.5-flash-lite`를 실제 후보에서
  제거했다. fallback status/timeout/transport/auth 정책, prompt/context/schema, endpoint와 UI는 변경하지 않았다.
- 순위 고정 및 1순위 fallback 뒤 2순위 성공 시 3순위를 호출하지 않는 회귀 test를 추가했다. 관련 14 passed,
  Backend 전체 31 passed·2 skipped를 확인했다.
- 수정 후 실제 adapter는 3.5 Flash-Lite 한 번만 호출해 종료했고, Backend service 재시작 후 local HTTPS
  `/ros/alerts/ai-diagnosis` 합성 요청도 HTTP 200, 같은 model, 기존 5개 response key를 반환했다.

## 2026-08-31 - Alert Modal Cloud·Local AI UI 준비

- `AlertDetailModal`의 기존 Cloud `[AI 분석]` button·handler·loading/error/result 상태를 그대로 유지하고, 바로 옆에
  호출 handler가 없는 `[로컬 AI 분석]` button을 추가했다. 따라서 이번 변경으로 Ollama/Gemma/새 endpoint 또는 기존
  Gemini endpoint 요청은 발생하지 않는다.
- 성공한 Cloud 분석 결과에만 기존 `aiAnalysis.model`을 사용해 결과 하단의 muted `분석 모델` 메타정보로
  `<실제 model> · Cloud`를 표시한다. model이 없으면 해당 영역은 렌더링하지 않으며 sessionStorage 복원과 재분석은
  기존 result 값을 그대로 사용한다.
- Frontend unit 전체, lint(기존 `VisualizationPage` 미사용 인자 warning 1건), production build와 diff check를
  통과했다. build를 local HTTPS 정적 경로에 반영했고 source/target `index.html` SHA-256은
  `9f07bb87eaac03a19d4065df4496b98853d3dd92dd5a659f64cb6c083ac95461`, `https://127.0.0.1/alerts`는 200이다.

## 2026-08-31 - Alert Modal 분석 모델 한 줄 메타표기

- Cloud 분석 결과 하단의 기존 구분선 영역을 `분석 모델 : <실제 model> · Cloud` 한 줄로 정리했다. model 값·Cloud
  표기 조건, AI 요청/결과/sessionStorage와 Local AI 무호출 상태는 변경하지 않았다.
- Frontend lint(기존 `VisualizationPage` 미사용 인자 warning 1건), production build와 diff check를 통과했고 최신
  build를 local HTTPS 정적 경로에 동기화했다.

## 2026-08-31 - Alert Modal 분석 모델 하단 경계 배치

- Cloud 분석 모델 표기를 AI 결과 본문에서 분리해 오른쪽 AI 피드백 영역의 하단 경계 footer로 옮겼다. 결과가 있을 때만
  `분석 모델 : <실제 model> · Cloud` 한 줄을 표시하며, AI 요청·결과·sessionStorage·Local AI 무호출 동작은 변경하지 않았다.
- Frontend lint(기존 `VisualizationPage` 미사용 인자 warning 1건), production build와 diff check를 통과했고 최신
  build를 local HTTPS 정적 경로에 동기화했다.

## 2026-08-31 - Local AI(Ollama + Gemma) 연동 및 HTTPS 실환경 검증 완료

- FastAPI Backend `POST /ros/alerts/ai-diagnosis/local` 및 Ollama `gemma3:4b-it-q4_K_M` 연동을 실환경에서 검증했다.
- systemd Backend 환경변수 로딩(`LOCAL_LLM_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_TIMEOUT`)과 Ollama 서비스 상태 및 listen 주소(`127.0.0.1:11434`) 정상 동작을 확인했다.
- 이전 실환경 테스트 시 발생했던 502 Bad Gateway는 systemd 서비스 환경이나 네트워크 연결 실패가 아닌, LLM 생성 토큰 한도(2048) 도달에 따른 불완전 JSON 파싱 에러였음을 Ollama 저널(`task 245/2296 | n_gen = 2048`) 및 Backend 검증을 통해 확정했다.
- 로컬 HTTPS 환경(`https://127.0.0.1/ros/alerts/ai-diagnosis/local`)에서 실제 Alert 분석 호출을 재검증하여 HTTP 200, 응답시간 약 4.49초, 반환 model `gemma3:4b-it-q4_K_M`, 5개 필수 필드(`summary`, `evidence`, `likely_causes`, `recommended_checks`, `model`)의 정상 구조화 출력을 확인했다.
- 기존 Gemini Cloud AI(`POST /ros/alerts/ai-diagnosis`) 역시 정상 동작(HTTP 200, 약 2.39초, `gemini-3.5-flash-lite`)을 유지하여 상호 간섭이나 회귀가 없음을 확인했다.
- Backend pytest 37 passed·2 skipped, Frontend unit test 20개 모듈 통과, oxlint(기존 VisualizationPage warning 1건 유지), Vite 프로덕션 빌드 및 `git diff --check`를 통과했다.

## 2026-08-31 - Alert 상세 Modal 최외곽 하단 Footer 박스 배치

- AI 피드백 내부에서 분석 모델 표기를 완전히 분리하여, Alert 상세 Modal 최외곽 컨테이너(`.preview-modal.alert-detail-modal`)의 맨 아래 border 영역(`.alert-detail-modal-footer`)으로 재배치했다.
- 하단 footer 영역에 `min-height: 48px`, `padding: 12px 24px`, `background: rgba(8, 13, 19, 0.72)`, `border-top: 1px solid var(--border)`, `margin: 16px -16px -16px`를 적용하여 모달 최외곽 테두리와 일체화된 bottom bar로 구성했다.
- 분석 모델 텍스트 폰트를 기존 11px에서 라벨 13px / 모델명 13.5px bold monospace로 키우고 가운데 정렬하여 footer 영역 안에 선명하게 표시했다.
- `분석 모델 : <model> · <Local|Cloud>` 형식 및 model 미존재 시 footer 영역 미표시 동작을 유지했다.
- Frontend unit test 20개 모듈 통과, oxlint(기존 VisualizationPage warning 1건 유지), Vite 프로덕션 빌드를 통과하고 `/var/lib/ros2-dashboard/frontend`에 동기화하여 HTTPS 실접속(`index-BkjPROGh.css`)을 확인했다.

## 2026-08-31 - Alert 상세 Modal 레벨 StatusBadge 적용 (warning 노랑, error 빨강)

- `AlertDetailModal.jsx`의 Alert 정보 목록에서 레벨 항목을 `StatusBadge` 컴포넌트(`value={alert.level}`)로 변경하여 `warning`은 노랑(`badge yellow`, '경고'), `error`/`critical`은 빨강(`badge red`, '오류'/'치명적') 뱃지로 시각화했다.
- `App.css`의 `.alert-detail-list`에 `align-items: center` 및 `.alert-detail-list dd`에 `display: flex; align-items: center`를 적용하여 뱃지와 라벨의 세로 정렬을 맞췄다.
- Frontend unit test 20개 모듈 통과, oxlint(기존 VisualizationPage warning 1건 유지), Vite 프로덕션 빌드를 통과하고 `/var/lib/ros2-dashboard/frontend`에 동기화하여 HTTPS 실접속(`index-BHeMB0k5.css`)을 확인했다.

## 2026-08-31 - Alert 상세 Modal 레벨 원문 색상 표기

- Alert 상세의 Level `StatusBadge`와 한글 label mapping을 제거해 Alert 원문 level을 그대로 표시한다. `warning`은
  노랑 글씨, `error`는 빨강 글씨이며 Alert 데이터·상태 판정·다른 UI는 변경하지 않았다.
- Frontend lint(기존 `VisualizationPage` 미사용 인자 warning 1건), production build와 diff check를 통과했고 최신
  build를 로컬 HTTPS 정적 경로에 동기화했다. source/target `index.html` SHA-256은
  `a506981e51d7a82394b25caca9a1b0e882943cc56091dc002dcc0b024ec3fe68`로 일치한다.

## 2026-08-31 - Alert AI 저장 결과 전환 및 다른 관점 UI

- Cloud/Local 결과 state가 이미 있을 때의 `[다시 분석]`과 `[로컬 다시 분석]`은 각각 기존 sessionStorage key를 다시
  읽어 해당 provider 결과만 표시하도록 변경했다. cache가 없으면 `저장된 분석 결과가 없습니다.`만 표시하며 API 요청을
  만들지 않는다. 초기 분석 state가 없을 때만 기존 Gemini/Ollama 요청 함수를 유지한다.
- Header에는 handler 없는 `[다른 관점 분석]` 버튼을 닫기 왼쪽에 추가했다. Backend, endpoint, prompt, cache key와
  response 구조는 변경하지 않았다. Frontend unit 전체, lint(기존 `VisualizationPage` warning 1건), production build와
  diff check를 통과했고 최신 build를 로컬 HTTPS 정적 경로에 동기화했다. source/target `index.html` SHA-256은
  `67d95c50b47bd3aab1fbd7a549e0338dba9cb0a5dd72c1ae79c4ecf9a1fe91c7`로 일치한다.

## 2026-08-31 - Alert 다른 관점 Cloud/Local 실제 분석 연결

- 기존 Cloud/Local endpoint request에 선택적 `alternate`만 추가했다. true일 때도 같은 Alert context, history 5건,
  SYSTEM instruction과 response schema를 재사용하며, 추가 근거 없는 후보를 만들지 말라는 요청 전용 지시와
  temperature 0.4만 적용한다. 기본 분석은 기존 prompt와 temperature 0.2를 그대로 사용한다.
- Header 버튼은 현재 표시 provider로 요청을 정확히 한 번 보내고 진행 중 중복 클릭을 막는다. 성공 결과는 해당 React
  state에만 반영하고 sessionStorage에는 저장하지 않아 `[다시 분석]`/`[로컬 다시 분석]`으로 기본 cache를 복원한다.
  실패 시 기존 결과를 유지한 채 기존 오류 영역에 표시한다.
- 관련 Backend 23 passed, Frontend API mapping test와 전체 unit, lint(기존 `VisualizationPage` warning 1건), build,
  diff check를 통과했다. HTTPS 실제 alternate는 Cloud 1.91초(`gemini-3.5-flash-lite`), Local 합성 2.57초 및 실제
  `/CanControl` 5.65초(`gemma3:4b-it-q4_K_M`)로 HTTP 200이었다. Cloud는 추가 근거 부족 시 원인 배열을 비웠고,
  Gemma 4B는 실제 QoS 관점 차이는 냈지만 일부 일반적 원인 해석이 남는 모델 품질 한계를 확인했다.
- 최신 Frontend build를 local HTTPS 정적 경로에 반영했고 source/target `index.html` SHA-256은
  `c1e16484908122d2579c32f4209cc9e503580cd56acc80c3c8860f4b77a5e090`로 일치한다.

## 2026-08-31 - 로컬 다시 분석 영문 출력 원인 확인

- 코드 수정 없이 `[로컬 다시 분석]` 흐름을 확인했다. 이 버튼은 Local endpoint를 재호출하거나 번역하지 않고
  `alert_ai_diagnosis:local:<alert.id>`에 저장된 구조화 결과를 그대로 `localAiAnalysis`에 복원한다.
- 실제 `/CanControl` Local 기본 분석 응답에서 `summary`, `evidence`, `likely_causes`, `recommended_checks`가 모두 영어로
  반환된 것을 재확인했다. 따라서 영문 표시는 Frontend renderer 문제가 아니라 Gemma가 기존 한국어 SYSTEM instruction을
  지키지 않은 응답이 sessionStorage에 저장된 결과다. Local 다른 관점 결과는 한국어와 영어 용어가 혼합됐다.

## 2026-08-31 - Cloud/Local 기본·다른 관점 SYSTEM instruction 경로 검수

- 코드 변경 없이 Cloud Gemini 기본/다른 관점과 Local Gemma 기본/다른 관점의 Frontend 요청부터 Backend router,
  context 구성, provider payload까지 비교했다. 네 경로 모두 활성 `SYSTEM_INSTRUCTION` 상수를 동일하게 사용하며
  `응답은 한국어로 작성하라.` 지시가 포함된다.
- Cloud는 Gemini REST `systemInstruction.parts[0].text`, Local은 Ollama `/api/chat`의 첫 번째
  `messages` 항목(`role=system`)으로 전달한다. 다른 관점은 system instruction을 교체하지 않고 user prompt에만
  `ALTERNATE_PERSPECTIVE_INSTRUCTION`을 추가하며 temperature를 0.2에서 0.4로 바꾼다.
- 실제 payload builder의 네 결과가 모두 같은 system 문자열인지 확인했고, 관련 Backend 경로 테스트는
  4 passed·19 deselected였다. Local 영문 출력은 system instruction 누락이 아니라 Gemma의 지시 미준수다.

## 2026-08-31 - Local Gemma 한국어 설명 출력 규칙 강화

- 기존 SYSTEM instruction과 Cloud payload는 변경하지 않고, Local Ollama user prompt 마지막에만 `summary`,
  `evidence`, `likely_causes`, `recommended_checks`의 설명 문장을 한국어로 작성하고 ROS2 이름/type/field/code/log
  원문은 유지하라는 규칙을 추가했다. Local 기본과 다른 관점이 같은 규칙을 사용하며 기존 temperature 0.2/0.4와
  다른 관점 추가 지시 순서를 유지한다.
- 동일 D99 `/CanControl` Alert로 현재 소스를 직접 사용해 Ollama를 기본 2회(3.82초, 4.06초), 다른 관점 1회
  (6.63초) 호출했다. 세 결과 모두 summary/likely causes/recommended checks가 한국어였고 evidence의 기술 식별자와
  로그 원문은 유지됐으며 반환 model은 `gemma3:4b-it-q4_K_M`이었다.
- 관련 Backend 테스트 23 passed, `git diff --check`를 통과했다. Backend 서비스를 재시작해 health
  `monitor_connected=true`를 확인했으며 Frontend/API/schema/context에는 변경이 없다.

## 2026-08-31 - Alert AI 결과 보기·다른 관점 분석 역할 정리

- Alert 상세의 cache 보유 Cloud/Local 버튼 문구를 `[클라우드 결과 보기]`/`[로컬 결과 보기]`로 바꾸고,
  provider별 sessionStorage 저장 성공 여부를 별도 state로 관리해 화면의 alternate 결과와 기본 cache 존재를 분리했다.
  cache 조회 실패 시 자동 API 호출 없이 cache 없음 상태와 최초 분석 버튼으로 돌아간다.
- 결과 보기 handler는 기존 Cloud/Local key만 조회하고 provider를 전환한다. 최초 `[AI 분석]`/`[로컬 AI 분석]`과
  Header `[다른 관점 분석]`만 기존 POST를 사용하며 alternate 결과는 기존처럼 React state에만 두어 기본 cache를
  덮어쓰지 않는다.
- Frontend unit 전체와 build가 통과했고 lint는 기존 `VisualizationPage` warning 1건만 유지됐다. 비삭제 rsync로
  local HTTPS에 `AlertsPage-BuJeFPx5.js`를 반영했으며 새 문구·handler 포함, asset HTTP 200, Backend
  `monitor_connected=true`, `git diff --check` 통과를 확인했다.

## 2026-08-31 - Local 영어 cache 및 응답 표시 차단

- Local sessionStorage 조회 시 `summary`, `likely_causes`, `recommended_checks`의 모든 설명 항목에 한국어가 있는지
  검증하고, 강화 이전 영어 cache는 기존 key에서 즉시 제거해 `[로컬 결과 보기]`로 다시 표시되지 않게 했다.
  새 Local 기본 결과는 검증 통과 때만 state/cache에 반영하고, 다른 관점이 실패하면 기존 결과를 유지한다.
- Backend도 Ollama structured response의 같은 설명 필드를 검증해 영어 설명 응답을 성공 결과로 반환하지 않는다.
  `evidence`의 기술 식별자·JSON·code·log 원문은 기존 원문 보존 정책에 따라 허용하며 Cloud 경로는 변경하지 않았다.
- 실제 D99 `/CanControl` Local 기본/다른 관점 endpoint는 각각 7.34초/5.81초 HTTP 200이었고 두 응답 모두
  summary/causes/checks 한국어, 기존 schema와 model `gemma3:4b-it-q4_K_M`을 유지했다. Backend 24 passed,
  Frontend unit 전체·build·diff check가 통과했고 lint는 기존 warning 1건만 남았다. Backend 재시작 및 HTTPS
  `AlertsPage-B4N6MzRH.js` 반영과 HTTP 200을 확인했다.

## 2026-09-01 - Installer Ollama·Gemma 선택 준비 단계 추가

- `backend/.env.example`의 `LOCAL_LLM_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_TIMEOUT`을 단일 기본값 source로 사용해
  누락 key만 보완하고 기존 `.env` 값은 보존하도록 했다. loopback 설정에서 공식 Ollama Linux installer,
  systemd enable/start, `/api/tags` 모델 확인과 누락 시에만 pull을 수행한다.
- Local AI는 부가 기능으로 처리해 준비 실패를 명확히 경고하되 이후 Dashboard 설치는 계속한다. 이미 실행 가능한
  Ollama/service와 설정 모델은 reinstall/restart/pull하지 않으며 외부 URL은 installer가 변경하지 않는다.
- shell syntax와 helper 분기 테스트를 통과했다. 현재 host의 active Ollama, 설정 Gemma `/api/show`, 1-token
  `/api/chat`은 확인했으며 Fresh Ubuntu 최초 Ollama 설치와 실제 대용량 모델 pull은 미검증으로 남겼다.

## 2026-09-01 - Local LLM Alert 진단 context·출력 경량화

- Cloud/Gemini 경로는 유지하고 Local Ollama에만 source/code별 축약 context, 짧은 한국어 system prompt, 전용 JSON
  schema를 적용했다. Topic/Action history는 2건, Service history는 1건으로 줄이고 raw message/request/goal/result
  payload와 Node 관계 배열을 제외했으며 Action QoS channel과 monitor_status 핵심값은 보존했다.
- Local `num_predict`를 512로 낮추고 evidence/likely causes/recommended checks를 각각 최대 2/2/3개로 제한했다.
  Ollama 응답에 성능 counter가 있으면 prompt/eval/total duration을 INFO로 기록한다.
- Backend 전체 테스트는 `46 passed, 2 skipped`였다. 이 환경에서는 Ollama process가 실행 중이지 않아 실제
  prompt/eval token 전후 비교는 미검증으로 남겼다.

## 2026-09-01 - Local LLM 설명량·다른 관점 validation 회귀 보정

- Local 축약 context는 유지하고 `num_predict`를 768, 전용 schema 배열 한도를 evidence/likely causes/checks
  4/3/4로 조정했다. 짧은 Local system prompt에 Alert 문구 반복 금지, Dashboard 값과 판단 연결, 근거 있는 원인,
  구체적인 확인 순서를 추가했다.
- 다른 관점 실패는 Ollama 호출이 아니라 경량화 때 `evidence`까지 한국어 검증 대상으로 넓힌 회귀였다. 기존 정책대로
  영어 기술 식별자·field·로그 evidence는 허용하고 summary/원인/확인 순서만 한국어 검증해 alternate도 1회 POST로
  정상 처리한다.
- Backend 전체 테스트는 `47 passed, 2 skipped`였다. 이 환경에는 실행 중인 Ollama/Backend가 없어 실제 endpoint
  HTTP·duration 측정은 미검증이다.

## 2026-09-01 - Installer Local AI 자동 준비·pull 진행 표시

- Local AI는 Backend `.env`의 기존 `LOCAL_LLM_*` 값을 기준으로 Ollama command/service와 설정 모델을 검사하고,
  없을 때만 질문 없이 공식 installer·service start·model pull을 수행한다. 기존 설치·active service·다운로드 모델은
  각각 reinstall/restart/repull하지 않는다.
- `ollama pull` 출력은 설치 log capture에 묻히지 않고 원래 terminal로 직접 전달해 실제 다운로드 progress를 보인다.
  pull 실패는 optional 경고로 Dashboard 설치를 계속하고 재시도 `ollama pull <configured model>` 명령을 출력한다.
- shell syntax와 installer helper 전체 테스트(`install_environment`, `local_ai`, `network_environment`, `sudo_session`) 및
  `git diff --check`를 통과했다. Fresh Ubuntu의 실제 2.9GB 다운로드는 수행하지 않았다.

## 2026-09-01 - Alert AI Cloud 분리 검수·Local 근거 설명 보정

- Local 경량화 diff를 대조한 결과 Cloud는 기존 `_build_context`, `SYSTEM_INSTRUCTION`, `DIAGNOSIS_SCHEMA`,
  `_gemini_payload` 및 2048 output 경로를 그대로 사용하며 Local 축약 context가 Cloud 입력을 줄인 회귀는 없었다.
- Local raw payload/history 축소는 유지하고, 짧은 전용 prompt에 실제 값→판단 evidence, 값과 연결된 가능성,
  구체적 확인 순서와 근거 없는 네트워크/DDS/Domain ID/코드/장비 원인 금지를 명확히 했다.
- Cloud 분리, Topic·Service·Action·Node·monitor_status 핵심 context, 기본·alternate 단일 POST/validation을
  회귀 테스트로 확인했다. Backend 전체는 `51 passed, 2 skipped`; Ollama API가 현재 HTTP 000이라 실제 성능 측정은
  미검증이다.

## 2026-09-01 - Local Node stale 최종 payload 추적·whitelist 강화

- 실제 `_local_llm_payload()` 직전 Node context를 관계 배열과 Service/Topic 이름이 든 resource로 추적했다.
  최종 prompt에는 해당 값이 없었으므로 화면의 `/ScheduleCrud` 등은 context 재유입이 아니라 Local 모델의 고유명
  hallucination이었다. Node resource는 `name/domain_id`, runtime은 상태·Graph·last seen·계산 가능한 age만 허용했다.
- Local prompt에 입력 밖 ROS 이름 생성 금지를 명시하고, 호출 직전에는 raw JSON 없이 source/code/key 목록/history 수와
  context·prompt 문자 수만 INFO로 남긴다. 다른 source의 기존 raw/history 축소와 출력 768·4/3/4 계약은 유지했다.
- 최종 Node payload와 source별 whitelist, 기본·alternate 단일 POST를 회귀 테스트로 확인했고 Backend 전체는
  `53 passed, 2 skipped`였다. 실행 중인 Ollama가 없어 실제 모델 결과·성능 수치는 미검증이다.

## 2026-09-01 - Local Alert QoS·최근 이벤트 근거 선택 복원

- Cloud/Gemini의 context, prompt, schema, 2048 output 계약은 건드리지 않았다. Local은 Topic·Service·Action QoS
  Alert에만 대상의 status·mismatch·local profile·최대 2개 remote endpoint profile/node·fallback 근거를 정규화해
  전달하고, Action은 Alert channel 하나만 유지한다.
- Local history는 source별 최근 관련 event 최대 2건으로 정규화했다. Topic message timestamp, Service transport·시간·오류·application result, Action lifecycle만 남기며 raw payload/request/response/goal/feedback/result와 Node 관계 배열은 계속 제외한다.
- Backend AI 진단 테스트 `38 passed`, 전체 Backend 테스트 `55 passed, 2 skipped`, `git diff --check`를 통과했다.
  이 host의 Ollama API는 HTTP 000이어서 실제 모델 품질·token·duration 비교는 수행하지 못했다.

## 2026-09-01 - Local LLM `llm완` 입출력 선택 복원

- Git `4b9d930 (llm 완)`과 `13e271d (겜마 경량화)`, 현재 HEAD 및 working diff를 함수 단위로 대조했다. 전체 revert 없이
  Local 호출만 공용 `_build_context`, `SYSTEM_INSTRUCTION`, `DIAGNOSIS_SCHEMA`, history 5건, `num_predict=2048`로
  복원하고 Local 전용 축약 context/schema/prompt helper는 제거했다.
- 경량화와 무관한 Local 한국어 검증(evidence 기술 원문 허용), alternate 단일 POST, Cloud/Gemini 경로, provider 분리,
  Ollama 성능 및 context 크기 INFO 로그는 유지했다. Local 한국어 추가 지시는 `llm완` 당시 문구로 복원했다.
- AI 진단 테스트 `37 passed`, Backend 전체 `54 passed, 2 skipped`, `git diff --check`를 통과했다. 현재 실행 중인
  Ollama가 없어 실제 prompt token·응답 시간은 측정하지 않았다.
