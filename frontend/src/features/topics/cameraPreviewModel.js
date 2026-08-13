export function centeredScrollPosition({
  clientHeight = 0,
  clientWidth = 0,
  scrollHeight = 0,
  scrollWidth = 0,
} = {}) {
  return {
    left: Math.max(0, (scrollWidth - clientWidth) / 2),
    top: Math.max(0, (scrollHeight - clientHeight) / 2),
  }
}

export function nextCameraZoom(current, amount) {
  return Math.min(400, Math.max(25, current + amount))
}

export function isCameraTopicType(topicType) {
  return [
    'sensor_msgs/msg/Image',
    'sensor_msgs/msg/CompressedImage',
  ].includes(topicType)
}
