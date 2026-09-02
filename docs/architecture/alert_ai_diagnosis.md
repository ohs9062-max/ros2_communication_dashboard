# Alert AI 진단 입력과 해석 기준

이 문서는 현재 `backend/app/alerts/ai_diagnosis.py`와 Monitor Alert builder를 기준으로, Alert AI가 실제로
받는 값과 해석 경계를 정리한다. AI가 Alert 발생 여부를 판정하는 기능은 아니다. Monitor가 먼저 Alert를 만들고,
Backend의 Cloud 또는 Local AI가 그 Alert와 현재 Dashboard 관찰값을 설명한다.

## 한눈에 보는 입력과 출력

Alert AI는 선택한 Alert 하나를 설명하기 위해 **Alert 자체의 정보**, **지금 Dashboard가 보고 있는 해당 resource의
상태**, **있다면 최근 통신 이력**을 함께 받는다. Cloud와 Local은 현재 같은 입력 구조를 사용한다.

- Alert 정보에는 이름, source, code, level, 사용자에게 보인 message, 감지·해결 시각, active/resolved 상태가 들어간다.
- 현재 상태는 Alert가 발생했을 때 저장한 복사본이 아니라, 분석 요청 시점의 Monitor cache다. Topic이면 Hz·마지막 수신·
  Publisher/Subscriber·QoS 같은 값, Service/Action이면 Graph·호출/Goal 결과·QoS 같은 값, Node이면 Graph 상태와
  연결 관계를 source별 정해진 field만 골라 넣는다.
- 최근 이력은 **Topic·Service·Action만 최대 5건** 받는다. Topic은 실제 수신 preview, Service는 실제 Interface Lab
  Call, Action은 실제 Goal과 Monitor 관찰 event다. Node와 MonitorStatus는 현재 history를 조회하지 않아 빈 배열이다.
- 따라서 “현재 상태와 최근 5개를 전부 받는다”는 뜻은 모든 Alert source의 모든 원본 데이터를 전송한다는 뜻이 아니다.
  resource별 허용 field와 최대 5건으로 제한된 데이터만 받고, 각 값도 중첩 깊이·문자 수 제한을 거친다.
- AI는 이 사실을 바탕으로 `summary`, `evidence`, `likely_causes`, `recommended_checks` 네 항목의 JSON을 반환한다.
  AI가 새로운 Alert를 만들거나, 입력에 없는 장애 원인을 확정해서는 안 된다.

## 1. 호출과 공통 경계

```text
Alert 상세의 선택 Alert
→ Backend `AlertDiagnosisService._validated_alert()`
→ `_build_context()`
  → Backend Monitor cache에서 현재 resource 탐색
  → Topic/Service/Action이면 Monitor history API 최대 5건 조회
→ Cloud `POST /ros/alerts/ai-diagnosis`
  또는 Local `POST /ros/alerts/ai-diagnosis/local`
→ structured JSON 검증
```

- Cloud와 Local은 현재 같은 `_build_context()`, `SYSTEM_INSTRUCTION`, `DIAGNOSIS_SCHEMA`를 사용한다.
- Cloud는 Gemini `generateContent`를 사용한다. Local은 Ollama `/api/chat`을 요청당 한 번만 호출하고
  `num_predict=2048`을 사용한다. 두 provider는 서로 fallback하지 않는다.
- `alternate=true`는 같은 context에 추가 지시와 temperature `0.4`를 적용한다. 기본 분석 결과 자체는 alternate
  요청에 전달하지 않으므로, 모델은 기본 결과의 실제 문장을 볼 수 없다.
- 현재 Runtime은 Alert 발생 당시 snapshot이 아니다. context의 `note`로 이를 명시하며, AI는 현재 상태로 과거
  원인을 역추정해서는 안 된다.

## 2. 실제 최종 context

LLM user prompt에는 아래 JSON이 compact serialization으로 들어간다.

| 블록 | 실제 포함 값 |
|---|---|
| `alert_record` | `id`, `code`, `severity`(`level`), `message`, `detected_at`, `resolved_at`, `state` |
| `resource` | `kind`(`source`), `domain_id`, `name`, `interface_type` |
| `current_runtime_state` | cache `observed_at`, `monitor_connected`, 현재/과거 구분 `note`, source별 `data` |
| `historical_data` | source, `limit=5`, 실제 history item, history가 실제로 존재하는 값만 포함한다는 note |

선택 Alert는 `source`, `id`, `name`, `code`, `level`, `message`가 필수다. `domain_id`, `resource_key`,
`detected_at`, `resolved_at`, `alert_state`, `channel`도 Backend validation 단계에서는 읽는다.

`_bounded_value()`가 최종 context를 제한한다. dict는 각 단계 최대 40 key, list는 최대 5 item, depth는 6,
문자열은 2,000자로 제한한다. 따라서 history와 중첩 runtime object의 실제 입력량은 Monitor 원본보다 작을 수 있다.

## 3. source별 현재 runtime 입력

아래는 `_runtime_summary()`가 resource를 찾았을 때 최종 LLM context에 넣는 field다. resource는
`resource_key`가 있으면 그것을 먼저, 없으면 같은 domain의 name으로 찾는다. 찾지 못하면 `data`는 `null`이다.

| Source | `current_runtime_state.data`에 실제 포함하는 값 |
|---|---|
| Topic | `status`, `effective_status`, `graph_present`, Publisher/Subscriber raw·node count, `hz`, `age_sec`, `stale`, `last_message_preview`, `last_received_at`, `message_count`, `qos_status`, `qos_detection_source`, `graph_qos_status`, `mismatch_reason` |
| Service | `status`, `graph_present`, `callable`, Server/Client raw·node count, `call_status`, `last_call_summary`, `dashboard_communication`, `qos_status`, `qos_detection_source`, `mismatch_reason` |
| Action | `status`, `graph_present`, `callable`, Server/Client raw·node count, `last_goal_summary`, 전체 `runtime`, 전체 5-channel `qos` |
| Node | `status`, `graph_present`, `last_seen_at`, `topic_publishers`, `topic_subscribers`, `service_servers`, `service_clients`, `action_servers`, `action_clients` |
| monitor_status | resource lookup 대상이 아니므로 현재 구현에서는 `data=null` |

## 4. history 입력

history API는 Topic, Service, Action에만 호출한다. Node와 `monitor_status`는 빈 배열이다.

| Source | 요청 경로 | 실제 의미 |
|---|---|---|
| Topic | `GET /ros/topics/history?name=...&limit=5&domain_id=...` | Monitor Subscription이 실제 수신한 최근 preview |
| Service | `GET /ros/services/history?name=...&service_type=...&limit=5&domain_id=...` | Interface Lab이 실제 실행한 해당 Service Call 이력 |
| Action | `GET /ros/actions/history?name=...&action_type=...&limit=5&domain_id=...` | Interface Lab Goal 이력과 Monitor가 실제 관찰한 Status/Feedback/Result event를 시간순으로 합친 이력 |

Service의 외부 Client payload, 외부 Goal payload 및 rejected Action 응답은 Monitor가 관찰해 합성하지 않는다.
history가 비어 있으면 AI는 과거 실행 결과를 알 수 없으며, 현재 runtime만으로 그 빈 이력을 채워서는 안 된다.

## 5. Alert 생성 기준과 AI가 해석할 수 있는 근거

AI 입력의 `code`와 `message`는 다음 Monitor 판정이 이미 성립했다는 사실을 뜻한다. 표의 오른쪽 값은 현재
runtime/history에 남아 있을 때 AI가 그 판정의 의미를 보강하는 데 쓸 수 있는 값이며, Alert 발생 당시 snapshot을
보장하지 않는다.

### Topic 및 MonitorStatus

| code | Monitor Alert 생성 조건 | AI가 추가로 받는 현재 근거 |
|---|---|---|
| `waiting_publisher` | required/등록 감시 Topic이고 command가 아니며 Publisher 수가 0 | `publisher_count`, `graph_present`, `status`, 수신·QoS 값 |
| `topic_message_missing` | Publisher가 있고 Subscription 생성 뒤 stale timeout을 넘겼지만 한 번도 수신하지 못함 | `effective_status`, `hz`, `age_sec`, `stale`, `last_received_at`, Topic QoS 값과 preview/history |
| `topic_stale` | 이전 수신 뒤 `age_sec > stale_timeout_sec` | 같은 수신 시간·Hz·Publisher·QoS 값과 preview/history |
| `topic_disconnected` | 감시 Topic이 debounce 뒤 ROS2 Graph에서 사라짐 | `status`, `graph_present`, Publisher/Subscriber 수, 마지막 수신·QoS 값 |
| `topic_qos_incompatible` | primary/감시 대상에서 explicit `incompatible`이 서로 다른 Graph observation에 설정 횟수만큼 계속됨 | Topic QoS status/detection source/graph status/`mismatch_reason` |
| `monitor_status_warning` / `error` / `critical` | `MonitorStatus` preview의 `level`이 해당 level | 최종 context에는 Alert message/code만 남고 runtime/history는 없다(아래 누락 항목 참고) |

Topic missing/stale의 Monitor 내부 `reception_diagnosis`는 Subscription 생성 실패, RMW incompatible event,
Publisher 존재, QoS compatible/incompatible/unknown을 근거로 확정 또는 후보 원인을 계산한다. 그러나 현재
`_runtime_summary()`의 Topic field 목록에는 `reception_diagnosis`가 없으므로 이 객체 자체는 LLM에 전달되지 않는다.
AI는 전달된 현재 QoS와 수신 값만으로 설명해야 한다.

### Service

| code | Monitor Alert 생성 조건 | AI가 추가로 받는 현재 근거 |
|---|---|---|
| `service_call_timeout` | user category Service의 최근 실제 Call이 `sent_to_server=true`이고 `last_call_status=timeout` | Graph/Server·Client 수, `callable`, `call_status`, `last_call_summary`, `dashboard_communication`, Service history |
| `service_call_failed` | 같은 조건에서 최근 Call status가 `failed`, `response_failed`, `service_call_error` 중 하나 | 위 값과 `last_call_summary`의 오류·응답 요약, Service history |
| `service_disconnected` | allowlisted Service가 debounce 뒤 `status=disconnected` | `status`, `graph_present`, Server·Client 수, callable 및 최신 Call/QoS 값 |
| `service_qos_incompatible` | primary이고 hidden이 아니며 explicit `incompatible`이 확인 횟수만큼 지속 | Service QoS status/detection source/`mismatch_reason` |

`last_call_summary`와 history에 Response가 있어도 application-level `success=false`는 ROS2 transport 실패와 별개다.
SYSTEM instruction은 이 둘을 분리해 설명하도록 요구한다.

### Action

| code | Monitor Alert 생성 조건 | AI가 추가로 받는 현재 근거 |
|---|---|---|
| `action_disconnected` | allowlisted Action이 debounce 뒤 `status=disconnected` | Graph, Server·Client 수, `last_goal_summary`, `runtime`, 5-channel QoS |
| `action_goal_aborted` | 최신 Goal status가 `aborted` | Goal summary/runtime의 Goal·Result·오류·시각 정보와 Action history |
| `action_goal_canceled` | 최신 Goal status가 `canceled` | 위와 같음 |
| `action_goal_rejected` | 최신 Goal status가 `goal_rejected` | 위와 같음 |
| `action_goal_send_failed` | 최신 Goal status가 `goal_send_failed` 또는 `goal_accept_timeout` | 위와 같음 |
| `action_result_timeout` | 최신 Goal status가 `result_timeout` | 위와 같음 |
| `action_result_unavailable` | 최신 Goal status가 `result_receive_failed`, 또는 Goal summary가 없고 runtime `result_error`가 존재 | 위와 같음 |
| `action_qos_incompatible` | primary Action의 Goal/Result/Cancel/Feedback/Status 중 한 channel이 explicit `incompatible`로 확인 횟수만큼 지속 | 전체 `qos` object; 문제 channel은 현재 최종 context에 포함되지 않음 |

Action Goal 전달, accepted, Feedback, Result, Cancel은 별개 통신 사실이다. Action history의 `goal=null`은
Monitor가 외부 Goal payload를 알 수 없음을 뜻하며, 이를 완전한 실행 기록처럼 해석하면 안 된다.

### Node

| code | Monitor Alert 생성 조건 | AI가 추가로 받는 현재 근거 |
|---|---|---|
| `node_stale` | internal이 아니고 primary Node가 debounce 뒤 `status=disconnected` | `status`, `graph_present`, `last_seen_at`, 현재 Pub/Sub·Service·Action 관계 배열 |

`node_stale`은 Graph에서 더 이상 보이지 않는다는 관찰이지 프로세스 종료의 확정 증거는 아니다.

## 6. 현재 context에서 의도적으로 또는 구현상 빠지는 값

다음은 Alert 또는 resource에 존재할 수 있어도 `_build_context()`가 LLM에게 주지 않는 현재 구현의 사실이다.

| 값 | 현재 상태 | 영향 |
|---|---|---|
| Alert의 `status`, `last_received_at`, `age_sec`, `mismatch_policies` | `_validated_alert()` 뒤 최종 `alert_record`에 넣지 않음 | Alert 발생 당시 상태·시각·QoS policy는 runtime 값으로만 간접 설명 가능 |
| Action QoS Alert `channel` | validation은 하지만 `alert_record`에 넣지 않음 | 5-channel `qos` 전체는 보아도 어느 channel이 Alert 대상인지는 알 수 없음 |
| Topic `reception_diagnosis` | Topic runtime summary field가 아님 | Monitor가 계산한 확정/후보 수신 원인과 related Alert를 직접 사용하지 못함 |
| MonitorStatus `device_name`, `node_name`, `status`, `values` | validation용 `monitor_status` object에만 두고 context에 넣지 않음 | LLM은 기기 상태의 세부 key/value를 받지 못함 |
| Alert 발생 당시 resource snapshot | 저장·전달하지 않음 | 현재 정상/비정상 상태로 과거 Alert 원인을 확정할 수 없음 |

이는 현재 동작 설명이며, 누락 값을 복원하거나 context를 경량화하는 설계 변경을 뜻하지 않는다.

## 7. 출력 계약과 해석 금지 규칙

반환 JSON은 정확히 다음 네 key여야 한다.

```json
{
  "summary": "string",
  "evidence": ["string"],
  "likely_causes": ["string"],
  "recommended_checks": ["string"]
}
```

- parser는 `summary`가 비어 있지 않은지, 나머지가 string 배열인지 검사한다. 현재 schema에는 배열 `maxItems`가 없다.
- Local은 `summary`, `likely_causes`, `recommended_checks`에 한글이 포함되는지도 검사한다. Cloud는 system instruction으로
  한국어를 요구하지만 같은 programmatic 한글 검증은 하지 않는다.
- `evidence`는 Dashboard 값과 그 의미를 연결하고, `likely_causes`는 확인된 사실과 가능성을 구분해야 한다.
- QoS가 `compatible`이면 QoS mismatch를 원인으로 주장할 수 없다. Graph entity 존재와 실제 message/response 성공도
  같은 뜻으로 취급할 수 없다.
- 근거 없는 네트워크, DDS, 장비, 코드 장애를 실제 원인으로 단정하지 않는다. 입력으로 확인할 수 없으면
  “현재 정보만으로 확인할 수 없음”이라고 작성해야 한다.
- alternate는 새로운 사실을 만들지 않으며, 다른 근거 또는 다른 확인 순서가 없으면 추가 판단이 어렵다고 반환할 수 있다.

## 8. 운영 확인 지점

Local 요청 전에는 context source/code, runtime key, history count, context/prompt 문자 수만 INFO로 남긴다. Prompt나
Alert payload 원문은 로그에 남기지 않는다. Ollama 응답에 값이 있으면 `prompt_eval_count`, `eval_count`,
`prompt_eval_duration`, `eval_duration`, `total_duration`도 INFO로 남긴다.

관련 구현은 다음 파일을 기준으로 한다.

- `backend/app/alerts/ai_diagnosis.py`: validation, context, prompt, provider payload, output validation
- `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/alert_assembler.py`: source Alert 통합과 QoS confirmation
- `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/alerts.py`, `diagnostics.py`
- `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_service/alerts.py`
- `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py`
- `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_node/alerts.py`
- `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/qos_alerts.py`
