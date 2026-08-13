const DISPLAY_TEXT = {
  active: '정상',
  disconnected: '연결 끊김',
  user: '사용자',
  parameter: '파라미터',
  action_internal: 'Action 내부',
  ros_internal: 'ROS 내부',
  node: 'Node',
  topic: 'Topic',
  service: 'Service',
  action: 'Action',
  monitor_status: 'Monitor 상태',
  'service server available': 'Service Server를 사용할 수 있습니다.',
  'action server available': 'Action Server를 사용할 수 있습니다.',
  'node discovered in ROS2 graph': '현재 ROS2 Graph에서 발견된 Node입니다.',
  'previously discovered resource is no longer visible in ROS2 graph':
    '이전에 발견됐지만 현재 ROS2 Graph에서 확인되지 않습니다.',
  'node connection lost; it is no longer visible in the ros2 graph.':
    'Node 연결이 끊겨 현재 ROS2 Graph에서 확인되지 않습니다.',
  'monitored node is confirmed absent from the ros2 graph.':
    '감시 대상 Node가 확인 시간 이후에도 ROS2 Graph에서 보이지 않습니다.',
  'resource is temporarily missing from ros2 graph; awaiting confirmation':
    'ROS2 Graph에서 일시적으로 보이지 않아 이탈 여부를 확인 중입니다.',
}

export function displayText(value, fallback = '-') {
  if (value == null || value === '') return fallback
  const text = String(value)
  return DISPLAY_TEXT[text.toLowerCase()] ?? text
}
