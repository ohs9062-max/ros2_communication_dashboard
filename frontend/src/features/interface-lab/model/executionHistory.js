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

