import { actionTopics, packageFromType } from './workspaceDataUtils.js'
import { firstType } from './workspacePresentation.js'

export function mergeGraphServiceEntries(graphServices = [], callableServices = []) {
  const byKey = new Map()
  graphServices.forEach((item) => {
    const serviceName = item.service_name ?? item.name
    const serviceType = firstType(item.service_type ?? item.type ?? item.types)
    if (!serviceName || !serviceType) return
    const key = `${item.domain_id ?? ''}|${serviceName}|${serviceType}`
    byKey.set(key, {
      ...item,
      callable: false,
      service_name: serviceName,
      service_type: serviceType,
      server_available: (item.server_count ?? 0) > 0,
    })
  })
  callableServices.forEach((item) => {
    const serviceName = item.service_name ?? item.name
    const serviceType = firstType(item.service_type ?? item.type)
    if (!serviceName || !serviceType) return
    const key = `${item.domain_id ?? ''}|${serviceName}|${serviceType}`
    byKey.set(key, {
      ...(byKey.get(key) ?? {}),
      ...item,
      service_name: serviceName,
      service_type: serviceType,
    })
  })
  return Array.from(byKey.values())
}

export function mergeGraphActionEntries(graphActions = [], callableActions = []) {
  const byKey = new Map()
  graphActions.forEach((item) => {
    const actionName = item.action_name ?? item.name
    const actionType = firstType(item.action_type ?? item.type ?? item.types)
    if (!actionName || !actionType) return
    const key = `${item.domain_id ?? ''}|${actionName}|${actionType}`
    byKey.set(key, {
      ...item,
      action_name: actionName,
      action_type: actionType,
      callable: false,
      server_available: (item.server_count ?? 0) > 0,
    })
  })
  callableActions.forEach((item) => {
    const actionName = item.action_name ?? item.name
    const actionType = firstType(item.action_type ?? item.type)
    if (!actionName || !actionType) return
    const key = `${item.domain_id ?? ''}|${actionName}|${actionType}`
    byKey.set(key, {
      ...(byKey.get(key) ?? {}),
      ...item,
      action_name: actionName,
      action_type: actionType,
    })
  })
  return Array.from(byKey.values())
}

export function callableServiceItem(item, history) {
  const filteredHistory = history.filter((call) =>
    call.service_name === item.service_name && call.service_type === item.service_type
      && call.domain_id === item.domain_id,
  )
  return {
    callable: Boolean(item.callable),
    error: item.reason && !item.callable ? item.reason : null,
    fullType: item.service_type,
    connectedServices: [item],
    connectedActions: [],
    connectedTopics: [],
    history: filteredHistory,
    id: `graph:service:${item.domain_id}:${item.service_name}:${item.service_type}`,
    importAvailable: item.import_available ?? null,
    kind: 'callable_service',
    lastRun: filteredHistory[0] ?? null,
    packageName: packageFromType(item.service_type),
    parsed: { request: item.request_schema, response: item.response_schema },
    raw_text: '',
    reason: item.reason,
    rebuildRequired: false,
    schema: item.request_schema,
    serverAvailable: item.server_available ?? null,
    source: 'graph',
    stableKey: `callable_service:${item.domain_id}:${item.service_name}:${item.service_type}`,
    status: item,
    subtitle: item.service_type,
    title: item.service_name || item.file_name,
  }
}

export function callableActionItem(item, history, _actionsByType, topics = []) {
  const filteredHistory = history.filter((goal) =>
    goal.action_name === item.action_name && goal.action_type === item.action_type
      && goal.domain_id === item.domain_id,
  )
  return {
    callable: Boolean(item.callable),
    error: item.reason && !item.callable ? item.reason : null,
    fullType: item.action_type,
    connectedActions: [item],
    connectedServices: [],
    connectedTopics: actionTopics(item.action_type, [item], topics),
    history: filteredHistory,
    id: `graph:action:${item.domain_id}:${item.action_name}:${item.action_type}`,
    importAvailable: item.import_available ?? null,
    kind: 'callable_action',
    lastRun: filteredHistory[0] ?? null,
    packageName: packageFromType(item.action_type),
    parsed: { goal: item.goal_schema, feedback: item.feedback_schema, result: item.result_schema },
    raw_text: '',
    reason: item.reason,
    rebuildRequired: false,
    schema: item.goal_schema,
    serverAvailable: item.server_available ?? null,
    source: 'graph',
    stableKey: `callable_action:${item.domain_id}:${item.action_name}:${item.action_type}`,
    status: item,
    subtitle: item.action_type,
    title: item.action_name || item.file_name,
  }
}
