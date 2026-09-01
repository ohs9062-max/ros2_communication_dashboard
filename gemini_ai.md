# Local LLM Alert 진단 경로 정밀 분석 및 경량화 보고서

---

## A. 현재 Local AI 전체 호출 흐름

Local LLM Alert 진단은 다음과 같은 순서와 파일/함수를 통해 실행됩니다:

```text
[Frontend / AlertDetailModal]
  │ '로컬 AI 분석' 또는 '다른 관점 분석' 클릭
  ▼
[FastAPI Router] backend/app/routers/alerts.py
  │ diagnose_alert_locally(request: AlertDiagnosisRequest) (line 90)
  ▼
[Service] backend/app/alerts/ai_diagnosis.py
  │ AlertDiagnosisService.diagnose_local(selected_alert, alternate=False) (line 245)
  ├─ 1. alert = _validated_alert(selected_alert) (line 436)
  │     - id, code, level, message, domain_id, source 등 필수 필드 검증 및 정규화
  ├─ 2. context = await self._build_context(alert) (line 256)
  │     - monitor_cache에서 현재 런타임 스냅샷 획득
  │     - _find_resource(): 대상 리소스(Topic/Service/Action/Node) 매칭 (line 472)
  │     - _load_history(): Monitor API (/ros/{source}/history?limit=5) 비동기 조회 (line 298)
  │     - _runtime_summary(): 리소스 종류별 사전 정의된 런타임 필드 추출 (line 507)
  │     - _bounded_value(): 딕셔너리(최대 40키), 리스트(최대 5개), 문자열(최대 2000자), depth 6 제한 (line 677)
  │     - 4개 섹션(alert_record, resource, current_runtime_state, historical_data) 조립
  ├─ 3. analysis, model = await self._request_local_llm(context, alternate) (line 391)
  │     - _local_llm_payload() 구성 (line 584)
  │       * model: settings.local_llm_model ('gemma3:4b-it-q4_K_M')
  │       * format: DIAGNOSIS_SCHEMA (JSON Schema 강제)
  │       * messages[0](system): SYSTEM_INSTRUCTION (line 79)
  │       * messages[1](user): _diagnosis_prompt() + LOCAL_KOREAN_OUTPUT_INSTRUCTION (line 611, line 62)
  │       * options: temperature(0.2 또는 0.4), num_predict(2048)
  │     - httpx.AsyncClient.post(f"{LOCAL_LLM_URL}/api/chat", json=payload)
  └─ 4. 응답 파싱 및 검증
        - response.json()['message']['content'] 추출
        - _parse_structured_diagnosis(): 4개 필수 필드(summary, evidence, likely_causes, recommended_checks) 검증 (line 632)
        - _local_explanations_are_korean(): 설명 필드 내 한글 포함 여부 검증 (line 650)
        - 반환: {**analysis, 'model': model}
```

---

## B. source / Alert별 전달 데이터 현황표

| 구분 | alert_record | resource | current_runtime_state (data) | historical_data (5건) | 비고 |
|---|---|---|---|---|---|
| **Topic** | id, code, severity, message, detected_at, resolved_at, state | kind, domain_id, name, interface_type | status, effective_status, graph_present, publisher_count, subscriber_count, publisher_node_count, subscriber_node_count, hz, age_sec, stale, **last_message_preview**, last_received_at, message_count, qos_status, qos_detection_source, graph_qos_status, mismatch_reason | 최근 수신 **메시지 5개의 전체 preview JSON 배열** | `last_message_preview`와 5개 history payload가 대용량 토큰 유발 |
| **Service** | 동일 | 동일 | status, graph_present, callable, server_count, client_count, server_node_count, client_node_count, call_status, **last_call_summary**, dashboard_communication, qos_status, qos_detection_source, mismatch_reason | 최근 **Service Call 5건의 Request/Response JSON 배열** | `last_call_summary`에 request/response 전문 포함 |
| **Action** | 동일 | 동일 | status, graph_present, callable, server_count, client_count, server_node_count, client_node_count, **last_goal_summary**, **runtime**, **qos** | 최근 **Action Goal 5건의 Goal/Result/이벤트 JSON 배열** | `qos`(5채널 전체 QoS 구조체), `runtime`, `last_goal_summary`로 인해 단일 객체 최대 크기 |
| **Node** | 동일 | 동일 | status, graph_present, last_seen_at, **topic_publishers**, **topic_subscribers**, **service_servers**, **service_clients**, **action_servers**, **action_clients** | `[]` (비어 있음) | 6개 연결 목록(노드에 연결된 모든 Topic/Service/Action 이름·타입 배열)이 수백 토큰 차지 |
| **MonitorStatus** | 동일 | 동일 | Topic과 동일한 필드 세트 (collection_key='topics') | 최근 메시지 5건 preview | 장비 상태 진단에 무관한 토픽 그래프 상태가 과도하게 전달됨 |

### Nested Object 세부 분석:
1. **`last_message_preview` (Topic)**: LaserScan, Imu, PointCloud 등 복잡한 센서 메시지의 경우 수십~수백 라인의 JSON payload가 그대로 포함됨.
2. **`last_call_summary` (Service)**: `request_payload`, `response_payload`, `last_error`, `latency_ms`, `last_call_status` 등 호출 상세 전문 포함.
3. **`qos` (Action)**: `goal`, `result`, `cancel`, `feedback`, `status` 5개 채널 각각의 QoS 상태, mismatch_reason, 원격 endpoint profiles가 중첩된 거대 딕셔너리.
4. **`runtime` (Action)**: `executing_goals`, `last_feedback`, `last_result`, `status_code`, `status_label`, `feedback_count`, `result_error` 등.
5. **Node의 6개 통신 리스트**: `topic_publishers` 등 각 항목이 `{name: ..., type: ...}`의 리스트로 노드당 수십 개 엔티티가 직렬화됨.

---

## C. 반드시 필요한 데이터 (Core Grounding Data)

진단 품질과 hallucination 방지를 위해 반드시 유지해야 하는 필수 데이터입니다:

1. **Alert 기본 정보 (`alert_record`)**:
   - `code`, `severity`, `message`, `detected_at`, `state` (어떤 장애가 언제 발생했는지의 기준 사실)
2. **대상 식별자 (`resource`)**:
   - `kind`, `name`, `domain_id`, `interface_type` (어떤 엔티티의 문제인지 특정)
3. **핵심 런타임 지표 (`current_runtime_state.data`)**:
   - **Topic**: `status`, `graph_present`, `publisher_count`, `subscriber_count`, `hz`, `age_sec`, `qos_status`, `mismatch_reason`
   - **Service**: `status`, `graph_present`, `server_count`, `call_status`, `last_call_summary.last_error`, `last_call_summary.latency_ms`, `qos_status`, `mismatch_reason`
   - **Action**: `status`, `graph_present`, `server_count`, `last_goal_summary.last_goal_status`, `runtime.result_error`, `runtime.status_label`, (QoS Alert인 경우 문제 채널의 QoS 상태/사유)
   - **Node**: `status`, `graph_present`, `last_seen_at`
   - **MonitorStatus**: `device_name`, `node_name`, `status`, `values`

---

## D. 제거·축소 가능한 데이터와 이유

| 대상 데이터 | 현황 | 제안 | 제거/축소 근거 |
|---|---|---|---|
| **`historical_data` (전체)** | Topic/Service/Action별 최대 5건의 전체 payload JSON 전송 | **완전 제거 (`items: []`) 또는 0건 조회** | Local AI 진단은 "현재 상태와 발생 시점의 상태 차이"를 설명하는 것이 핵심이며, 과거 5번의 메시지/호출 본문은 진단 판단에 기여하지 않고 수천 토큰의 지연만 초래함. |
| **`last_message_preview` (Topic)** | 메시지 내부 필드 전체 직렬화 | **제거 또는 최상위 필드명 목록만 유지** | Topic 장애(stale, missing, disconnected, qos)는 메시지 "내용"이 아니라 "수신 여부/주기(Hz)/QoS"로 판단됨. |
| **`last_call_summary` payload (Service)** | request/response 전체 payload | **`request_payload`, `response_payload` 제외, `last_error`, `latency_ms`, `call_status`만 유지** | ROS2 통신 진단 관점에서는 페이로드 내부 비즈니스 데이터보다 호출 성공 여부 및 에러 메시지가 핵심임. |
| **Node의 6대 통신 목록 (Node)** | 연결된 모든 Topic/Service/Action의 이름·타입 배열 전문 | **개수(`count`) 숫자만 전달하거나 생략** | `node_stale`은 노드가 프로세스/그래프에서 사라졌는지가 유일한 판정 기준이며, 노드가 구독하던 수십 개 토픽 목록은 불필요함. |
| **`qos` 5채널 전체 (Action)** | 문제없는 채널까지 5개 채널 전체 QoS 프로파일 덤프 | **QoS Alert가 아니면 제외, QoS Alert면 해당 문제 채널만 전달** | Action Goal 실패나 연결 끊김 진단 시 방대한 DDS QoS 프로파일은 완전한 낭비임. |
| **중복 카운트 필드 (Topic/Service/Action)** | `publisher_count`와 `publisher_node_count` 동시 전송 | **`publisher_count` 등 1종으로 통합** | 모니터링 판단에 동일한 정보를 중복 전달함. |

---

## E. 기존 Local Prompt의 중복 / 과잉 부분 분석

1. **`SYSTEM_INSTRUCTION`의 중복 설명 및 과잉 길이**:
   - 현재 시스템 지시문(약 1,500자)에서 [근거 사용 원칙]의 1~5번 항목("확정/가능성 구분", "확인된 것만 확인됨으로", "정보 부족시 부족하다고 명시")이 **동일한 원칙을 4~5가지 다른 문장으로 반복**하고 있음.
   - [출력] 섹션의 "JSON 바깥 설명 금지, Markdown 금지, 코드블록 금지, 스키마 외 필드 금지" 등은 **Ollama의 `format: DIAGNOSIS_SCHEMA` (Grammar-based strict decoding)가 엔진 레벨에서 100% 보장**하므로 프롬프트에서 길게 반복할 필요가 없음.
2. **`num_predict: 2048` 설정**:
   - 실제 4개 필드(`summary`, `evidence`, `likely_causes`, `recommended_checks`)의 응답 길이는 250~400 토큰에 불과함.
   - `num_predict: 2048`은 소형 모델이 루프에 빠질 경우 100초 이상 멈추는 원인이 되므로, `768` 정도로 타이트하게 설정하는 것이 안전함.

---

## F. 권장 경량화 구조 (Target Architecture)

### 1. 입력 토큰 대폭 축소 (약 3,000 토큰 → 약 600~800 토큰, 75% 감소)
- **History 조회 생략**: `diagnose_local` 경로에서는 `_load_history()`를 호출하지 않고 `historical_data: {'items': []}`로 즉시 전달.
- **`_runtime_summary_local()` 도입**: payload 전문(메시지 본문, request/response 전문, 노드 통신 리스트)을 제외하고 상태/수치/에러/카운트 위주의 컴팩트 딕셔너리 생성.
- **SYSTEM_INSTRUCTION 압축**: 핵심 원칙(사실 기반, 현재/과거 구분, QoS mismatch 추정 금지, application failure 구분)만 300~400자 이내로 명확히 정돈.

### 2. 출력 및 Generation 최적화
- `num_predict`: 2048 → **768**
- `LOCAL_KOREAN_OUTPUT_INSTRUCTION`: 간결한 2줄 한국어 원칙 유지.

### 3. 예상 성능 향상치 (CPU 추론 `gemma3:4b-it-q4_K_M` 기준)
- **Prompt Eval 시간**: ~24.9초 → **약 5 ~ 7초 (75% 단축)**
- **Output Generation 시간**: ~66.9초 → **약 20 ~ 28초 (간결한 출력 유도로 단축)**
- **총 응답 시간**: **~92초 → 약 25 ~ 35초 (60초 이내 목표 완벽 달성 가능)**

---

## G. 수정 시 영향받을 파일 및 함수 (참고용)

*(현재는 분석 단계이므로 코드를 수정하지 않았으며, 차후 작업 시 변경 대상 지점입니다)*

1. **`backend/app/alerts/ai_diagnosis.py`**:
   - `AlertDiagnosisService._build_context()`: Local 호출 시 history 로딩 분기(`include_history=False`) 및 경량 summary 함수 적용.
   - `_runtime_summary()`: Local 전용 필드 필터링 또는 payload stripping 로직.
   - `SYSTEM_INSTRUCTION` / `LOCAL_SYSTEM_INSTRUCTION`: Local 전용 간결 시스템 프롬프트 분리.
   - `_local_llm_payload()`: `num_predict`를 768로 조정.
2. **`backend/tests/test_alert_ai_diagnosis.py`**:
   - 경량화된 Local context 및 payload 계약에 대한 테스트 assertion 동기화.

---
