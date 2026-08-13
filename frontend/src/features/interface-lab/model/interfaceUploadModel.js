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
  return `${service.service_name || service.file_name}|${service.service_type}`
}

export function actionKey(action) {
  return `${action.action_name || action.file_name}|${action.action_type}`
}

export function messageKey(message) {
  return `${message.message_type ?? message.full_type ?? message.file_name}|${message.source ?? ''}`
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
