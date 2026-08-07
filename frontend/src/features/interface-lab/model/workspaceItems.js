import { topicHasType } from '../../../utils/interfaceTopics.js'
import { schemaFields } from './schemaValues.js'
import {
  actionTopics,
  groupByType,
  hasMeaningfulParsed,
  mergeByNameAndType,
  packageFromType,
  registryFullType,
  uniqueStrings,
} from './workspaceDataUtils.js'
import {
  filterHistoryByType,
  mergeHistory,
  topicHistoryForType,
} from './executionHistory.js'
import {
  matchesWorkspaceFilter,
  normalizeWorkspaceKind,
} from './workspacePresentation.js'
import {
  callableActionItem,
  callableServiceItem,
  mergeGraphActionEntries,
  mergeGraphServiceEntries,
} from './workspaceGraphItems.js'

export {
  callableActionItem,
  callableServiceItem,
  mergeGraphActionEntries,
  mergeGraphServiceEntries,
} from './workspaceGraphItems.js'

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
    qos: { mode: 'adaptive' },
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
    qos: { mode: 'adaptive' },
    topicStates: kind === 'message'
      ? receiveTopics.filter((state) => state.topic_type === item.type)
      : [],
  }
}

