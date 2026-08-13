const EXECUTION_TABS = Object.freeze([
  Object.freeze({ id: 'details', label: '통신 상세' }),
  Object.freeze({ id: 'history', label: 'History' }),
  Object.freeze({ id: 'advanced', label: '고급 정보' }),
  Object.freeze({ id: 'open-execution', label: '실행' }),
])

const PACKAGE_TABS = Object.freeze([
  Object.freeze({ id: 'advanced', label: 'Package 정보' }),
])

const ENDPOINT_FIELD_PATTERN = /name|type|qos|endpoint|publisher|subscriber|server|client|available|reason|channel/i

export function detailTabs(kind) {
  return kind === 'package' ? PACKAGE_TABS : EXECUTION_TABS
}

export function defaultDetailView(kind) {
  return kind === 'package' ? 'advanced' : 'details'
}

export function connectionCount(item = {}) {
  return listLength(item.connectedTopics)
    + listLength(item.connectedServices)
    + listLength(item.connectedActions)
}

export function communicationSnapshot(item = {}) {
  return {
    qos_mode: item.qos?.mode ?? 'auto',
    topics: compactEndpoints(item.connectedTopics),
    services: compactEndpoints(item.connectedServices),
    actions: compactEndpoints(item.connectedActions),
    subscriptions: compactEndpoints(item.topicStates),
  }
}

export function compactEndpoint(endpoint) {
  return Object.fromEntries(
    Object.entries(endpoint ?? {}).filter(([key]) => ENDPOINT_FIELD_PATTERN.test(key)),
  )
}

function compactEndpoints(endpoints) {
  return Array.isArray(endpoints) ? endpoints.map(compactEndpoint) : []
}

function listLength(value) {
  return Array.isArray(value) ? value.length : 0
}
