const ISSUE_SERVICE_STATUSES = new Set([
  'disconnected',
  'error',
  'failed',
  'timeout',
  'waiting_server',
])

export function servicePresentation(service) {
  const summary = service.last_call_summary ?? null
  const effectiveStatus = serviceEffectiveStatus(service)
  const callStatus = serviceCallStatus(service)

  return {
    callError: summary?.last_error ?? service.last_error ?? null,
    callLabel: serviceCallStatusLabel(callStatus, summary),
    callStatus,
    callTone: serviceStatusTone(callStatus),
    clientEndpointCount: service.client_endpoint_count ?? service.client_count ?? 0,
    clientNodeCount: service.client_node_count ?? service.client_count ?? 0,
    effectiveStatus,
    hasCallHistory: summary != null,
    isIssue: ISSUE_SERVICE_STATUSES.has(effectiveStatus),
    isWaiting: effectiveStatus === 'waiting_server',
    lastCalledAt: summary?.last_called_at ?? service.last_called_at ?? null,
    requestPreview: summary?.last_request_preview ?? service.last_request_preview ?? null,
    responsePreview: summary?.last_response_preview ?? service.last_response_preview ?? null,
    responseTimeMs: summary?.last_response_time_ms ?? service.last_response_time_ms ?? null,
    sentToServer: summary?.sent_to_server ?? null,
    serverEndpointCount: service.server_endpoint_count ?? service.server_count ?? 0,
    serverNodeCount: service.server_node_count ?? service.server_count ?? 0,
    serverStatus: normalizeStatus(service.status),
    serverStatusLabel: serviceServerStatusLabel(service.status),
    serverStatusTone: serviceStatusTone(service.status),
    statusLabel: serviceStatusLabel(service, effectiveStatus, callStatus),
    statusTone: serviceStatusTone(effectiveStatus),
    summary,
  }
}

export function serviceEffectiveStatus(service) {
  return normalizeStatus(service.effective_status ?? service.status)
}

export function serviceCallStatus(service) {
  return normalizeStatus(
    service.last_call_summary?.last_call_status ?? service.call_status ?? 'not_called',
  )
}

export function serviceStatusLabel(
  service,
  effectiveStatus = serviceEffectiveStatus(service),
  callStatus = serviceCallStatus(service),
) {
  if (effectiveStatus === 'timeout') return 'Timeout'
  if (effectiveStatus === 'failed') return '호출 실패'
  if (effectiveStatus === 'active' && callStatus === 'not_called') return '서버 있음'
  if (effectiveStatus === 'active') return '정상'
  return undefined
}

export function serviceServerStatusLabel(status) {
  const value = normalizeStatus(status)
  if (value === 'active') return '사용 가능'
  if (value === 'waiting_server') return '서버 대기'
  if (value === 'disconnected') return '연결 끊김'
  return status ?? '-'
}

export function serviceCallStatusLabel(status, summary = null) {
  if (!summary && (!status || status === 'not_called')) return '호출 이력 없음'
  if (status === 'success') return '정상'
  if (status === 'timeout') return 'Timeout'
  if (['failed', 'response_failed', 'service_call_error'].includes(status)) {
    return '호출 실패'
  }
  if (status === 'qos_preflight_incompatible') return 'QoS 불일치'
  if (status === 'validation_error') return '입력 검증 실패'
  return status || '-'
}

export function serviceStatusTone(status) {
  const value = normalizeStatus(status)
  if (['active', 'success', 'succeeded'].includes(value)) return 'good'
  if (['warning', 'waiting_server', 'pending', 'validation_error'].includes(value)) {
    return 'warn'
  }
  if (['error', 'critical', 'disconnected', 'failed', 'timeout', 'response_failed', 'service_call_error', 'qos_preflight_incompatible'].includes(value)) {
    return 'bad'
  }
  return 'muted'
}

export function serviceSearchValues(service) {
  const presentation = servicePresentation(service)
  return [
    service.name,
    service.type,
    service.category,
    presentation.serverStatus,
    presentation.effectiveStatus,
    presentation.callStatus,
    presentation.callError,
  ]
}

export function matchesServicePresentationFilter(service, filter) {
  if (filter === 'all') return true
  const presentation = servicePresentation(service)
  if (filter === 'issues') return presentation.isIssue
  if (filter === 'warning') {
    return ['waiting_server', 'warning'].includes(presentation.effectiveStatus)
  }
  if (filter === 'error') {
    return ['critical', 'disconnected', 'error', 'failed', 'timeout'].includes(
      presentation.effectiveStatus,
    )
  }
  if (filter === 'unsupported') return service.supported_type === false
  return presentation.effectiveStatus === filter
}

function normalizeStatus(status) {
  return String(status ?? 'unknown').trim().toLowerCase()
}
