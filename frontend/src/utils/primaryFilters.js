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
  return service?.is_primary === true
}

export function isPrimaryTopic(topic) {
  return topic?.is_primary === true
}

export function isPrimaryAction(action) {
  return action?.is_primary === true
}
