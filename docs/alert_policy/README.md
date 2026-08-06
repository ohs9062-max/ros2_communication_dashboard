# Alert ownership

Publisher/Subscriber, Server/Client, Graph, latest, Hz, age, missing, stale 같은 ROS2 사실은
Monitor가 판정합니다. Backend의 `AlertHistoryService`는 전달받은 Alert의 해결 이력,
사용자 확인 상태, 조회 응답을 관리합니다. 향후 MariaDB repository는 이 서비스 경계에
연결하며 Monitor transport로 사용하지 않습니다.
