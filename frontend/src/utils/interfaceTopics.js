export function topicHasType(topic, fullType) {
  const types = Array.isArray(topic?.types)
    ? topic.types
    : Array.isArray(topic?.type)
      ? topic.type
      : [topic?.type]
  return types.includes(fullType)
}

export function isActionInternalTopic(topicName = '') {
  return topicName.includes('/_action/') || topicName.endsWith('/_action')
}

export function graphPublishTopicCandidates(topics = [], fullType = '') {
  if (!fullType) return []
  return topics.filter((topic) =>
    !isActionInternalTopic(topic?.name)
      && topicHasType(topic, fullType))
}

export function topicNameTypeWarning(topics = [], topicName = '', fullType = '') {
  const normalizedName = topicName.trim()
  if (!normalizedName || !fullType) return null
  if (isActionInternalTopic(normalizedName)) {
    return 'Action internal topics cannot be used for regular Message publishing in Interface Lab.'
  }
  const sameNameTopics = topics.filter((topic) => topic?.name === normalizedName)
  if (sameNameTopics.some((topic) => !topicHasType(topic, fullType))) {
    return 'The ROS2 graph contains the same Topic name with a different Message type. This combination cannot be published.'
  }
  return null
}
