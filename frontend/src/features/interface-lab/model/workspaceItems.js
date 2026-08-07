import { topicHasType } from '../../../utils/interfaceTopics.js'
import { schemaFields } from './schemaValues.js'
import {
  groupByType,
  hasMeaningfulParsed,
  mergeByNameAndType,
  uniqueStrings,
} from './workspaceDataUtils.js'
import {
  mergeHistory,
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
import { packageItems, registryItem } from './workspaceSourceItems.js'

export {
  callableActionItem,
  callableServiceItem,
  mergeGraphActionEntries,
  mergeGraphServiceEntries,
} from './workspaceGraphItems.js'
export { packageItems, packageTypeItem, registryItem } from './workspaceSourceItems.js'

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
