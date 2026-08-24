# 완료된 개선 범위

이 문서의 초기 개선 요구는 현재 프로젝트 요구 범위에서 완료됐다. 새로운 미완료 로드맵으로 사용하지 않는다.

| 항목 | 현재 구현 |
|---|---|
| HTTPS/WSS | Nginx에서 TLS를 종료하고 HTTPS 화면은 Backend `/ws/monitor`에 WSS로 연결한다. 개발 HTTP에서는 WS를 사용한다. |
| 책임 분리 | ROS2 실행은 Monitor, REST·WebSocket·Alert DB는 FastAPI Backend, 표시는 React Frontend가 담당한다. |
| Alert 정책 | Topic, Service, Action, Node, QoS Alert의 발생·제외·해제 조건과 사용자 메시지를 문서화했다. |
| MariaDB Alert | 현재/해결 Alert, 중복 방지, 해결 후 재발, KST 시각, DB 장애 fallback을 구현했다. |
| QoS 진단 | Topic Graph QoS, Service/Action Fast DDS discovery, Auto/Manual QoS, 실제 RMW incompatible 이벤트를 구분한다. |
| Camera Topic | `Image`와 `CompressedImage`를 기존 Topic 감시 흐름으로 구독하고 상세 화면에서 요청형 Preview를 제공한다. |
| Interface Lab | Topic Publish/Receive, Service Call, Action Goal/Feedback/Result/Cancel과 실행 이력을 제공한다. |
| TurtleBot3 검증 | 외부 Gazebo Burger의 `/cmd_vel` `TwistStamped`에 전진·회전·정지 명령을 보내 실제 이동을 검증했다. |
| 제품 설치 | Ubuntu 24.04 설치기, MariaDB schema, systemd, Nginx production Frontend, start/stop/status를 제공한다. 현재 host에서 재설치·보존·장애 복구·재부팅 자동 시작까지 확인했다. |

## 현재 범위에서 제외한 항목

- Alert acknowledgement, occurrence count, JSON detail 컬럼
- Dashboard의 Gazebo process 관리 또는 TurtleBot3 전용 제어 UI
- 물리 카메라를 ROS2 Topic으로 변환하는 camera driver
- RViz2 전체 기능을 Browser에 복제하는 기능
- 다중 기기 관제와 인터넷 공개 배포 기능

별도 Fresh Ubuntu에서 dependency가 전혀 없는 최초 설치 검증은 기능 미구현이 아니라 설치 acceptance의 남은
환경 검증 항목이다.

현재 작업 우선순위와 검증 상태는 `.codex/CURRENT_STATUS.md`, 작업 기준은 `AGENTS.md`를 따른다.

## 다음작업 a - b qos파악
검수 결과를 보면 방향이 꽤 명확해졌어. **이 기능은 구현 가능하고, 단순 아이디어 수준이 아니라 현재 코드가 이미 절반 이상 기반을 갖고 있는 상태**야. 특히 Fast DDS observer가 Service의 Client/Server 양쪽 endpoint를 이미 수집하고 있다는 게 가장 큰 포인트야. 

핵심만 정리하면 이래.

현재는 일반 QoS 배지와 Alert에 **실제 장비 내부 QoS**와 **Dashboard가 Interface Lab에서 붙을 때의 실행 QoS**가 섞여 있어. Topic은 외부 Publisher↔Subscriber 비교에 이미 가까운데, Service/Action은 Dashboard 실행 상태가 일반 `qos_status`를 덮는 구조가 들어가 있어. 

그런데 Service 쪽은 생각보다 조건이 좋아. C++ observer가 이미 다음 4종을 다 보고 있어.

```text
Client Request Writer
Client Response Reader
Server Request Reader
Server Response Writer
```

문제는 Python 계층에서 지금 Client endpoint를 버리고 있다는 거야. 즉 **데이터를 못 구해서 못 하는 게 아니라, 이미 있는 데이터를 현재 구조에서 안 쓰고 있는 것**에 가깝다. 

그래서 Service는 이렇게 바꾸면 돼.

```text
실제 Client Request Writer
↔ 실제 Server Request Reader

실제 Server Response Writer
↔ 실제 Client Response Reader
```

이걸 Dashboard가 passive하게 비교하면 돼. Dashboard 자신은 비교 대상에서 제외하고. 

Action도 구현 가능성이 높아. 현재 구조상 이미:

```text
Goal
Result
Cancel
Feedback
Status
```

5개 채널을 알고 있고, Goal/Result/Cancel은 Service 비교를 재사용하고 Feedback/Status는 Topic 비교를 재사용할 수 있어. 그래서 완전히 새 로직을 만드는 것보다는 **기존 Topic/Service cache를 조합하는 작업**에 가까워. 

진짜 어려운 부분은 두 가지야.

첫 번째는 **Dashboard endpoint를 100% 정확히 제외하는 것**이야. 보고서상 participant ID/GUID prefix가 실제로 연결될 가능성은 확인됐지만, 이걸 통합 테스트로 고정해야 해. 이게 첫 번째 gate야. 

두 번째는 **DDS endpoint를 실제 ROS Node 이름까지 정확히 표시하는 것**이야. Service/Action passive 비교 자체는 가능하지만, 처음부터 UI에 `Client A Node`, `Server B Node`처럼 정확한 Node 이름까지 보장하려면 identity correlation을 더 보강해야 해. 그래서 초기 구현은 participant/GUID 기반 표시가 현실적이야. 

UI는 생각보다 전부 갈아엎을 필요는 없어. 목록의 `QosStatusBadge`는 그대로 재사용 가능하고, 가장 큰 작업은 상세화면이야. 일반 Topic/Service/Action 화면은 `System QoS`, Interface Lab은 `Execution QoS`로 분리하면 돼. 

구조는 이렇게 가는 게 가장 깔끔해.

```text
일반 Topic / Service / Action
→ System QoS
→ 실제 장비 내부 Endpoint끼리 비교

Interface Lab
→ Execution QoS
→ Dashboard ↔ 대상
```

이렇게 나누면 네가 아까 말한 A, B, Dashboard 3자 문제도 자연스럽게 해결돼.

Alert도 이 구조로 바꾸는 게 맞아.

```text
System QoS incompatible
→ 일반 시스템 QoS Alert

Execution QoS incompatible
→ Interface Lab 내부 결과
→ 일반 시스템 Alert로 올리지 않음
```

지금처럼 사용자가 Manual QoS를 잘못 입력한 게 장비 내부 QoS 장애처럼 보이는 문제도 같이 정리할 수 있어. 

견적은 보고서 기준으로 보면:

* 최소안: Topic+Service passive 비교, 5~8일
* 권장안: Topic+Service+Action + System/Execution 완전 분리, 10~15일
* 완전안: Endpoint 관계 상세 UI + identity 보강 + 상세 원인 표시, 16~24일

정도야. 

내가 보기엔 **B 권장안이 맞아.** 최소안은 다시 손볼 가능성이 높고, 완전안은 지금 단계에선 과해.

즉 다음 구현 순서는:

```text
1. Dashboard participant 제외 검증
2. system_qos / execution_qos 모델 분리
3. Topic 외부 Endpoint 비교
4. Service Client endpoint 보존 + passive 비교
5. Action 5채널 조립
6. Alert를 System QoS 기준으로 변경
7. 목록 배지 전환
8. 상세 UI에서 관계 표시
```

이 순서가 제일 안전해. 

결론은 **조건부 YES**가 맞아. 기술적으로 필요한 endpoint/QoS 데이터는 이미 확보되고 있고, 가장 먼저 Dashboard endpoint 제외 규칙만 확실히 검증하면 대규모 C++ 재작성 없이도 충분히 구현 가능해 보여. 
