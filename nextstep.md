1.wss 로 구현
2.backend / frontend / ros2 로구현? 범용적으로 만들것
3.경고 정책 문서화
4.mariadb 경고내역 저장
5.실제 기기 qos 다름 , 쉘 qos 확인
6.토픽 데이터 이미지 생성
7.랩 실행탭 터틀봇제어
rviz2, gazebo - map 공부할것

# ROS2 Communication Monitor Dashboard
# 피드백 기반 개선 요구사항 정의

작성일: 2026-08-06
목적:
발표 피드백을 바탕으로 대시보드의 범용성, 보안성,
경고 신뢰도, 데이터 활용성, 로봇 제어 기능을 개선한다.


==================================================
1. WSS 기반 실시간 통신
==================================================

## 현재 구조

ROS2
→ rclpy Backend
→ FastAPI WebSocket
→ React Frontend

현재 WebSocket 연결이 ws:// 방식이라면
암호화되지 않은 통신이다.

## 개선 목표

배포 환경에서는 WebSocket Secure인
wss:// 연결을 사용한다.

WSS는 새로운 통신 기능이 아니라,
TLS가 적용된 보안 WebSocket이다.

ws://
= 암호화되지 않은 WebSocket

wss://
= TLS로 암호화된 WebSocket

## 구현 방향

- 개발 환경에서는 기존 ws:// 사용 가능
- 운영·외부 접속 환경에서는 wss:// 사용
- Nginx 또는 HTTPS 서버를 통해 TLS 적용
- Frontend에서 현재 페이지 프로토콜에 따라
  ws:// 또는 wss://를 선택하도록 구성
- WebSocket 주소를 코드에 하드코딩하지 않고
  환경 변수 또는 설정 파일에서 관리

## 완료 기준

- HTTPS로 접속한 Frontend에서 wss:// 연결 성공
- 실시간 상태 데이터가 기존과 동일하게 갱신됨
- 연결 해제 시 자동 재연결 동작 확인
- 인증서 오류와 혼합 콘텐츠 오류가 발생하지 않음


==================================================
2. ROS2 Workspace 구조 재정리
==================================================

## 피드백 해석

현재 프로젝트에서 ROS2 패키지와 빌드 대상이
backend/src 아래에 포함되어 있어,
웹 Backend와 ROS2 Workspace의 경계가 불명확하다.

ROS2 표준 Workspace 구조에 맞게
ROS2 패키지는 ros2_ws/src 아래에 배치하고,
Frontend와 문서 영역을 분리한다.

## 현재 구조의 문제

- backend/src가 ROS2 Workspace의 src 역할을 동시에 수행함
- ROS2 Interface 패키지가 Backend 하위에 포함돼 있음
- demo_nodes와 uploaded packages의 소속이 불명확함
- build, install, log의 기준 경로가 직관적이지 않음
- 웹 Backend와 ROS2 패키지의 책임 구분이 어려움

## 개선 목표 구조

ros2_dashboard/
├── ros2_ws/
│   ├── src/
│   │   ├── ros2_dashboard_monitor/
│   │   │   ├── config/
│   │   │   ├── launch/
│   │   │   ├── resource/
│   │   │   ├── ros2_dashboard_monitor/
│   │   │   │   ├── transport/
│   │   │   │   ├── ros2_topic/
│   │   │   │   ├── ros2_service/
│   │   │   │   ├── ros2_action/
│   │   │   │   ├── ros2_node/
│   │   │   │   └── interface_lab/
│   │   │   │       ├── management/
│   │   │   │       ├── apply/
│   │   │   │       ├── execution/
│   │   │   │       └── common/
│   │   │   └── test/
│   │   │
│   │   ├── ros2_dashboard_interfaces/
│   │   │   ├── msg/
│   │   │   ├── srv/
│   │   │   └── action/
│   │   │
│   │   ├── ros2_dashboard_demo_nodes/
│   │   │   ├── resource/
│   │   │   └── ros2_dashboard_demo_nodes/
│   │   │
│   │   └── uploaded_interfaces/
│   │       ├── generated_interfaces/
│   │       │   ├── msg/
│   │       │   ├── srv/
│   │       │   └── action/
│   │       └── packages/
│   │           └── <uploaded_ros_interface_package>/
│   │               ├── msg/
│   │               ├── srv/
│   │               └── action/
│   │
│   ├── build/
│   ├── install/
│   └── log/
│
├── backend/
│   ├── app/
│   │   ├── monitor_client/
│   │   ├── routers/
│   │   ├── alerts/
│   │   ├── database/
│   │   │   ├── repositories/
│   │   │   └── migrations/
│   │   └── user_preferences/
│   ├── config/
│   └── tests/
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── api/
│       ├── config/
│       ├── layout/
│       ├── pages/
│       ├── hooks/
│       ├── components/
│       │   └── visualization/
│       └── utils/
│
├── docs/
│   ├── architecture/
│   ├── alert_policy/
│   ├── qos/
│   └── interface_lab/
│
└── scripts/
## 정리 원칙

- colcon으로 빌드할 패키지는 ros2_ws/src 아래에 배치
- package.xml이 있는 단위는 ROS2 Package로 관리
- Frontend는 ROS2 Workspace 외부에 분리
- build, install, log는 소스 관리 대상에서 제외
- Backend가 ROS2 Python Package라면 ros2_ws/src 안에 유지
- 업로드된 Interface Package도 빌드 대상이면 src 아래에서 관리

## 완료 기준

- ros2_ws 루트에서 colcon build 실행 가능
- 모든 ROS2 Package가 ros2_ws/src 아래에 존재
- Frontend와 ROS2 Workspace가 명확히 분리됨
- source install/setup.bash 기준 경로가 통일됨
- 실행 문서와 실제 폴더 구조가 일치함


==================================================
3. 경고 정책 문서화
==================================================

## 문제

현재 상태값과 경고가 구현돼 있어도
어떤 조건에서 주의 또는 오류가 발생하는지 명확하지 않으면
사용자가 정상 상태를 장애로 오해할 수 있다.

예:
- Service Server는 있지만 Client가 없음
- Topic Publisher는 있지만 Subscriber가 없음
- 필요할 때만 발행되는 명령 Topic이 대기 중임

이 상태들은 항상 장애라고 할 수 없다.

## 개선 목표

Topic, Service, Action, Node별로
정상·주의·오류 조건을 문서로 정의한다.

## 문서에 포함할 항목

각 경고마다 다음 내용을 정의한다.

- 경고 코드
- 대상 종류
- 발생 조건
- 정상으로 간주할 예외
- 경고 수준
- 사용자 메시지
- 해제 조건
- 최초 감지 시간
- 마지막 감지 시간
- 설정 가능 여부

## 경고 수준 예시

INFO
= 참고용 상태이며 장애는 아님

WARNING
= 확인이 필요하지만 즉시 장애라고 단정할 수 없음

ERROR
= 필수 통신이 동작하지 않는 명확한 이상 상태

## Topic 정책 예시

MISSING
- Publisher가 존재함
- 감시 Subscription이 생성됨
- 일정 시간 동안 메시지를 한 번도 받지 못함
- 실제 발행 여부와 QoS 호환 여부 확인 필요

STALE
- 이전에는 메시지를 받았음
- 마지막 수신 이후 stale 기준 시간을 초과함

NO_PUBLISHER
- 필수 Topic인데 Publisher가 존재하지 않음

NO_SUBSCRIBER
- 일반적으로 경고하지 않음
- 반드시 Subscriber가 필요한 명령 Topic만 별도 정책 적용

## Service 정책 예시

SERVER_ONLY
- Server는 있고 Client가 없음
- 요청 대기형 Service에서는 정상
- 기본 경고 대상에서 제외

SERVER_MISSING
- 필수 Service인데 Server가 없음
- Client가 요청을 기다리는 경우 경고 가능

## Action 정책 예시

SERVER_ONLY
- Goal 요청 전에는 Client가 없어도 정상

SERVER_MISSING
- 필수 Action Server가 존재하지 않으면 경고

## Node 정책 예시

STALE 또는 DISAPPEARED
- 이전 Graph에서 확인된 Node가
  일정 시간 동안 다시 발견되지 않음

## 완료 기준

- 모든 경고 코드가 문서에 정의됨
- 화면의 경고 메시지와 문서 내용이 일치함
- 정상 대기 상태는 기본 경고에서 제외됨
- 필수 감시 대상만 실제 장애 경고로 표시됨


==================================================
4. MariaDB 경고 이력 저장
==================================================

## 현재 문제

경고가 Backend 메모리에만 존재하면
서버를 재시작했을 때 이전 기록이 사라진다.

또한 다음 내용을 확인하기 어렵다.

- 언제 장애가 시작됐는가
- 얼마나 지속됐는가
- 같은 문제가 몇 번 발생했는가
- 현재 경고가 해제됐는가

## 개선 목표

발생한 경고와 해제 이력을 MariaDB에 저장한다.

## 저장 대상

- 경고 ID
- 경고 코드
- 경고 수준
- 대상 종류
- 대상 이름
- 상태
- 메시지
- 발생 시각
- 마지막 감지 시각
- 해제 시각
- 지속 시간
- 추가 상세 정보
- 확인 여부

## 상태 예시

ACTIVE
= 현재 발생 중

RESOLVED
= 조건이 정상으로 돌아와 해제됨

ACKNOWLEDGED
= 사용자가 내용을 확인함

## 중복 저장 방지

같은 대상에서 같은 경고가 매초 발생하더라도
새 행을 계속 추가하지 않는다.

예:

topic:/scan:MISSING

동일 경고가 유지되면
- last_detected_at 갱신
- 발생 횟수 증가

정상으로 돌아오면
- status를 RESOLVED로 변경
- resolved_at 저장
- 지속 시간 계산

## 화면 기능

- 현재 경고 목록
- 과거 경고 이력
- 기간별 검색
- 대상별 검색
- 수준별 검색
- 발생 중·해제됨 필터
- 상세 내용 확인

## 완료 기준

- Backend 재시작 후에도 경고 이력 유지
- 동일 경고가 불필요하게 중복 저장되지 않음
- 발생과 해제 시간이 기록됨
- Frontend에서 현재 경고와 과거 이력을 구분해 조회 가능


==================================================
5. 실제 기기 QoS 차이 확인 및 Shell 점검
==================================================

## 문제

테스트 환경과 실제 기기의 QoS가 다르면
ROS2 Graph에는 Publisher와 Topic이 보이지만
대시보드 Subscription은 메시지를 받지 못할 수 있다.

그 결과 다음 현상이 발생할 수 있다.

- latest 값 없음
- Hz가 0 또는 미지원
- missing 발생
- stale 발생
- Publisher는 목록에 표시됨

## 개선 목표

실제 기기의 QoS를 Shell에서 확인하고,
대시보드의 Subscription QoS와 호환되는지 검증한다.

## 기본 확인 명령

ros2 topic info /토픽이름 --verbose

확인 대상:

- Reliability
- Durability
- History
- Depth
- Deadline
- Lifespan
- Liveliness

## 검증 순서

1. Topic과 Publisher가 Graph에 존재하는지 확인
2. 실제로 메시지가 발행되는지 확인
3. Publisher QoS 확인
4. Dashboard Subscription QoS 확인
5. 두 QoS가 호환되는지 비교
6. latest, Hz, missing, stale 상태 재확인

## 개선 방향

- 알려진 타입은 Publisher QoS를 참고해 Subscription 생성
- 센서 데이터는 Sensor Data QoS 사용 여부 검토
- QoS 불일치 가능성을 상세 화면에 표시
- 실제 QoS와 감시 QoS를 함께 표시
- QoS 문제를 단순 메시지 미수신과 구분할 방법 검토

## 주의

Graph에서 Topic이 보인다는 사실만으로
메시지를 정상 수신한다는 의미는 아니다.

## 완료 기준

- 실제 기기 주요 Topic의 QoS 목록 작성
- Shell 확인 절차 문서화
- 대시보드 Subscription QoS와 비교 완료
- QoS 차이로 인한 미수신 사례 재현 및 검증


==================================================
6. Topic 데이터를 이용한 이미지 생성
==================================================

## 피드백 해석

Topic의 JSON 데이터만 표시하는 것을 넘어,
데이터 특성에 맞는 시각적 결과를 생성한다.

단, 모든 Topic을 이미지로 만드는 것이 아니라
이미지 또는 공간 데이터로 표현할 가치가 있는 타입부터 지원한다.

## 우선 검토 타입

sensor_msgs/msg/Image
- 카메라 영상 표시

sensor_msgs/msg/CompressedImage
- 압축 이미지 표시

sensor_msgs/msg/LaserScan
- 거리 데이터를 2D 스캔 이미지로 표시

nav_msgs/msg/OccupancyGrid
- Map 데이터를 이미지로 표시

nav_msgs/msg/Path
- 이동 경로를 2D 이미지 또는 그래프로 표시

geometry_msgs/msg/Pose
- 위치와 방향을 좌표 화면에 표시

## 구현 방향

Topic 타입 식별
→ 데이터 수신
→ 타입별 변환기 선택
→ 이미지 또는 Canvas 데이터 생성
→ Frontend에 표시

## 주의할 점

- 고주파 Topic을 매번 이미지로 변환하면 성능 저하 가능
- 최신 데이터 기준으로 갱신 주기 제한 필요
- 큰 이미지의 WebSocket 전송 방식 검토 필요
- 원본 데이터 전체 전송과 축소 데이터 전송을 구분
- 타입별 렌더러를 분리해 확장 가능하게 구성

## 완료 기준

- 최소 한 개 이상의 Topic 타입 시각화 구현
- LaserScan 또는 OccupancyGrid 우선 검토
- 데이터가 없을 때 빈 화면과 오류 상태 구분
- 화면 갱신으로 Backend와 Frontend가 과부하되지 않음


==================================================
7. Interface Lab 실행 탭에서 TurtleBot 제어
==================================================

## 현재 Interface Lab 역할

- Topic Publish와 Receive
- Service Call
- Action Goal
- 실행 결과와 이력 확인

## 개선 목표

Interface Lab에서 실제 TurtleBot3 제어 명령을 실행하고,
그 결과를 대시보드에서 확인한다.

## 우선 기능

Topic Publish
- /cmd_vel 또는 실제 로봇의 제어 Topic
- 직진
- 후진
- 좌회전
- 우회전
- 정지

Service Call
- Nav2 또는 로봇 시스템에서 제공하는 Service 확인
- 실제 제공되는 Service만 UI에 연결

Action Goal
- Nav2 NavigateToPose 등
- 목표 위치 입력
- Goal 전송
- Feedback 확인
- Result 확인
- Cancel 실행

## UI 구성 방향

실행 탭
- 명령 대상 선택
- Interface 타입 확인
- 입력값 작성
- 실행 버튼
- 즉시 정지 버튼
- 실행 상태
- Feedback
- Result
- 실행 이력

## 안전 정책

- 속도 상한 설정
- 기본값은 낮은 속도로 제한
- 정지 명령을 항상 노출
- 명령 전송 주기 제한
- 연결이 끊기면 정지하도록 검토
- 실제 로봇과 Simulation 실행을 구분해 표시

## 완료 기준

- Interface Lab에서 TurtleBot 이동 명령 전송 성공
- 명령 발생 Node 또는 실행 주체 확인 가능
- Action Feedback과 Result 표시
- 정지 기능 검증
- Simulation과 실제 기기에서 구분 테스트


==================================================
8. 전체 우선순위
==================================================

1단계: 요구사항과 기준 정리

- 경고 정책 문서화
- 현재 WebSocket 구조 확인
- 실제 기기 QoS 조사
- Backend·Frontend·ROS2 책임 범위 정리

2단계: 기반 구조 개선

- 범용 설정 구조 정리
- WSS 적용 구조 설계
- MariaDB 경고 이력 설계
- QoS 정보 수집과 표시 개선

3단계: 기능 확장

- Topic 데이터 시각화
- Interface Lab TurtleBot 제어
- Action Feedback·Result·Cancel 강화

4단계: 로봇 시각화 학습 및 적용

- Gazebo
- RViz2
- TF
- Map
- Nav2
- 웹 시각화 범위 결정


==================================================
9. 먼저 확인해야 할 사항
==================================================

1. WSS 피드백이
   단순 WebSocket 보안 적용을 뜻하는지,
   아니면 외부 원격 접속 전체의 HTTPS 적용까지 뜻하는지 확인
   -wss 보안 적용

2. 범용화 대상이
   모든 ROS2 프로젝트인지,
   회사 장비군 내의 여러 프로젝트인지 범위 확인
   - 프로젝트 구조 수정

3. MariaDB가
   프로젝트의 필수 DB인지,
   제안 기술인지 확인
   -필수
4. Topic 이미지 생성의 대상이
   Camera Image인지,
   LaserScan·Map 같은 데이터 시각화인지 확인
   -카메라이미지
5. TurtleBot 제어 범위가
   단순 /cmd_vel 제어인지,
   Nav2 Goal 실행까지 포함하는지 확인
   -명령으로 가제보 움직이기


<!-- 
==================================================
8. RViz2 · Gazebo · Map 학습 및 적용
==================================================

## 학습 목적

대시보드가 ROS2 데이터를 단순 목록으로만 보여주는 것을 넘어,
로봇의 위치, 센서, 지도, 목표 경로를 이해하고
시각화하기 위한 기반 지식을 학습한다.

## Gazebo

역할:
- 가상 로봇과 가상 환경을 실행하는 Simulation 도구
- 센서, 이동, 충돌, 물리 동작을 테스트

학습 항목:
- TurtleBot3 Simulation 실행
- World와 Robot Model
- /cmd_vel 제어
- /scan, /odom, /tf 데이터 확인
- 실제 기기와 Simulation Topic 비교

## RViz2

역할:
- ROS2 Topic과 TF 데이터를 시각화하는 도구
- 실제 물리 Simulation 도구는 아님

학습 항목:
- Fixed Frame
- TF
- LaserScan
- Odometry
- RobotModel
- Map
- Path
- Pose
- Nav2 Goal

## Map

학습 항목:
- nav_msgs/msg/OccupancyGrid
- map_server
- SLAM으로 Map 생성
- 저장된 Map 불러오기
- 좌표계 map, odom, base_link 관계
- Map 위에 현재 위치와 경로 표시

## 대시보드 연결 방향

RViz2를 그대로 웹에 넣는 것이 아니라,
RViz2가 어떤 ROS2 데이터를 사용해 시각화하는지 이해한 뒤
필요한 일부 기능을 웹 대시보드에 구현한다.

예:

/scan
→ LaserScan 2D 시각화

/map
→ OccupancyGrid 이미지 표시

/odom
→ 로봇 위치 표시

/plan
→ 이동 예정 경로 표시

## 완료 기준

- Gazebo에서 TurtleBot3 실행
- RViz2에서 LaserScan, Map, RobotModel 표시
- map, odom, base_link 관계 설명 가능
- 대시보드에서 우선 구현할 시각화 기능 선정
 -->