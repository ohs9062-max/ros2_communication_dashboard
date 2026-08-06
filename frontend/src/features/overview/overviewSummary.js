export function resourceTotal(summary) {
  return summary.green + summary.yellow + summary.red
}

export function formatPercent(value, summary) {
  const total = resourceTotal(summary)
  if (!total) {
    return '0%'
  }
  return `${Math.round((value / total) * 100)}%`
}

export function formatChartValue(value, summary, valueMode) {
  if (valueMode === 'count') {
    return value
  }

  return formatPercent(value, summary)
}

export function resourceStatus(summary) {
  if (summary.error) {
    return 'error'
  }
  if (summary.warning) {
    return 'warning'
  }
  return 'active'
}

export function getAlertSummary(meta, alerts) {
  const warning = meta.warning_count ?? countAlertsByLevel(alerts, 'warning')
  const error = meta.error_count ?? countAlertsByLevel(alerts, 'error')
  const critical = meta.critical_count ?? countAlertsByLevel(alerts, 'critical')
  const total = meta.active_count ?? alerts.length

  return {
    total,
    warning,
    error,
    critical,
  }
}

export function applyAlertsToResourceSummary(
  originalSummary,
  resources,
  alerts,
  sources,
) {
  const summary = { ...originalSummary }
  const severityByName = new Map()

  for (const alert of alerts) {
    if (!sources.has(alert.source)) {
      continue
    }
    const name = String(alert.name ?? '')
    const severity = alertSeverity(alert.level)
    if (!name || !severity) {
      continue
    }
    if (
      severity === 'error' ||
      severityByName.get(name) !== 'error'
    ) {
      severityByName.set(name, severity)
    }
  }

  for (const resource of resources) {
    const names = [resource.name, resource.full_name]
      .map((name) => String(name ?? ''))
      .filter(Boolean)
    const alertBucket = names.reduce((bucket, name) => {
      const severity = severityByName.get(name)
      if (severity === 'error') return 'error'
      if (severity === 'warning' && bucket !== 'error') return 'warning'
      return bucket
    }, null)
    if (!alertBucket) {
      continue
    }

    const currentBucket = resourceSummaryBucket(resource.status)
    if (
      currentBucket === alertBucket ||
      summaryBucketRank(alertBucket) <= summaryBucketRank(currentBucket)
    ) {
      continue
    }
    if ((summary[currentBucket] ?? 0) > 0) {
      summary[currentBucket] -= 1
    }
    summary[alertBucket] = (summary[alertBucket] ?? 0) + 1
  }

  return summary
}

export function alertSeverity(level) {
  const value = String(level ?? '').toLowerCase()
  if (value === 'error' || value === 'critical') return 'error'
  if (value === 'warning') return 'warning'
  return null
}

export function resourceSummaryBucket(status) {
  const value = String(status ?? 'unknown').toLowerCase()
  if (value === 'active') return 'active'
  if (
    ['warning', 'stale', 'no_subscriber', 'waiting_publisher', 'waiting_server']
      .includes(value)
  ) {
    return 'warning'
  }
  if (['error', 'critical', 'disconnected'].includes(value)) return 'error'
  return 'inactive'
}

export function summaryBucketRank(bucket) {
  if (bucket === 'error' || bucket === 'inactive') return 3
  if (bucket === 'warning') return 2
  return 1
}

export function getNodeSummary(nodes, meta = {}) {
  const total = meta.count ?? nodes.length
  const active = meta.active_count ?? countNodesByStatus(nodes, 'active')
  const warning = meta.warning_count ?? countNodesByStatus(nodes, 'stale')
  const error = meta.error_count ?? (
    countNodesByStatus(nodes, 'disconnected')
  )
  const inactive = Math.max(total - active - warning - error, 0)
  const pubSub =
    (meta.publisher_count ?? sumNodeCount(nodes, 'publisher_count')) +
    (meta.subscriber_count ?? sumNodeCount(nodes, 'subscriber_count'))

  return {
    total,
    active,
    warning,
    error,
    inactive,
    pubSub,
  }
}

export function countNodesByStatus(nodes, expectedStatus) {
  return nodes.filter((node) => node.status === expectedStatus).length
}

export function sumNodeCount(nodes, key) {
  return nodes.reduce((sum, node) => sum + (node[key] ?? 0), 0)
}

export function countAlertsByLevel(alerts, expectedLevel) {
  return alerts.filter(
    (alert) => String(alert.level || '').toLowerCase() === expectedLevel,
  ).length
}
