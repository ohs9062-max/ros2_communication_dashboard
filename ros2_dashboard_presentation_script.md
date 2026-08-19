# ROS2 Communication Monitor Dashboard 발표 스크립트

> 기준 자료: `ros2_dashboard_2final_pages10_13_completed_v2(2).pptx`  
> 발표 방향: 요구사항을 어떤 기능과 구조로 충족했는지 기능 중심으로 설명

---

## 1페이지. 프로젝트 소개

안녕하세요.  
이번 프로젝트는 ROS2 통신 상태를 웹에서 한눈에 확인하고,
필요한 경우 직접 Topic, Service, Action 통신까지 실행해볼 수 있는
ROS2 Communication Monitor Dashboard입니다.

주요 개선 범위는 HTTPS/WSS 보안 연결,
Alert 정책과 이력 저장,
QoS 진단,
Camera Topic 출력,
Interface Lab,
그리고 Ubuntu 24.04 설치 자동화입니다.

이번 발표에서는 각각의 요구사항을
어떤 기능과 구조로 해결했는지를 중심으로 설명하겠습니다.

---

## 2페이지. HTTPS 화면에서 WSS로 실시간 연결

먼저 브라우저 접속 구간을 HTTPS와 WSS로 보호했습니다.

사용자는 브라우저에서 HTTPS로 Dashboard에 접속하고,
실시간 Monitor 데이터는 `/ws/monitor`를 통해 WSS로 전달됩니다.

여기서 Nginx가 인증서와 TLS 처리를 담당합니다.

Nginx 뒤쪽의 Backend와 Monitor는 같은 PC의 localhost에서 동작하기 때문에
내부에서는 HTTP와 WS를 사용합니다.

즉 외부 구간은 HTTPS/WSS로 암호화하고,
내부 localhost 통신은 단순한 HTTP/WS로 유지한 구조입니다.

---

## 3페이지. Frontend · Backend · ROS2 책임 분리

프로젝트는 크게 ROS2 Monitor, FastAPI Backend,
React Frontend로 역할을 분리했습니다.

ROS2 Workspace와 Monitor는
Node, Topic, Service, Action을 발견하고
실제 ROS2 데이터를 수집하는 역할을 합니다.

FastAPI Backend는 Monitor가 만든 상태를 받아
REST와 WebSocket으로 전달하고,
Alert 이력을 MariaDB에 저장합니다.

React Frontend는 이 데이터를 사용자 화면에 표시하고
Interface Lab의 사용자 입력을 담당합니다.

중요한 점은 Frontend가 ROS2에 직접 접근하지 않고,
ROS2 관련 책임은 Monitor에 집중했다는 점입니다.

---

## 4페이지. Alert 정책

Alert는 단순히 모든 상태를 경고로 표시하는 것이 아니라,
사용자가 실제로 확인해야 할 문제만 선별하도록 정리했습니다.

Warning은 통신 지연이나 일부 조건 불일치처럼
문제 가능성이 있지만 통신 불가가 확정되지 않은 상태입니다.

Error는 연결 끊김, 실행 실패,
실제 통신 불가처럼 문제가 확인된 상태입니다.

Critical은 MonitorStatus를 통해
기기가 직접 심각한 상태를 보고한 경우입니다.

반대로 발행자는 있지만 구독자가 없는 상태,
Service나 Action이 아직 호출되지 않은 상태,
QoS를 판단할 수 없는 상태 등은
그 자체만으로 Alert를 만들지 않습니다.

---

## 5페이지. Alert 전체 목록 ①

현재 Monitor가 생성하는 Alert는 총 21종입니다.

먼저 Topic은 5종입니다.

발행자가 없는 경우,
발행자는 있지만 메시지를 한 번도 받지 못한 경우,
기존에 들어오던 메시지가 일정 시간 들어오지 않는 경우,
Topic 자체가 사라진 경우,
그리고 QoS 불일치가 있습니다.

MonitorStatus는 기기가 직접 보내는 상태를 기준으로
warning, error, critical 세 단계로 구분합니다.

Service는 응답 지연,
호출 실패,
연결 끊김,
QoS 불일치 네 종류를 관리합니다.

Service Server가 단순히 요청을 기다리는 상태는
정상 상태이므로 Alert로 처리하지 않습니다.

---

## 6페이지. Alert 전체 목록 ②

Action은 총 8종입니다.

Action 연결 끊김,
실행 중단,
취소,
요청 거부,
Goal 요청 실패,
결과 지연,
결과 수신 실패,
QoS 불일치를 구분합니다.

Action QoS는 하나의 통신만 보는 것이 아니라
Goal, Result, Cancel, Feedback, Status를
각각 구분해서 문제 위치를 확인할 수 있습니다.

Node는 이전에 보이던 Node가 일정 시간 계속 확인되지 않을 때
Node 연결 끊김으로 표시합니다.

QoS Alert는 일부 조건 불일치라면 warning,
실제 통신 불가가 확인되면 error로 구분합니다.

---

## 7페이지. MariaDB Alert 이력

Alert는 MariaDB에 발생부터 해결까지의 이력을 저장합니다.

같은 문제가 계속 유지되는 동안에는
같은 Alert 행을 유지하고 중복 INSERT를 하지 않습니다.

문제가 해결되면 기존 행을 삭제하지 않고
`resolved_at`에 해결 시각만 기록합니다.

같은 문제가 나중에 다시 발생하면
새로운 문제 발생으로 보고 새로운 이력을 추가합니다.

현재 발생 중인 Alert와 해결된 Alert 이력을 따로 조회할 수 있고,
해결 이력은 페이지 단위로 확인합니다.

MariaDB에 문제가 생겨도
Monitor 자체 수집이 중단되지 않도록
Backend 메모리 fallback도 제공합니다.

---

## 8페이지. QoS 진단

QoS는 단순히 값을 보여주는 것에서 끝나지 않고,
어디에서 확인한 정보인지와
실제 통신이 가능한지를 구분하도록 구성했습니다.

Topic은 rclpy Graph API를 통해
Publisher와 Subscriber의 QoS를 확인합니다.

Service와 Action은 Fast DDS discovery를 이용해
DDS endpoint 수준의 QoS를 관찰합니다.

Interface Lab에서는
Auto 또는 Manual 방식으로 실행 QoS를 선택할 수 있습니다.

또한 실제 RMW incompatible event가 발생한 경우에는
단순히 QoS 정보가 보인다는 것과 구분해서 표시합니다.

즉 Graph에 endpoint가 존재하는 것과
실제로 메시지 수신에 성공하는 것은 다르기 때문에,
발행 여부와 QoS 호환성을 함께 확인하는 구조입니다.

---

## 9페이지. QoS 항목 의미

QoS의 주요 항목을 간단하게 정리하면 다음과 같습니다.

Reliability는 메시지를 놓쳐도 되는지에 대한 조건입니다.
Reliable은 필요하면 재전송해서 전달을 보장하려고 합니다.

Durability는 늦게 들어온 구독자가
이전 데이터를 받을 수 있는지에 대한 조건입니다.

History는 메시지를 어떤 방식으로 보관할지,
Depth는 최근 몇 개를 보관할지를 의미합니다.

Deadline은 메시지가 언제까지 들어와야 하는지,
Lifespan은 메시지 하나가 언제까지 유효한지에 대한 조건입니다.

Liveliness는 Publisher가 살아있는지를 판단하는 방식이고,
Lease duration은 Publisher를 얼마 동안 살아있다고 인정할지를 의미합니다.

---

## 10페이지. Interface Lab QoS 실행

Interface Lab에서는 실제 Topic 통신을 실행할 때
QoS를 Auto 또는 Manual 방식으로 선택할 수 있습니다.

Auto QoS는 발견된 endpoint 정보를 기준으로
통신 가능한 QoS 조건을 자동으로 선택합니다.

Manual QoS는 사용자가
Reliability, Durability, History, Depth 등을 직접 지정합니다.

이후 선택한 QoS를 실제 Publish 또는 Receive에 적용합니다.

즉 이 화면은 QoS를 단순히 확인하는 화면이 아니라,
QoS 조건을 직접 바꿔가며
실제 통신이 가능한지 검증할 수 있는 기능입니다.

---

## 11페이지. Camera Topic 감시

Camera 기능도 별도의 독립 시스템으로 만들지 않고
기존 Topic 감시 구조에 포함했습니다.

`sensor_msgs/msg/Image`와
`CompressedImage` 타입을 인식하고 구독할 수 있습니다.

다만 이미지 데이터는 크기가 크기 때문에
일반 WebSocket snapshot에 계속 포함시키지 않습니다.

대신 사용자가 Topic 상세 화면에서 요청할 때만
필요한 Preview 이미지를 생성해 보여줍니다.

이 방식으로 일반 Topic 모니터링 구조를 유지하면서도
Camera 데이터를 확인할 수 있도록 했습니다.

---

## 12페이지. Camera Topic 이미지 출력 검증

실제 USB Camera와 Gazebo Camera를 이용해
ROS2 Camera Topic이 Dashboard에서
이미지로 출력되는 것을 확인했습니다.

흐름은 간단합니다.

Camera에서 ROS2 Image Topic이 발행되고,
Dashboard가 해당 Topic을 수신합니다.

사용자가 상세 화면에서 Preview를 요청하면
현재 이미지를 화면에 표시합니다.

즉 실제 장비 카메라와 시뮬레이션 카메라 모두
ROS2 Topic을 통해 Dashboard에서 확인할 수 있음을 검증했습니다.

---

## 13페이지. Interface Lab을 통한 Gazebo Burger 운용

Interface Lab은 모니터링뿐 아니라
사용자가 명시적으로 실제 ROS2 통신을 실행하는 기능입니다.

검증에서는 `/cmd_vel`의
`geometry_msgs/msg/TwistStamped`를 사용했습니다.

`linear.x` 값을 주면 전진,
`angular.z` 값을 주면 회전,
모든 속도를 0으로 주면 정지하도록 명령했습니다.

Dashboard에서 보낸 명령은 `/cmd_vel` Topic을 통해
`ros_gz_bridge`로 전달되고,
최종적으로 Gazebo의 TurtleBot3 Burger 움직임에 반영됩니다.

이를 통해 Interface Lab에서 만든 Topic Publish가
실제 ROS2 통신과 로봇 동작까지 연결되는 것을 확인했습니다.

---

## 14페이지. Ubuntu 24.04 설치 자동화

마지막으로 개발 환경에만 머무르지 않고
Fresh Ubuntu 24.04에서 설치할 수 있도록
설치 자동화를 구성했습니다.

`install.sh`를 통해
ROS2 Jazzy,
Backend,
Frontend,
MariaDB,
systemd,
Nginx 환경을 구성합니다.

ROS2 Workspace는 colcon build를 수행하고,
Frontend는 production build를 생성하며,
MariaDB는 DB와 사용자, Schema를 구성합니다.

설치 후에는
`start.sh`, `stop.sh`, `status.sh`로
서비스를 시작하고 중지하거나 현재 상태를 확인할 수 있습니다.

사용자가 Dashboard에 접속할 때의 최종 흐름은

Browser
→ HTTPS/WSS
→ Nginx
→ Backend
→ Monitor
→ ROS2

순서입니다.

Fresh Ubuntu VM에서 설치와 실행까지 확인했으며,
재부팅 자동 시작과 ROS Domain 유지 여부는
초기화된 환경에서 최종 재검증하는 단계입니다.

---

# 발표 마무리

이번 프로젝트의 핵심은
ROS2 상태를 단순히 화면에 나열하는 것이 아니라,

- ROS2 통신 구조를 실시간으로 감시하고
- QoS와 Alert로 문제 원인을 구분하며
- Camera Topic과 실제 데이터를 확인하고
- Interface Lab에서 직접 통신을 실행하고
- 새 Ubuntu 환경에서도 설치할 수 있도록

하나의 진단 Dashboard 형태로 통합한 것입니다.

감사합니다.
