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
  return Object.fromEntries(
    schema.filter((field) => field.name).map((field) => [field.name, defaultFieldValue(field.type)]),
  )
}

export function normalizeNumericValues(values, schema = []) {
  const numericFields = new Set(
    schema.filter((field) => field.name && isNumericType(field.type)).map((field) => field.name),
  )
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      numericFields.has(name) && value !== '' ? Number(value) : value,
    ]),
  )
}

export function defaultFieldValue(type = '') {
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

export function registryRowKey(item) {
  return `${item.source ?? 'single'}-${item.full_type ?? item.file_name}-${item.file_kind ?? ''}`
}

export function deletedRegistryItemsFor(kind, items = []) {
  return items.filter((item) => item.file_kind === kind)
}
