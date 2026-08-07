export function normalizeWorkspaceKind(kind) {
  if (kind === 'callable_service') return 'service'
  if (kind === 'callable_action') return 'action'
  return kind
}

export function firstType(value) {
  if (Array.isArray(value)) return value[0]
  return value
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

export function sourceLabel(source) {
  if (source === 'single_upload') return '파일 등록'
  if (source === 'manual_type') return '기존 빌드 타입 등록'
  if (source === 'manual_definition') return '인터페이스 직접 작성'
  if (source === 'uploaded_package') return 'package 등록'
  if (source === 'graph') return 'graph'
  return source
}
