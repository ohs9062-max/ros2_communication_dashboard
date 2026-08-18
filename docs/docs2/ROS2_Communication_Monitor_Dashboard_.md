# ROS2 Communication Monitor Dashboard


> 기준 자료: `ros2_dashboard_with_demo_slide(1).pdf`  
> 구성: 21페이지 발표용 대사  
> 발표 방향: 기능 중심, 초보자도 이해할 수 있는 설명, 화면과 흐름 위주

---

## 1페이지. 표지

안녕하세요. 제가 발표할 프로젝트는 **ROS2 Communication Monitor Dashboard**입니다.

이 프로젝트는 ROS2 통신 상태를 웹 화면에서 한눈에 확인하고, 필요한 경우 등록된 Interface를 이용해 실제 통신까지 직접 실행할 수 있는 대시보드입니다.

전체 기능은 크게 두 영역으로 나뉩니다. 첫 번째는 ROS2 통신 상태를 자동으로 관찰하는 **Monitoring**이고, 두 번째는 사용자가 Publish, Receive, Service Call, Action Goal을 직접 실행하는 **Interface Lab**입니다.

즉, 이 프로젝트의 핵심은 **현재 ROS2 통신 상태를 관찰하고, 필요한 통신은 직접 시험할 수 있도록 만든 것**입니다.

다음 페이지에서는 주요 기능부터 설명드리겠습니다.


---

## 2페이지. 프로젝트 주요 기능

ROS2 통신은 터미널 명령어로도 확인할 수 있지만, Node, Topic, Service, Action의 상태와 관계를 한 번에 파악하기는 어렵습니다.

이 대시보드는 보이지 않던 ROS2 통신을 화면으로 보여주는 것을 목표로 만들었습니다.

기능은 세 가지입니다. 첫 번째는 **상태 확인**으로, 현재 어떤 Node, Topic, Service, Action이 존재하는지 확인합니다. 두 번째는 **관계 이해**로, 어떤 Node가 어떤 Topic을 발행하거나 구독하는지, Service나 Action에 어떤 역할로 참여하는지 확인합니다. 세 번째는 **직접 실행**으로, Interface를 등록한 뒤 Publish, Receive, Service Call, Action Goal을 실행하고 결과와 history를 확인합니다.

Node는 기능을 수행하는 실행 단위이고, Topic은 메시지가 계속 전달되는 통로입니다. Service는 한 번 요청하고 한 번 응답받는 통신이며, Action은 Goal, Feedback, Result를 통해 진행 상태까지 확인하는 작업입니다.


---

## 3페이지. 전체 데이터 흐름

이 페이지는 ROS2 상태가 웹 화면까지 전달되는 전체 구조입니다.

먼저 독립 Monitor의 rclpy Runtime이 ROS2 Graph를 주기적으로 조회해 Node, Topic, Service, Action의 존재와 연결 관계를 수집합니다. 수집한 결과는 Runtime cache에 최신 상태로 저장합니다.

cache를 사용하는 이유는 사용자가 화면을 열 때마다 ROS2 Graph를 처음부터 다시 조회하지 않고, 이미 수집한 최신 결과를 빠르게 반환하기 위해서입니다.

Monitor FastAPI는 localhost snapshot과 Interface Lab 명령을 제공하고, 순수 Web Backend가 이를 polling해 REST와 WebSocket으로 Browser에 전달합니다.

Frontend는 이 데이터를 받아 목록, 상세 패널, Alert, Visualization 화면으로 표현합니다.

정리하면 흐름은 **ROS2 Graph → rclpy Monitor cache → localhost snapshot → Web Backend cache → REST·WebSocket → React 화면**입니다.


---

## 4페이지. 기술 스택

Monitor에는 ROS2 Graph API, rclpy와 localhost FastAPI를, Web Backend에는 FastAPI와 WebSocket을 사용했습니다.

ROS2 Graph API는 현재 실행 중인 ROS2 리소스와 연결 관계를 조회하는 데 사용했습니다. rclpy는 Python에서 ROS2 Node와 Subscription, Service Client, Action Client 같은 객체를 구성하는 데 사용했습니다.

Monitor FastAPI는 snapshot과 Interface Lab 실행 API를 localhost에 제공하고, Web Backend FastAPI는 cache, MariaDB Alert lifecycle, 공개 REST/WSS를 담당합니다.

Frontend에는 React, Vite, React Flow를 사용했습니다. React는 상태 변화가 많은 화면을 동적으로 구성하고, Vite는 개발 환경을 단순화합니다. React Flow는 Node와 통신 관계를 확대, 축소, 이동할 수 있는 그래프로 표현합니다.

YAML은 Message 타입, 감시 대상, timeout 정책 같은 설정을 코드 밖에서 관리하기 위해 사용했습니다.


---

## 5페이지. 프로젝트 폴더 구조

프로젝트는 ROS2 workspace, Web Backend와 Frontend로 나뉩니다.

`ros2_ws/src/ros2_dashboard_monitor`에는 rclpy Runtime, Monitor transport와 Interface Lab이 있고, `backend/app`에는 순수 Web Backend가 있습니다. Monitor 정책과 Interface Registry는 `ros2_ws/src/ros2_dashboard_monitor/config`에, 사용자 별표는 `backend/config`에 보관합니다.

`interface_lab`에는 Interface 등록과 업로드, 패키지 Build와 Apply, Publish, Receive, Call, Goal 실행 기능이 들어 있습니다.

`frontend/src`는 REST와 WebSocket 데이터를 받아 목록, 상세 화면, Alert, Visualization 화면을 구성합니다.

한 문장으로 정리하면 Monitor가 ROS2와 직접 통신하고 Backend가 공개 API·cache·Alert DB를 제공하며, Frontend가 이를 화면과 그래프로 표현합니다.


---

## 6페이지. Overview 화면

Overview는 전체 ROS2 상태를 한눈에 확인하는 첫 화면입니다.

상단 요약 카드에서는 Node, Topic, Service, Action의 전체 개수와 상태 분포를 보여줍니다. 하지만 요약 카드의 상태와 Alert는 같은 기준이 아닙니다.

요약 카드는 현재 Graph에서 발견된 상태를 넓게 보여주고, Alert는 실제로 확인하거나 조치할 필요가 있는 조건만 선별합니다.

예를 들어 Subscriber가 없는 Topic이 있더라도 사용되지 않는 Topic이라면 정상일 수 있습니다. 따라서 모든 `no_subscriber` 상태를 무조건 장애로 판단하지 않고, 설정된 필수 통신 정책에 따라 Alert 여부를 구분합니다.


---

## 7페이지. Alert 관리

Alert는 현재 발생 중인 문제와 최근 해결된 문제를 구분합니다.

현재도 문제가 지속 중인 Alert는 `active` 상태로 표시하며 warning 또는 error 집계에 포함됩니다. 문제가 해결되면 `resolved` 상태로 변경되고 현재 장애 개수에서는 제외됩니다.

resolved Alert는 사용자가 어떤 문제가 해결됐는지 확인할 수 있도록 60초 동안 남겨둡니다. 같은 문제가 다시 발생하면 새 Alert를 계속 만드는 대신 기존 Alert를 다시 active 상태로 전환합니다.

즉, Alert는 문제의 발생, 해결, 재발 흐름까지 확인할 수 있도록 구성했습니다.


---

## 8페이지. Topic 모니터링

Topic 화면에서는 Publisher와 Subscriber 수, 최신 데이터, Hz, age, stale 상태를 확인할 수 있습니다.

Monitor는 지원하거나 등록된 Message 타입을 자동 구독합니다. 메시지가 수신되면 callback에서 최신 값을 갱신하고, 설정된 Hz window 동안 받은 메시지 수를 window 초로 나누어 Hz를 계산합니다.

`latest`는 마지막으로 수신한 실제 메시지 값입니다. `age`는 마지막 메시지를 받은 뒤 지난 시간이고, `stale`은 age가 설정된 3초를 초과한 상태입니다.

`missing`은 Publisher가 존재하고 감시 대상이지만 감시 시작 후 3초가 지나도록 메시지를 한 번도 받지 못한 상태입니다. 반면 stale은 과거에는 메시지를 받았지만 마지막 수신 이후 3초가 지난 상태입니다.

명령이나 이벤트 Topic처럼 필요할 때만 발행되는 통신은 설정에 따라 missing과 stale 판정에서 제외할 수 있습니다.


---

## 9페이지. Service 모니터링

Service 화면에서는 Service의 존재 여부와 실제 호출 결과를 분리해서 보여줍니다.

ROS2 Graph에서 Service가 발견됐다는 것은 해당 Service와 Server 또는 Client 관계가 존재한다는 뜻입니다. 하지만 실제 호출은 대시보드가 Service Client가 되어 요청 메시지를 직접 보내는 능동적인 통신입니다.

이 요청이 실제 장비 동작 명령일 수도 있기 때문에 자동 모니터링에서는 존재와 관계만 관찰합니다. 실제 호출은 사용자가 Interface Lab에서 명시적으로 실행합니다.

사용자가 호출했을 때만 요청과 응답, 성공 여부, 마지막 결과, 응답 시간이 기록됩니다.


---

## 10페이지. Action 모니터링

Action은 Goal, Feedback, Result 구조를 가지며 비교적 긴 작업에 사용됩니다.

Action 모니터링 화면은 새로운 Goal을 자동으로 실행하지 않습니다. ROS2 Graph에서 Action Server와 Client 관계를 확인하고, 이미 관찰된 Goal의 진행 상태를 화면에 보여줍니다.

작업 중에는 Feedback을 확인하고, 작업이 끝나면 Result와 전체 실행 시간을 확인할 수 있습니다.

새 Goal을 보내는 기능은 자동 모니터링이 아니라 Interface Lab에서 사용자가 직접 실행합니다.


---

## 11페이지. Node 화면

Node 화면은 단순히 Node 이름만 보여주는 것이 아니라 각 Node가 ROS2 통신에 어떻게 참여하는지 보여줍니다.

Node 하나를 선택하면 발행 Topic, 구독 Topic, Service Server와 Client 관계, Action Server와 Client 관계를 함께 확인할 수 있습니다.

사라진 Node는 즉시 삭제하지 않고 설정된 timeout 동안 stale 상태로 남겨둡니다. ROS2 Graph에서 Node가 순간적으로 사라졌다 다시 나타날 때 바로 삭제하면 화면이 반복해서 흔들릴 수 있기 때문입니다.

따라서 일정 시간 stale로 보존해 화면 흔들림을 줄이고, 최근까지 존재했던 Node도 확인할 수 있도록 했습니다.


---

## 12페이지. Visualization

Visualization 화면은 Node 중심의 통신 관계를 그래프로 보여줍니다.

이 화면은 ROS2 Graph를 별도로 다시 조회하지 않습니다. 기존 REST API를 통해 받은 Node, Topic, Service, Action 데이터를 Frontend 코드에서 조합합니다.

Frontend가 어떤 객체를 Node 박스로 만들지, 어떤 관계를 Edge로 연결할지 판단해 React Flow의 `nodes`와 `edges` 배열로 변환합니다.

React Flow는 ROS2 관계를 자동으로 이해하는 도구가 아니라 Frontend가 가공한 nodes와 edges를 화면에 그려주는 라이브러리입니다.

특정 Node를 선택하면 직접 연결된 1-hop 관계를 확인할 수 있고, 전체 Graph 보기와 배치 초기화도 지원합니다.


---

## 13페이지. Monitoring과 Interface Lab 차이

이 페이지는 프로젝트에서 가장 중요한 구분입니다.

자동 모니터링은 현재 ROS2 시스템을 자동으로 관찰합니다. Graph discovery를 수행하고, 각 리소스의 상태와 개수, latest, Hz, stale을 계산하며 결과를 cache와 snapshot으로 보관합니다. 자동 모니터링은 새로운 Service Call이나 Action Goal을 실행하지 않습니다.

Interface Lab은 등록한 타입을 사용해 사용자가 실제 통신을 직접 실행합니다. Interface 등록과 업로드, Build와 Apply, import 확인을 거친 뒤 Publish, Receive, Service Call, Action Goal을 실행하고 결과와 history를 확인합니다.

한 문장으로 정리하면 **Monitoring은 관찰이고, Interface Lab은 사용자 실행입니다.**


---

## 14페이지. Interface 등록

Interface는 화면에서 직접 작성하거나 실제 ROS2 패키지 단위로 업로드할 수 있습니다.

간단한 Message, Service, Action 정의는 kind와 type name을 입력한 뒤 화면에서 직접 작성하고 문법을 검증해 저장합니다.

하지만 실제 장비 Interface는 다른 Message 타입이나 패키지에 의존하는 경우가 많습니다. 이 경우 단일 정의 파일보다 원본 패키지 구조를 유지한 ZIP 또는 폴더 단위 업로드가 필요합니다.

즉, 간단한 테스트 타입은 직접 작성하고, 실제 장비 타입은 원본 ROS2 패키지 단위로 등록합니다.


---

## 15페이지. Apply 과정

Apply는 단순히 파일을 저장하는 과정이 아닙니다.

업로드된 ROS2 Interface 패키지를 빌드하고 install 환경을 반영한 뒤, Monitor가 실제 Python 타입을 import할 수 있는지 확인합니다.

이 과정을 통과해야 Interface Lab에서 실제 Message 객체, Service Request, Action Goal 객체를 만들 수 있습니다.

YAML 등록은 빌드를 대신하는 것이 아니라 어떤 패키지와 Interface를 대시보드의 관리 대상으로 사용할지 코드 밖의 외부 설정으로 관리하기 위한 것입니다.


---

## 16페이지. Topic Lab

Topic Lab에서는 같은 Message 타입으로 Publish와 Receive를 시험할 수 있습니다.

Publish를 실행할 때 사용자는 Topic 이름, Message 전체 타입, JSON payload를 입력합니다. Monitor는 등록된 Message 타입을 import한 뒤 JSON payload를 해당 ROS2 Message 객체의 필드 구조와 타입에 맞게 변환합니다.

변환이 성공하면 Publisher를 통해 실제 Topic으로 발행하고, payload와 성공 또는 실패 결과를 history에 저장합니다.

Receive Start를 누르면 별도의 Subscription 객체가 생성되고, 수신된 메시지는 화면과 history에 저장됩니다. Stop을 누르면 Topic Lab에서 만든 Subscription만 제거합니다.

자동 모니터링용 Subscription은 latest, Hz, stale 계산을 위한 것이고, Topic Lab용 Subscription은 사용자가 실제 수신값을 확인하기 위한 임시 구독입니다.


---

## 17페이지. Service Call과 Action Goal

Service Call과 Action Goal은 사용자가 명시적으로 실행합니다.

Service는 전체 `.srv` 타입으로 Request와 Response 구조를 확인하고 Service Client를 생성합니다. Action은 전체 `.action` 타입으로 Goal, Feedback, Result 구조를 확인하고 Action Client를 생성합니다.

Frontend는 full type을 기준으로 입력 schema를 만들고, Monitor는 사용자가 입력한 JSON을 실제 ROS2 Request 또는 Goal 객체로 변환합니다.

타입이 다르거나 import할 수 없으면 필드 구조와 직렬화 형식이 맞지 않아 통신할 수 없습니다.

실행 결과는 Service 응답 또는 Action Feedback과 Result 형태로 수신하고 history에 저장합니다.


---

## 18페이지. 트러블슈팅 1 — Interface 패키지 의존성

첫 번째 트러블슈팅은 실제 장비 Interface 패키지 의존성 문제입니다.

처음에는 `.msg`, `.srv`, `.action` 정의만 있으면 사용할 수 있을 것으로 생각했지만, 사용자 정의 Interface는 타입 정의 파일만으로 사용할 수 없었습니다.

원본 패키지명, `package.xml`의 의존성, `CMakeLists.txt`의 빌드 설정이 함께 필요했고, 다른 Message 타입을 참조한다면 해당 의존 패키지도 필요했습니다.

이를 해결하기 위해 장비별 Interface를 ZIP 또는 폴더 단위로 업로드하고, `colcon build`, install 환경 반영, import 확인을 거쳐 Monitor가 실제 타입을 사용하도록 구성했습니다.

결과적으로 Service와 Action 타입을 정확히 인식하고 Feedback과 Result를 해석하며, 새로운 장비 패키지도 확장할 수 있게 됐습니다.


---

## 19페이지. Monitor와 Web Backend 프로세스 분리

현재 제품은 ROS2 Monitor와 Web Backend를 별도 프로세스로 분리합니다.

Monitor 안에서는 localhost FastAPI와 `rclpy.spin()`이 함께 실행되고, Web Backend는 rclpy를 import하지 않은 채 Monitor snapshot을 polling합니다.

이 경계로 ROS2 Node 수명주기와 Browser API·MariaDB Alert 수명주기가 분리됩니다.

Monitor FastAPI lifespan은 RosMonitor를 시작하고 rclpy spin은 별도 daemon thread에서 callback을 처리합니다.

Monitor 종료 시 ROS2 Node, Subscription, observer와 thread 자원을 함께 정리하고, Backend는 Monitor 연결이 끊겨도 마지막 정상 cache를 유지합니다.

그 결과 웹 요청 처리와 ROS2 메시지 수신, Graph 갱신을 동시에 유지할 수 있었습니다.


---

## 20페이지. 시연 영상

이제 실제 UI 시연 영상을 보여드리겠습니다.

시연은 세 단계로 구성됩니다.

첫 번째는 **관찰**입니다. Overview, Topic, Service, Action, Node 화면에서 현재 ROS2 통신 상태와 관계를 확인합니다.

두 번째는 **실행**입니다. Interface Lab에서 Topic Publish와 Receive, Service Call, Action Goal을 직접 실행합니다.

세 번째는 **검증**입니다. 실행 결과를 Alert, Visualization, history 화면에서 확인합니다.

영상을 보실 때는 **관찰 → 실행 → 결과 확인**의 흐름을 중심으로 봐주시면 됩니다.


---

## 21페이지. 확장 개발

현재 구현된 Monitoring과 Interface Lab을 기반으로 네 가지 방향으로 확장할 수 있습니다.

첫 번째는 Jetson Nano나 Raspberry Pi와 터치 디스플레이에 대시보드를 탑재하는 현장형 엣지 모니터링 장비입니다.

두 번째는 통신 로그, Alert, Node 상태, Service Timeout, Action 실패 결과를 LLM과 연결해 원인 후보와 우선 점검 항목을 제안하는 기능입니다.

세 번째는 YAML 필터, Graph 관계, Alert 발생 빈도, 통신 의존도를 분석해 먼저 확인해야 할 통신을 자동 선별하는 기능입니다.

네 번째는 통신을 생존 확인, 상태·센서 Stream, 명령, Event로 구분하고 목적과 예상 주기에 맞게 stale과 Alert 정책을 다르게 적용하는 것입니다.

최종 목표는 ROS2 통신을 보여주는 대시보드를 넘어, 현장에서 상태 확인, 장애 분석, 우선순위 판단까지 지원하는 지능형 진단 플랫폼으로 확장하는 것입니다.

이상으로 발표를 마치겠습니다. 감사합니다.


---

# 발표 직전 핵심 암기 문장

1. 이 프로젝트는 ROS2 통신 상태를 자동으로 관찰하고, 등록된 Interface로 실제 통신도 실행하는 웹 대시보드입니다.
2. 전체 흐름은 ROS2 Graph에서 수집한 결과를 Runtime cache에 저장하고, REST와 WebSocket으로 React 화면에 전달하는 구조입니다.
3. Monitoring은 관찰이고, Interface Lab은 사용자가 명시적으로 실행하는 기능입니다.
4. Topic의 missing은 한 번도 받지 못한 상태이고, stale은 마지막 수신 후 timeout을 초과한 상태입니다.
5. Service와 Action의 실제 실행은 장비 명령이 될 수 있으므로 자동으로 수행하지 않습니다.
6. Visualization은 Graph를 다시 조회하지 않고 기존 REST 데이터를 Frontend에서 nodes와 edges로 변환해 표시합니다.
7. Interface Apply는 파일 저장이 아니라 패키지 build, install 반영, Python import 확인까지 포함합니다.
8. `.msg`, `.srv`, `.action`만으로는 부족하며 원본 패키지명, `package.xml`, `CMakeLists.txt`, 의존 패키지가 필요합니다.
9. ROS2 Monitor와 Web Backend는 별도 프로세스이며, Monitor 내부에서 rclpy spin thread가 callback을 처리합니다.
10. 최종 목표는 ROS2 상태 확인을 넘어 장애 원인과 점검 우선순위까지 제안하는 진단 플랫폼입니다.

# 질문을 받았을 때 답변 원칙

- 먼저 결론을 한 문장으로 말합니다.
- 그다음 왜 그렇게 구성했는지 설명합니다.
- 자동 모니터링과 사용자 실행을 구분합니다.
- 모든 상태가 무조건 장애는 아니며, 설정된 필수 통신 정책에 따라 Alert가 결정된다고 설명합니다.
- 함수명이 기억나지 않으면 기능 흐름을 기준으로 답합니다.
