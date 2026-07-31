# Interface Lab 흐름

## 한 문장으로 보기

Interface Lab은 타입이나 패키지를 Registry에 등록하고 필요하면 build/apply해 Python import 가능 상태로 만든 뒤, 사용자가 버튼을 눌렀을 때만 Topic Publish/Receive, Service Call, Action Goal을 실행하며 이때 생긴 Dashboard 내부 통신은 일반 통신 탭의 Node 집계에서 제외한다.

## 쉬운 용어

| 용어 | 뜻 |
|---|---|
| Interface | ROS2 메시지 구조를 정의하는 `.msg`, `.srv`, `.action` |
| Registry | Dashboard가 알고 있는 Interface 타입과 적용 상태 목록 |
| import available | build된 Python 타입 클래스를 현재 Backend가 불러올 수 있음 |
| Apply | `colcon build` 후 import 가능 여부를 다시 검사하는 과정 |
| manual type | 이미 설치된 타입 이름만 등록; 파일 생성과 build가 필요 없음 |
| manual definition | 사용자가 정의 내용을 작성; 파일 생성과 build가 필요함 |
| single upload | `.msg/.srv/.action` 파일 하나를 업로드 |
| package upload | 완성된 ROS interface package를 폴더/zip 단위로 업로드 |

## 등록부터 사용 가능까지

```text
등록/업로드
→ 파일과 Registry 기록
→ rebuild_required
→ Apply
→ colcon build
→ Python import 검사
→ import_available=true
→ Graph 타입 exact match
→ 실행 후보
```

1. **Interface 등록:** 설치된 타입을 등록하거나 `.msg`, `.srv`, `.action`, 완성된 package를 업로드한다.

2. **파일과 Registry 저장:** 등록 방식에 따라 source 파일과 타입·schema·build 상태를 기록한다.

3. **변경 대기 표시:** build가 필요하면 `rebuild_required`와 `build_required`를 설정한다.

4. **Apply와 import 검사:** package를 build하고 generated Python 타입을 Backend가 import할 수 있는지 확인한다.

5. **Graph exact match:** 등록·import 가능한 타입과 현재 Graph 타입이 정확히 같은 실행 후보를 찾는다.

6. **사용자 입력 준비:** Topic schema 또는 Service Request·Action Goal 입력 화면을 만든다.

| 단계 | 파일·함수 | 함수 전체 L | 핵심 L | 먼저 볼 내용 |
|---:|---|---:|---:|---|
| 1 | `interface_management.py` `upload_ros_interface()` | `interface_management.py` L41-L85 | `interface_management.py` L43-L75 | 단일 파일 추출·검증·등록 호출 |
| 2 | `management/registry.py` `register_interface()` | `management/registry.py` L82-L148 | `management/registry.py` L91-L147 | 종류/파일 검사, 설치, Registry entry 저장 |
| 3 | `manual_interfaces.py` `register_manual_type()` | `manual_interfaces.py` L55-L89 | `manual_interfaces.py` L62-L89 | 설치된 타입 이름을 build 없이 Registry에 등록 |
| 4 | `manual_interfaces.py` `write_manual_definition()` | `manual_interfaces.py` L92-L150 | `manual_interfaces.py` L103-L150 | 정의 파일 생성, metadata 재생성, pending 표시 |
| 5 | `interface_management.py` package upload 두 함수 | `interface_management.py` L277-L347 | `interface_management.py` L286-L310, `interface_management.py` L324-L346 | zip/folder를 package 관리 함수로 전달 |
| 6 | `apply/runtime.py` `mark_interface_change_pending()` | `apply/runtime.py` L83-L97 | `apply/runtime.py` L85-L96 | `rebuild_required`, `build_required=true` 저장 |
| 7 | `apply/runtime.py` `run_interface_apply()` | `apply/runtime.py` L100-L339 | `apply/runtime.py` L232-L301 | Apply 시 build하고 install 경로와 Python import 가능 여부를 다시 검사한다. |
| 8 | 실행 Runtime의 `callable_*()` | `service_call_runtime.py` L56-L83, `action_goal_runtime.py` L62-L89 | `service_call_runtime.py` L58-L83, `action_goal_runtime.py` L64-L89 | Registry의 import 가능한 타입과 현재 Graph 타입을 exact match해 실제 실행 후보를 만든다. |
| 9 | `rosApi.js` → `InterfaceLabPage.jsx` | `rosApi.js` L74-L98 | `InterfaceLabPage.jsx` L45-L137, L385-L402 | Frontend가 Registry·Package·Apply 상태·실행 후보를 조회하고, 상단 노란 안내에서 실행 통신의 Node 집계 제외 정책을 명시한다. 안내 문구와 Interface 배지 크기는 `App.css` L1127-L1138, L1286-L1293에서 관리한다. |

1~6은 등록 방식별 저장과 pending 처리, 7은 실제 적용, 8은 실행 후보 판정, 9는 화면 반영 단계다.

Registry 등록은 즉시 모든 타입이 사용 가능하다는 뜻이 아니다. `import_available=true`이고 현재 Graph full type과 정확히 일치해야 Call/Goal 후보가 된다.

## Apply

1. **중복 실행 차단:** Apply lock으로 같은 workspace의 동시 build를 막는다.

2. **등록 상태 점검:** Registry와 업로드 package가 build 가능한 상태인지 검사한다.

3. **Package 충돌 검사:** 중복 package나 source 문제를 확인하고 안전하지 않으면 build 전에 중단한다.

4. **colcon build:** Backend workspace에서 build를 실행하고 결과 log를 저장한다.

5. **import 재검사:** install Python 경로를 반영하고 등록된 generated 타입을 다시 import한다.

6. **최종 상태 저장:** 성공·실패, import 가능 여부와 남은 rebuild 상태를 저장한다.

| 단계 | 파일·함수 | 함수 전체 L | 실제 핵심 L | 의미 |
|---:|---|---:|---:|---|
| 1 | `interface_apply.py` `apply_ros_interfaces()` | `interface_apply.py` L26-L68 | `interface_apply.py` L28-L36 | Apply 실행과 중복 실행/오류 처리 |
| 2 | `apply/runtime.py` `run_interface_apply()` | `apply/runtime.py` L100-L339 | `apply/runtime.py` L102-L131 | lock 획득과 running 상태 기록 |
| 3 | `apply/runtime.py` `run_interface_apply()` | `apply/runtime.py` L100-L339 | `apply/runtime.py` L133-L179 | build 전 등록 상태 검사와 실행 불가 처리 |
| 4 | `apply/runtime.py` `run_interface_apply()` | `apply/runtime.py` L100-L339 | `apply/runtime.py` L181-L230 | 중복 package 검사와 build 중단 처리 |
| 5 | `apply/runtime.py` `run_interface_apply()` | `apply/runtime.py` L100-L339 | `apply/runtime.py` L232-L252 | `colcon build --symlink-install` 실행과 log 기록 |
| 6 | `apply/runtime.py` `run_interface_apply()` | `apply/runtime.py` L100-L339 | `apply/runtime.py` L253-L301 | install 경로 반영, import 검사, 최종 상태 계산 |
| 7 | `interface_apply.py` `apply_ros_interfaces()` | `interface_apply.py` L26-L68 | `interface_apply.py` L35-L68 | 성공 시 reload trigger 예약 또는 실패 응답 |

Apply는 Backend 프로세스를 직접 kill하지 않는다. 성공하면 reload trigger 파일을 갱신해 `uvicorn --reload`가 재시작하도록 유도한다.

## Topic Publish와 Receive

1. **등록 타입 선택:** Registry에 등록되고 Python import 가능한 Message 타입과 schema를 불러온다.

2. **Publish:** Topic 이름·타입 충돌과 입력값을 검사한 뒤 Publisher를 만들고 메시지를 발행한다.

3. **Receive 시작:** 사용자가 수신 시작을 누르면 선택한 이름과 타입으로 subscription을 생성한다.

4. **수신 이력:** 메시지를 JSON-safe 값으로 변환해 최근 수신 시각과 history에 저장한다.

5. **Receive 중지:** 사용자가 중지를 누르면 subscription을 제거한다.

6. **Dashboard 통신 표시:** 생성한 통신은 일반 Node 수에서 제외하고 `Lab 발행`, `Lab 수신` 배지로 표시한다.

| 동작 | Router 전체/핵심 L | Runtime 전체 L | Runtime 핵심 L |
|---|---|---:|---:|
| Publish | `topic_execution.py` L41-L83 / `topic_execution.py` L43-L76 | `topic_runtime.py` `publish_topic()` L290-L406 | `topic_runtime.py` L298-L348 Graph·충돌 검사, `topic_runtime.py` L349-L387 변환·publish, `topic_runtime.py` L388-L406 오류/history |
| Receive 시작 | `topic_execution.py` L108-L122 / `topic_execution.py` L110-L122 | `topic_runtime.py` `start_topic()` L113-L165 | `topic_runtime.py` L120-L147 타입 검사·subscription 생성, `topic_runtime.py` L148-L165 상태 저장 |
| Receive 중지 | `topic_execution.py` L126-L136 / `topic_execution.py` L128-L136 | `topic_runtime.py` `stop_topic()` L167-L195 | `topic_runtime.py` L170-L191 대상 탐색·subscription 제거, `topic_runtime.py` L192-L195 상태 저장 |

일반 Topic Runtime 자동 감시와 Interface Lab Receive는 목적이 다르다. `topic_runtime.py` `dashboard_state_by_topic()` L205-L220이 Receive subscription과 Publisher cache를 목적별로 반환하므로 Topic 메인 목록은 `자동 감시`, `Lab 수신`, `Lab 발행`을 구분해 표시한다. Node 수·목록에서는 Dashboard Node를 제외하고 실행 history와 Graph 원본 endpoint 수는 유지한다.

## Service Call과 Action Goal

1. **실행 후보 선택:** 등록·import 가능하고 Graph에 exact 타입 Server가 있는 Service 또는 Action을 고른다.

2. **입력값 작성:** Service Request나 Action Goal schema에 맞춰 전송 값을 입력한다.

3. **명시적 실행:** 실행 버튼을 눌렀을 때만 Dashboard Client를 생성해 Call 또는 Goal을 전송한다.

4. **응답 관찰:** Service Response 또는 Action Feedback·Result를 기다리고 timeout과 오류를 구분한다.

5. **History 반영:** 요청값, 응답값, 상태와 경과 시간을 저장해 Interface Lab과 통신 탭에 반영한다.

세부 실행은 각각 [Service 문서](03_service_flow.md#사용자-service-call)와 [Action 문서](04_action_flow.md#사용자-goal-실행)를 먼저 본다.

```text
Service Call
= 등록/import 가능 + Graph Server 존재 + 사용자 실행

Action Goal
= 등록/import 가능 + Graph Server 존재 + 사용자 실행
```

Interface Lab 화면을 열거나 Registry에 등록했다는 이유만으로 Service를 자동 호출하거나 Action Goal을 자동 전송하지 않는다.
