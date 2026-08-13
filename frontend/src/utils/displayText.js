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
  'service server available': 'Service server is available.',
  'action server available': 'Action server is available.',
  'node discovered in ROS2 graph': 'Node is visible in the ROS2 graph.',
  'previously discovered resource is no longer visible in ROS2 graph':
    'The previously discovered resource is no longer visible in the ROS2 graph.',
  'node connection lost; it is no longer visible in the ros2 graph.':
    'Node is no longer visible in the ROS2 graph.',
  'monitored node is confirmed absent from the ros2 graph.':
    'The monitored Node is no longer visible in the ROS2 graph.',
  'resource is temporarily missing from ros2 graph; awaiting confirmation':
    'The resource is temporarily missing from the ROS2 graph. Waiting for confirmation.',
}

export function displayText(value, fallback = '-') {
  if (value == null || value === '') return fallback
  const text = String(value)
  return DISPLAY_TEXT[text.toLowerCase()] ?? text
}
