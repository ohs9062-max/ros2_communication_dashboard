# Interface Lab 흐름

Interface Lab은 자동 Monitoring과 분리된 사용자 명시 실행 도구다. 화면 진입과 Graph 발견만으로 Publish,
Call 또는 Goal을 보내지 않는다.

## 저장과 등록

```text
manual type / definition / single file / package upload
→ 입력·archive·path·ROS interface 문법 검증
→ Registry와 source package 저장
→ Apply 필요 상태
→ colcon build + import check
→ Monitor 재실행
→ 실행 후보
```

영속 위치:

```text
ros2_ws/src/uploaded_interfaces/generated_interfaces/
ros2_ws/src/uploaded_interfaces/packages/<package_name>/
ros2_ws/src/ros2_dashboard_monitor/config/interface_registry.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_packages.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_status.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_last.log
```

| 기능 | 현재 route |
|---|---|
| 단일 Interface upload/Registry | `transport/routers/interface_management.py` L34-L129 |
| 수동 type·definition | `transport/routers/interface_manual.py` L27-L140 |
| Package zip/folder/list/delete | `transport/routers/interface_packages.py` L26-L110 |
| Apply/status/import check | `transport/routers/interface_apply.py` L25-L106 |

`uploaded_interfaces` 상위 폴더 자체는 ROS package가 아니다. 실제 package인
`generated_interfaces`와 `packages/<package_name>`만 `package.xml`을 가진다.

## Apply

`interface_lab/apply/runtime.py run_interface_apply()` L62-L203은 lock과 running 상태, 사전 검사,
workspace build, log, install 경로와 Python import 검사를 관리한다. 성공 응답 뒤
`restart_monitor_after_delay()` L206-L209가 Monitor를 재실행한다. Registry와 원본 Interface는 build
생성물로 취급해 삭제하지 않는다.

## Topic Publish와 Receive

| 기능 | Route | Runtime |
|---|---|---|
| schema/callable | `topic_execution.py` L18-L41 | `InterfaceReceiveRuntime` L93-L101 |
| 1회 Publish | `topic_execution.py` L44-L88 | `publish_topic()` L156-L170 |
| 지속 Publish | `topic_execution.py` L98-L158 | `start/stop_continuous_publish()` L178-L205 |
| Publish history reset | `topic_execution.py` L161-L172 | `reset_publish_history()` L211-L230 |
| Receive start/stop/list | `topic_receive.py` L16-L53 | `start_topic/stop_topic/topics` L103-L122 |
| Receive history/reset | `topic_receive.py` L56-L90 | `topic_history/reset_topic_history` L131-L154 |

자동 감시 Subscription은 latest/Hz/stale 계산용이고 Lab Receive는 사용자가 payload를 확인하는 명시적
Subscription이다. Topic Publisher/Subscription은 name/type과 QoS fingerprint가 같을 때만 재사용한다.
Publish History의 `ok`와 `sent_to_topic=true`는 로컬 `Publisher.publish()` 호출이 성공했다는 뜻이며,
Subscriber callback 수신 확인이 아니다. QoS가 불일치한 Subscriber는 수신하지 못하지만 지속 Publish 호출과
History 기록은 계속될 수 있다.

## Service와 Action

| 기능 | Route | Runtime |
|---|---|---|
| Service Call | `service_execution.py` L15-L67 | `ServiceCallRuntime.call_service()` L83-L129 |
| Service history | `service_execution.py` L70-L110 | `ServiceCallRuntime` L131-L154 |
| Action Goal | `action_execution.py` L15-L75 | `ActionGoalRuntime.send_goal()` L84-L123 |
| Action Cancel | `action_execution.py` L100-L112 | `ActionGoalRuntime.cancel_goal()` L131-L144 |
| Action history | `action_execution.py` L78-L133 | `ActionGoalRuntime` L146-L179 |

Message/Request/Goal은 schema 기반 JSON을 generated ROS object로 변환한다. Topic Publish, Service Request,
Action Goal의 object/array JSON 필드는 공통 `frontend/src/features/interface-lab/SchemaRequestField.jsx`를
사용하고 필드별 크게 보기/줄이기를 제공한다.

Service는 `service_is_ready()`가 false면 요청을 보내기 전에 실패하고, Action은 Goal Service가 준비되지 않으면
Goal을 보내지 않는다. Action의 5채널은 독립이므로 Goal Service가 준비돼 있으면 Result/Cancel/Feedback/Status
중 다른 채널이 incompatible이어도 Goal 전송 자체는 가능하다.

## QoS와 History

Topic Publish/Receive, Service Request/Response, Action Goal/Result/Cancel/Feedback/Status는 Auto/Manual
QoS를 지원한다. 실행/수신 연동을 켜면 두 설정을 동기화하고 해제하면 독립적으로 관리한다. entity pool은
name/type뿐 아니라 전체 QoS fingerprint가 같을 때만 재사용한다.

History는 Monitor runtime 메모리이며 MariaDB Alert history와 연결되지 않는다. 현재 상한은 Topic Publish
100건, Topic Receive 기본/최대 500건, Service Call과 Action Goal 각각 30건이다. 선택 이력과 전체 이력
초기화는 각 실행/수신 History API를 사용한다.

## Frontend

`frontend/src/pages/InterfaceLabPage.jsx`는 page 조립만 담당하고, 관리·목록·상세·실행·수신 상태는
`frontend/src/features/interface-lab/`의 view, hook, model로 분리돼 있다. 항목 선택은 우측 상세를 열고
`통신 상세 / History / 고급 정보 / 실행`을 제공한다. 실제 실행 workbench와 Receive workbench는 각각
명시적 닫기 동작을 가진다.
