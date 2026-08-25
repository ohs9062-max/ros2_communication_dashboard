export function groupByType(items, key) {
  return items.reduce((grouped, item) => {
    const type = item[key]
    if (!type) return grouped
    grouped[type] = [...(grouped[type] ?? []), item]
    return grouped
  }, {})
}

export function uniqueStrings(items = []) {
  return Array.from(new Set(items.filter(Boolean)))
}

export function mergeByNameAndType(items = [], nameKey, typeKey) {
  const byKey = new Map()
  items.forEach((item) => {
    const key = `${item?.domain_id ?? ''}|${item?.[nameKey] ?? ''}|${item?.[typeKey] ?? ''}`
    if (!item || (!item?.[nameKey] && !item?.[typeKey])) return
    byKey.set(key, { ...(byKey.get(key) ?? {}), ...item })
  })
  return Array.from(byKey.values())
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

export function actionTopics(fullType, connectedActions = [], topics = []) {
  if (!fullType?.includes('/action/')) return []
  const actionNames = connectedActions
    .filter((item) => item.action_name)
  return topics.filter((topic) =>
    actionNames.some((action) =>
      action.domain_id === topic.domain_id && (
        topic.name === `${action.action_name}/_action/feedback` || topic.name === `${action.action_name}/_action/status`
      ),
    ),
  )
}

export function packageFromType(type = '') {
  return type.split('/')[0] || null
}
