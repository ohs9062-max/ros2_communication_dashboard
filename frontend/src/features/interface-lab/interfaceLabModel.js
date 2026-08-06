import { topicHasType } from '../../utils/interfaceTopics.js'

export function buildSummary({ callableActions, callableMessages = [], callableServices, packages, registry }) {
  const items = [
    ...(registry.messages ?? []),
    ...(registry.services ?? []),
    ...(registry.actions ?? []),
  ]
  return {
    actions: registry.actions?.length ?? 0,
    callableActions: callableActions.filter((item) => item.callable).length,
    callableMessages: callableMessages.filter((item) => item.import_available).length,
    callableServices: callableServices.filter((item) => item.callable).length,
    importable: items.filter((item) => item.build?.import_available).length,
    messages: registry.messages?.length ?? 0,
    packages: packages?.length ?? 0,
    rebuildRequired: items.filter((item) => item.build?.rebuild_required).length,
    services: registry.services?.length ?? 0,
  }
}

export function buildWorkspaceItems({
  actionHistory,
  callableActions,
  callableMessages = [],
  callableServices,
  filter,
  graphActions = [],
  graphServices = [],
  packages,
  receiveTopics = [],
  registry,
  serviceHistory,
  topicPublishHistory = [],
  topicReceiveHistory = [],
  topics,
}) {
  const graphServiceEntries = mergeGraphServiceEntries(graphServices, callableServices)
  const graphActionEntries = mergeGraphActionEntries(graphActions, callableActions)
  const messagesByType = Object.fromEntries(
    callableMessages.map((item) => [item.message_type ?? item.full_type ?? item.topic_type, item]),
  )
  const servicesByType = groupByType(graphServiceEntries, 'service_type')
  const actionsByType = groupByType(graphActionEntries, 'action_type')
  const topicContext = {
    messagesByType,
    receiveTopics,
    topicPublishHistory,
    topicReceiveHistory,
  }
  const items = [
    ...(registry.messages ?? []).map((item) => registryItem(item, 'message', {
      actionsByType,
      actionHistory,
      servicesByType,
      serviceHistory,
      ...topicContext,
      topics,
    })),
    ...(registry.services ?? []).map((item) => registryItem(item, 'service', {
      actionsByType,
      actionHistory,
      history: serviceHistory,
      servicesByType,
      topics,
    })),
    ...(registry.actions ?? []).map((item) => registryItem(item, 'action', {
      actionsByType,
      history: actionHistory,
      servicesByType,
      serviceHistory,
      topics,
    })),
    ...(packages ?? []).flatMap((item) => packageItems(item, {
      actionsByType,
      actionHistory,
      servicesByType,
      serviceHistory,
      ...topicContext,
      topics,
    })),
    ...graphServiceEntries.map((item) => callableServiceItem(item, serviceHistory)),
    ...graphActionEntries.map((item) => callableActionItem(item, actionHistory, actionsByType, topics)),
  ]

  return mergeWorkspaceItemsByType(items, topics)
    .filter((item) => !item.graphOnly)
    .filter((item) => matchesWorkspaceFilter(item, filter))
}

export function mergeGraphServiceEntries(graphServices = [], callableServices = []) {
  const byKey = new Map()
  graphServices.forEach((item) => {
    const serviceName = item.service_name ?? item.name
    const serviceType = firstType(item.service_type ?? item.type ?? item.types)
    if (!serviceName || !serviceType) return
    byKey.set(`${serviceName}|${serviceType}`, {
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
    byKey.set(`${serviceName}|${serviceType}`, {
      ...(byKey.get(`${serviceName}|${serviceType}`) ?? {}),
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
    byKey.set(`${actionName}|${actionType}`, {
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
    byKey.set(`${actionName}|${actionType}`, {
      ...(byKey.get(`${actionName}|${actionType}`) ?? {}),
      ...item,
      action_name: actionName,
      action_type: actionType,
    })
  })
  return Array.from(byKey.values())
}

export function mergeWorkspaceItemsByType(items = [], topics = []) {
  const packageItems = items.filter((item) => item.kind === 'package')
  const mergeableItems = items.filter((item) => item.kind !== 'package')
  const byKey = new Map()
  mergeableItems.forEach((item) => {
    const normalizedKind = normalizeWorkspaceKind(item.kind)
    const fullType = item.fullType
    if (!fullType) return
    const key = `${normalizedKind}:${fullType}`
    const current = byKey.get(key)
    byKey.set(key, current ? mergeWorkspaceItem(current, item) : normalizeMergeItem(item, normalizedKind))
  })
  return [
    ...packageItems,
    ...Array.from(byKey.values()).map((item) => finalizeMergedWorkspaceItem(item, topics)),
  ]
}

export function normalizeMergeItem(item, normalizedKind) {
  const source = item.source ?? (item.status?.source) ?? 'unknown'
  return {
    ...item,
    graphOnly: source === 'graph',
    id: `${normalizedKind}:${item.fullType}`,
    kind: normalizedKind,
    sources: uniqueStrings([...(item.sources ?? []), source]),
    stableKey: `${normalizedKind}:${item.fullType}`,
  }
}

export function mergeWorkspaceItem(left, right) {
  const normalizedRight = normalizeMergeItem(right, normalizeWorkspaceKind(right.kind))
  const connectedServices = mergeByNameAndType(
    [...(left.connectedServices ?? []), ...(normalizedRight.connectedServices ?? [])],
    'service_name',
    'service_type',
  )
  const connectedActions = mergeByNameAndType(
    [...(left.connectedActions ?? []), ...(normalizedRight.connectedActions ?? [])],
    'action_name',
    'action_type',
  )
  const topicStates = mergeByNameAndType(
    [...(left.topicStates ?? []), ...(normalizedRight.topicStates ?? [])],
    'topic_name',
    'topic_type',
  )
  const graphConflicts = [
    ...(left.graphConflicts ?? []),
    ...(normalizedRight.graphConflicts ?? []),
  ]
  const sources = uniqueStrings([...(left.sources ?? []), ...(normalizedRight.sources ?? [])])
  const history = mergeHistory([...(left.history ?? []), ...(normalizedRight.history ?? [])])
  return {
    ...left,
    callable: [...connectedServices, ...connectedActions].some((entry) => entry.callable) || left.callable || normalizedRight.callable || null,
    connectedActions,
    connectedServices,
    connectedTopics: [...(left.connectedTopics ?? []), ...(normalizedRight.connectedTopics ?? [])],
    error: left.error ?? normalizedRight.error,
    graphOnly: left.graphOnly && normalizedRight.graphOnly,
    history,
    importAvailable: left.importAvailable ?? normalizedRight.importAvailable,
    lastRun: history[0] ?? left.lastRun ?? normalizedRight.lastRun,
    packageName: left.packageName ?? normalizedRight.packageName,
    parsed: hasMeaningfulParsed(left.parsed) ? left.parsed : normalizedRight.parsed,
    raw_text: left.raw_text || normalizedRight.raw_text,
    reason: left.reason ?? normalizedRight.reason,
    rebuildRequired: left.rebuildRequired || normalizedRight.rebuildRequired,
    schema: schemaFields(left.schema).length ? left.schema : normalizedRight.schema,
    serverAvailable: [...connectedServices, ...connectedActions].some((entry) => entry.server_available || entry.server_count > 0) || left.serverAvailable || normalizedRight.serverAvailable || null,
    source: sources[0],
    sources,
    status: {
      registry_or_package: left.status,
      graph: normalizedRight.status,
      sources,
    },
    graphConflicts,
    topicStates,
  }
}

export function finalizeMergedWorkspaceItem(item, topics = []) {
  const graphNames = item.kind === 'service'
    ? uniqueStrings((item.connectedServices ?? []).map((entry) => entry.service_name).filter(Boolean))
    : item.kind === 'action'
    ? uniqueStrings((item.connectedActions ?? []).map((entry) => entry.action_name).filter(Boolean))
    : []
  const connectedTopics = item.kind === 'message'
    ? topics.filter((topic) => topicHasType(topic, item.fullType))
    : item.connectedTopics ?? []
  const title = graphNames.length === 1
    ? graphNames[0]
    : graphNames.length > 1
    ? item.fullType
    : item.title
  return {
    ...item,
    connectedTopics,
    graphOnly: item.sources?.length === 1 && item.sources[0] === 'graph',
    id: `${item.kind}:${item.fullType}`,
    serverAvailable: item.serverAvailable ?? null,
    source: item.sources?.[0] ?? item.source,
    stableKey: `${item.kind}:${item.fullType}`,
    subtitle: item.kind === 'message'
      ? `${item.fullType}${connectedTopics.length ? ` · topics ${connectedTopics.length}` : ''}`
      : item.fullType,
    title,
  }
}

export function registryItem(item, kind, {
  actionsByType = {},
  callable = null,
  history = [],
  messagesByType = {},
  receiveTopics = [],
  servicesByType = {},
  topics = [],
  topicPublishHistory = [],
  topicReceiveHistory = [],
} = {}) {
  const build = item.build ?? {}
  const fullType = callable?.service_type ?? callable?.action_type ?? registryFullType(item, kind)
  const messageState = kind === 'message' ? messagesByType[fullType] : null
  const connectedServices = servicesByType[fullType] ?? []
  const connectedActions = actionsByType[fullType] ?? []
  const topicHistory = kind === 'message'
    ? topicHistoryForType(topicPublishHistory, topicReceiveHistory, fullType)
    : []
  const filteredHistory = kind === 'message'
    ? topicHistory
    : filterHistoryByType(history, fullType, kind)
  return {
    callable: callable?.callable ?? null,
    error: build.error ?? item.parsed_error ?? callable?.reason ?? null,
    connectedActions,
    connectedServices,
    connectedTopics: kind === 'message'
      ? topics.filter((topic) => topicHasType(topic, fullType))
      : actionTopics(fullType, connectedActions, topics),
    fullType,
    history: filteredHistory,
    id: `single:${kind}:${item.file_name}`,
    importAvailable: messageState?.import_available ?? build.import_available ?? null,
    kind,
    lastRun: filteredHistory?.[0] ?? null,
    packageName: build.package_name ?? packageFromType(fullType),
    parsed: item.parsed,
    raw_text: item.raw_text,
    reason: callable?.reason,
    rebuildRequired: Boolean(build.rebuild_required),
    schema: kind === 'message'
      ? messageState?.message_schema ?? item.parsed ?? []
      : callable?.request_schema ?? callable?.goal_schema,
    serverAvailable: callable?.server_available ?? null,
    source: item.source ?? 'single_upload',
    stableKey: `${kind}:${fullType}`,
    status: build,
    subtitle: fullType,
    title: item.file_name,
    graphConflicts: messageState?.graph_conflicts ?? [],
    qos: { depth: 10, profile: 'default' },
    topicStates: kind === 'message'
      ? receiveTopics.filter((state) => state.topic_type === fullType)
      : [],
  }
}

export function packageItems(item, context) {
  const counts = {
    action: item.interfaces?.action?.length ?? 0,
    message: item.interfaces?.msg?.length ?? 0,
    service: item.interfaces?.srv?.length ?? 0,
  }
  const packageItem = {
    callable: null,
    error: item.import_error ?? null,
    fullType: item.name,
    history: [],
    id: `package:${item.name}`,
    importAvailable: item.import_available ?? null,
    kind: 'package',
    lastRun: null,
    packageName: item.name,
    parsed: item.interfaces,
    raw_text: `${item.package_xml_summary ?? ''}\n${item.cmake_summary ?? ''}`.trim(),
    reason: null,
    rebuildRequired: Boolean(item.rebuild_required),
    schema: counts,
    serverAvailable: null,
    source: 'uploaded_package',
    stableKey: `package:${item.name}`,
    status: item,
    counts,
    subtitle: item.path ?? '-',
    title: item.name,
  }
  const childItems = [
    ...(item.interfaces?.msg ?? []).map((child) => packageTypeItem(item, child, 'message', context)),
    ...(item.interfaces?.srv ?? []).map((child) => packageTypeItem(item, child, 'service', context)),
    ...(item.interfaces?.action ?? []).map((child) => packageTypeItem(item, child, 'action', context)),
  ]
  return [packageItem, ...childItems]
}

export function packageTypeItem(packageItem, item, kind, {
  actionsByType = {},
  actionHistory = [],
  servicesByType = {},
  serviceHistory = [],
  messagesByType = {},
  receiveTopics = [],
  topicPublishHistory = [],
  topicReceiveHistory = [],
  topics = [],
} = {}) {
  const connectedServices = servicesByType[item.type] ?? []
  const connectedActions = actionsByType[item.type] ?? []
  const parsed = item.parsed ?? {}
  const schema = kind === 'service'
    ? parsed.request ?? []
    : kind === 'action'
    ? parsed.goal ?? []
    : Array.isArray(parsed) ? parsed : parsed.fields ?? []
  const history = kind === 'service'
    ? filterHistoryByType(serviceHistory, item.type, kind)
    : kind === 'action'
    ? filterHistoryByType(actionHistory, item.type, kind)
    : topicHistoryForType(topicPublishHistory, topicReceiveHistory, item.type)
  const messageState = kind === 'message' ? messagesByType[item.type] : null
  return {
    callable: [...connectedServices, ...connectedActions].some((entry) => entry.callable) || null,
    connectedActions,
    connectedServices,
    connectedTopics: kind === 'message'
      ? topics.filter((topic) => topicHasType(topic, item.type))
      : actionTopics(item.type, connectedActions, topics),
    error: item.import_error ?? item.parsed_error ?? null,
    fullType: item.type,
    history,
    id: `package:${packageItem.name}:${kind}:${item.type}`,
    importAvailable: messageState?.import_available ?? item.import_available ?? null,
    kind,
    lastRun: history[0] ?? null,
    packageName: packageItem.name,
    parsed: item.parsed,
    raw_text: item.raw_text ?? '',
    reason: null,
    rebuildRequired: Boolean(packageItem.rebuild_required),
    schema: kind === 'message' ? messageState?.message_schema ?? schema : schema,
    serverAvailable: [...connectedServices, ...connectedActions].some((entry) => entry.server_available) || null,
    source: 'uploaded_package',
    stableKey: `${kind}:${item.type}`,
    status: item,
    subtitle: item.type,
    title: item.name ?? item.type,
    graphConflicts: messageState?.graph_conflicts ?? [],
    qos: { depth: 10, profile: 'default' },
    topicStates: kind === 'message'
      ? receiveTopics.filter((state) => state.topic_type === item.type)
      : [],
  }
}

export function callableServiceItem(item, history) {
  const filteredHistory = history.filter((call) =>
    call.service_name === item.service_name && call.service_type === item.service_type,
  )
  return {
    callable: Boolean(item.callable),
    error: item.reason && !item.callable ? item.reason : null,
    fullType: item.service_type,
    connectedServices: [item],
    connectedActions: [],
    connectedTopics: [],
    history: filteredHistory,
    id: `graph:service:${item.service_name}:${item.service_type}`,
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
    stableKey: `callable_service:${item.service_name}:${item.service_type}`,
    status: item,
    subtitle: item.service_type,
    title: item.service_name || item.file_name,
  }
}

export function callableActionItem(item, history, _actionsByType, topics = []) {
  const filteredHistory = history.filter((goal) =>
    goal.action_name === item.action_name && goal.action_type === item.action_type,
  )
  return {
    callable: Boolean(item.callable),
    error: item.reason && !item.callable ? item.reason : null,
    fullType: item.action_type,
    connectedActions: [item],
    connectedServices: [],
    connectedTopics: actionTopics(item.action_type, [item], topics),
    history: filteredHistory,
    id: `graph:action:${item.action_name}:${item.action_type}`,
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
    stableKey: `callable_action:${item.action_name}:${item.action_type}`,
    status: item,
    subtitle: item.action_type,
    title: item.action_name || item.file_name,
  }
}

export function defaultValues(schema = []) {
  return Object.fromEntries(
    schemaFields(schema)
      .filter((field) => field.name)
      .map((field) => [field.name, defaultValue(field.type)]),
  )
}

export function normalizeNumericValues(values, schema = []) {
  const numericFields = new Set(
    schemaFields(schema)
      .filter((field) => field.name && isNumericType(field.type))
      .map((field) => field.name),
  )
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      numericFields.has(name) && value !== '' ? Number(value) : value,
    ]),
  )
}

export function schemaFields(schema) {
  return Array.isArray(schema) ? schema : []
}

export function defaultValue(type = '') {
  if (type === 'bool' || type === 'boolean') return false
  if (isArrayType(type)) return []
  if (isCustomType(type)) return {}
  if (isNumericType(type)) return 0
  return ''
}

export function isNumericType(type = '') {
  return /^(?:u?int(?:8|16|32|64)|float(?:32|64)|double)$/.test(type)
}

export function isArrayType(type = '') {
  return /\[[0-9]*\]$/.test(type) || /^sequence<.+>$/.test(type)
}

export function isCustomType(type = '') {
  return /^[A-Za-z][A-Za-z0-9_]*\/(?:msg\/)?[A-Z][A-Za-z0-9_]*$/.test(type)
}

export function isComplexType(type = '') {
  return isArrayType(type) || isCustomType(type)
}

export function groupByType(items, key) {
  return items.reduce((grouped, item) => {
    const type = item[key]
    if (!type) return grouped
    grouped[type] = [...(grouped[type] ?? []), item]
    return grouped
  }, {})
}

export function normalizeWorkspaceKind(kind) {
  if (kind === 'callable_service') return 'service'
  if (kind === 'callable_action') return 'action'
  return kind
}

export function uniqueStrings(items = []) {
  return Array.from(new Set(items.filter(Boolean)))
}

export function firstType(value) {
  if (Array.isArray(value)) return value[0]
  return value
}

export function mergeByNameAndType(items = [], nameKey, typeKey) {
  const byKey = new Map()
  items.forEach((item) => {
    const key = `${item?.[nameKey] ?? ''}|${item?.[typeKey] ?? ''}`
    if (!item || key === '|') return
    byKey.set(key, { ...(byKey.get(key) ?? {}), ...item })
  })
  return Array.from(byKey.values())
}

export function mergeHistory(items = []) {
  const byKey = new Map()
  items.forEach((item, index) => {
    const key = [
      item.called_at ?? item.sent_at ?? item.published_at ?? item.received_at ?? item.id ?? index,
      item.service_name ?? item.action_name ?? item.topic_name ?? '',
      item.service_type ?? item.action_type ?? item.topic_type ?? '',
      item.direction ?? '',
    ].join(':')
    byKey.set(key, item)
  })
  return Array.from(byKey.values()).sort((a, b) =>
    (b.called_at ?? b.sent_at ?? b.published_at ?? b.received_at ?? 0)
      - (a.called_at ?? a.sent_at ?? a.published_at ?? a.received_at ?? 0),
  )
}

export function hasMeaningfulParsed(value) {
  if (!value) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

export function registryFullType(item, kind) {
  const build = item.build ?? {}
  const packageName = build.package_name ?? build.interface_package
  if (packageName && item.type_name) {
    if (kind === 'service') return `${packageName}/srv/${item.type_name}`
    if (kind === 'action') return `${packageName}/action/${item.type_name}`
    return `${packageName}/msg/${item.type_name}`
  }
  return item.type_name
}

export function filterHistoryByType(history, fullType, kind) {
  if (kind === 'service') {
    return history.filter((item) => item.service_type === fullType)
  }
  if (kind === 'action') {
    return history.filter((item) => item.action_type === fullType)
  }
  return []
}

export function topicHistoryForType(publishHistory = [], receiveHistory = [], fullType) {
  const publishItems = publishHistory
    .filter((item) => item.topic_type === fullType)
    .map((item) => ({ ...item, direction: item.direction ?? 'topic_publish' }))
  const receiveItems = receiveHistory
    .filter((item) => item.topic_type === fullType)
    .map((item) => ({ ...item, direction: item.direction ?? 'topic_subscribe' }))
  return mergeHistory([...publishItems, ...receiveItems])
}

export function actionTopics(fullType, connectedActions = [], topics = []) {
  if (!fullType?.includes('/action/')) return []
  const actionNames = connectedActions
    .map((item) => item.action_name)
    .filter(Boolean)
  return topics.filter((topic) =>
    actionNames.some((name) =>
      topic.name === `${name}/_action/feedback` || topic.name === `${name}/_action/status`,
    ),
  )
}

export function historyKey(item, type) {
  if (type === 'topic') {
    return `${item.direction}-${item.published_at ?? item.received_at}-${item.topic_name}-${item.topic_type}-${item.error_type ?? ''}`
  }
  return type === 'service'
    ? `${item.called_at}-${item.service_name}-${item.service_type}-${item.error_type ?? ''}`
    : `${item.sent_at}-${item.action_name}-${item.action_type}-${item.error_type ?? ''}`
}

export function historyLabel(item, type) {
  const timestamp = type === 'service'
    ? item.called_at
    : type === 'topic'
    ? item.published_at ?? item.received_at
    : item.sent_at
  const status = historyStatus(item)
  const elapsed = Math.round(item.elapsed_ms ?? 0)
  if (type === 'topic') {
    const direction = item.direction === 'topic_subscribe' ? 'subscribe' : 'publish'
    const sent = item.sent_to_topic === false ? 'sent_to_topic=false' : item.published ? 'sent_to_topic=true' : ''
    return `${formatTime(timestamp)} · ${direction} · ${status}${sent ? ` · ${sent}` : ''}`
  }
  const sent = item.sent_to_server === false ? 'sent_to_server=false' : 'sent_to_server=true'
  return `${formatTime(timestamp)} · ${status} · ${elapsed}ms · ${sent}`
}

export function historyStatus(item) {
  if (item.success) return 'success'
  if (item.error_type) return item.error_type
  if (item.accepted === false) return 'rejected'
  if (item.error) return 'failed'
  if (item.direction === 'topic_subscribe') return 'received'
  if (item.published) return 'published'
  return 'unknown'
}

export function formatTime(timestamp) {
  if (!timestamp) return '-'
  const millis = timestamp > 1000000000000 ? timestamp : timestamp * 1000
  return new Date(millis).toLocaleTimeString()
}

export function matchesWorkspaceFilter(item, filter) {
  if (filter === 'all') return true
  if (filter === 'messages') return item.kind === 'message'
  if (filter === 'services') return item.kind === 'service'
  if (filter === 'actions') return item.kind === 'action'
  if (filter === 'packages') return item.kind === 'package'
  if (filter === 'callable_services') return item.kind === 'service' && item.callable
  if (filter === 'callable_actions') return item.kind === 'action' && item.callable
  if (filter === 'importable') return item.importAvailable
  if (filter === 'rebuild_required') return item.rebuildRequired
  if (filter === 'errors') return Boolean(item.error)
  return true
}

export function relatedWorkspaceItems(item, items) {
  if (!item) return []
  if (item.kind === 'package') {
    return items.filter((candidate) =>
      candidate.packageName === item.packageName
      && ['service', 'action', 'callable_service', 'callable_action'].includes(candidate.kind)
      && candidate.id !== item.id,
    )
  }
  if (item.kind === 'service' || item.kind === 'callable_service') {
    return items.filter((candidate) =>
      candidate.fullType === item.fullType
      && ['service', 'callable_service'].includes(candidate.kind)
      && candidate.id !== item.id,
    )
  }
  if (item.kind === 'action' || item.kind === 'callable_action') {
    return items.filter((candidate) =>
      candidate.fullType === item.fullType
      && ['action', 'callable_action'].includes(candidate.kind)
      && candidate.id !== item.id,
    )
  }
  return []
}

export function packageFromType(type = '') {
  return type.split('/')[0] || null
}

export function sourceLabel(source) {
  if (source === 'single_upload') return '파일 등록'
  if (source === 'manual_type') return '기존 빌드 타입 등록'
  if (source === 'manual_definition') return '인터페이스 직접 작성'
  if (source === 'uploaded_package') return 'package 등록'
  if (source === 'graph') return 'graph'
  return source
}
