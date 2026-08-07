import { topicHasType } from '../../../utils/interfaceTopics.js'
import { filterHistoryByType, topicHistoryForType } from './executionHistory.js'
import {
  actionTopics,
  packageFromType,
  registryFullType,
} from './workspaceDataUtils.js'

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
