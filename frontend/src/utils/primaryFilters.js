const INTERNAL_TOPIC_NAMES = new Set([
  '/clock',
  '/parameter_events',
  '/rosout',
  '/tf',
  '/tf_static',
])

export function isRegisteredTopic(topic) {
  return topic?.supported_type === true
}

export function isRegisteredService(service) {
  return service?.allowlisted === true
}

export function isRegisteredAction(action) {
  return action?.allowlisted === true
}

export function isPrimaryService(service) {
  const status = String(
    service?.effective_status ?? service?.status ?? 'unknown',
  ).toLowerCase()
  const issue = [
    'waiting_server',
    'disconnected',
    'error',
    'failed',
    'timeout',
  ].includes(status)

  return (
    service?.primary === true ||
    isRegisteredService(service) ||
    issue ||
    (
      service?.category === 'user' &&
      service?.hidden_by_default !== true
    )
  )
}

export function isPrimaryTopic(topic) {
  if (isInternalTopic(topic?.name)) {
    return false
  }

  return topic?.primary === true
}

export function isPrimaryAction(action) {
  const runtime = action?.runtime ?? {}
  const observedGoalCount =
    Number(runtime.observed_goal_count ?? action?.observed_goal_count ?? 0)
  const lastGoalStatus = String(
    runtime.last_goal_status ?? action?.last_goal_status ?? '',
  ).toLowerCase()

  return (
    action?.primary === true ||
    isRegisteredAction(action) ||
    observedGoalCount > 0 ||
    Boolean(lastGoalStatus && lastGoalStatus !== 'unknown') ||
    Boolean(runtime.feedback_preview) ||
    Boolean(runtime.result_preview) ||
    Boolean(runtime.result_status) ||
    Boolean(runtime.result_error)
  )
}

function isInternalTopic(name = '') {
  return (
    INTERNAL_TOPIC_NAMES.has(name) ||
    name.endsWith('/_action/status') ||
    name.endsWith('/_action/feedback') ||
    name.endsWith('/_service_event')
  )
}
