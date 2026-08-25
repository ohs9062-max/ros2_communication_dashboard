import {
  defaultValue,
  defaultValues,
} from './schemaValues.js'

export {
  isArrayType,
  isComplexType,
  isCustomType,
  isNumericType,
  normalizeNumericValues,
} from './schemaValues.js'

export function interfaceCounts(interfaces = {}) {
  return {
    msg: interfaces.msg?.length ?? 0,
    srv: interfaces.srv?.length ?? 0,
    action: interfaces.action?.length ?? 0,
  }
}

export function packageStatusLabel(item) {
  if (item.import_available) return 'import됨'
  if (item.last_build_status === 'failed') return '빌드 실패'
  if (item.last_build_status === 'success') return 'import 안됨'
  return item.rebuild_required ? 'build 필요' : '업로드됨'
}

export function serviceKey(service) {
  return `${service.domain_id ?? ''}|${service.service_name || service.file_name}|${service.service_type}`
}

export function actionKey(action) {
  return `${action.domain_id ?? ''}|${action.action_name || action.file_name}|${action.action_type}`
}

export function messageKey(message) {
  return `${message.message_type ?? message.full_type ?? message.file_name}|${message.source ?? ''}`
}

export function domainIdFromResource(resource) {
  const resourceKey = String(resource?.resource_key ?? resource?.resourceKey ?? '')
  const keyDomain = /^([0-9]+):/.exec(resourceKey)?.[1]
  const value = keyDomain ?? resource?.domain_id ?? resource?.domainId
  const domainId = Number(value)
  return Number.isInteger(domainId) && domainId >= 0 && domainId <= 232 ? domainId : null
}

export function executionCandidateForTarget(item, target, nameField, typeField) {
  const matches = (candidate) => (
    (target?.resourceKey && candidate?.resource_key === target.resourceKey)
    || (candidate?.domain_id === target?.domainId
      && candidate?.[nameField] === target?.name
      && candidate?.[typeField] === target?.fullType)
  )
  if (matches(item)) return item
  if (domainIdFromResource(item) !== null) return null
  const candidates = item?.resource_candidates?.length ? item.resource_candidates : []
  return candidates.find(matches) ?? null
}

export function executionResourceOptions(items = [], nameField, typeField) {
  const resources = new Map()
  for (const item of items) {
    const sourceCandidates = [item, ...(item?.resource_candidates ?? [])]
    for (const candidate of sourceCandidates) {
      const name = String(candidate?.[nameField] || '')
      const resourceType = String(candidate?.[typeField] || '')
      const domainId = domainIdFromResource(candidate)
      const resourceKey = String(candidate?.resource_key || '')
      const graphPresent = candidate?.server_available === true
        || Number(candidate?.server_count || 0) > 0
      if (!name || !resourceType || domainId === null || !resourceKey || !graphPresent) continue
      const candidateKey = `${resourceKey}\u0000${resourceType}`
      const current = resources.get(candidateKey)
      if (!current || (candidate.callable === true && current.callable !== true)) {
        resources.set(candidateKey, { ...item, ...candidate })
      }
    }
  }

  const options = [...resources.values()].sort((left, right) => (
    String(left[nameField]).localeCompare(String(right[nameField]))
    || String(left[typeField]).localeCompare(String(right[typeField]))
    || domainIdFromResource(left) - domainIdFromResource(right)
  ))
  const candidatesByResource = new Map()
  for (const option of options) {
    const key = `${option[nameField]}\u0000${option[typeField]}`
    candidatesByResource.set(key, [...(candidatesByResource.get(key) ?? []), option])
  }
  return options.map((option) => ({
    ...option,
    resource_candidates: candidatesByResource.get(
      `${option[nameField]}\u0000${option[typeField]}`,
    ),
  }))
}

export function topicStatusLabel(message) {
  return message.import_available ? 'Publish 가능' : 'Publish 불가'
}

export function topicGraphStatusLabel(message) {
  return message.graph_topics?.length ? 'Graph Topic 있음' : 'Graph Topic 없음'
}

export function serviceStatusLabel(service) {
  if (service.callable) return '호출 가능'
  if (!service.import_available) return 'import 안됨'
  if (!service.server_available) return '서버 없음'
  return '호출 불가'
}

export function actionStatusLabel(action) {
  if (action.callable) return '호출 가능'
  if (!action.import_available) return 'import 안됨'
  if (!action.server_available) return '서버 없음'
  return '호출 불가'
}

export function defaultRequestValues(schema = []) {
  return defaultValues(schema)
}

export function defaultFieldValue(type = '') {
  return defaultValue(type)
}

export function registryRowKey(item) {
  return `${item.source ?? 'single'}-${item.full_type ?? item.file_name}-${item.file_kind ?? ''}`
}

export function deletedRegistryItemsFor(kind, items = []) {
  return items.filter((item) => item.file_kind === kind)
}
