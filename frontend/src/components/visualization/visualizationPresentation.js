export function kindLabel(kind) {
  if (kind === 'node') return 'Node'
  if (kind === 'topic') return 'Topic'
  if (kind === 'service') return 'Service'
  return 'Action'
}

export function statusTone(status) {
  const value = String(status || '').toLowerCase()
  if (['active', 'success', 'succeeded', 'normal_hz'].includes(value)) return 'good'
  if (['warning', 'stale', 'waiting_publisher', 'waiting_server', 'pending', 'canceling', 'canceled', 'low_hz'].includes(value)) return 'warn'
  if (['error', 'critical', 'disconnected', 'failed', 'aborted', 'timeout', 'never_received', 'zero_hz'].includes(value)) return 'bad'
  if (['accepted', 'executing', 'result_waiting'].includes(value)) return 'info'
  return 'muted'
}
