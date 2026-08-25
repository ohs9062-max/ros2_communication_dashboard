export function historyTimestamp(item, kind) {
  if (kind === 'topic') return item?.received_at
  if (kind === 'service') return item?.called_at
  return item?.result_received_at ?? item?.received_at ?? item?.sent_at
}

export function historyStatus(item, kind) {
  if (kind === 'topic') return '수신'
  if (kind === 'service') {
    if (item?.success === true) return '성공'
    if (item?.error_type === 'timeout') return '시간 초과'
    return '실패'
  }
  if (item?.event_type === 'feedback') return 'Feedback'
  if (item?.event_type === 'result' && item?.error) return 'Result 실패'
  if (item?.accepted === false) return 'Goal 거절'
  const status = actionStatus(item)
  if (status) return actionStatusLabel(status)
  return item?.success === true ? '성공' : '실패'
}

export function historyPayload(item, kind) {
  if (kind === 'topic') {
    return item?.payload ?? null
  }
  if (kind === 'service') {
    return {
      request: item?.request ?? null,
      response: item?.response ?? null,
      success: item?.success === true,
      sent_to_server: item?.sent_to_server === true,
      duration_ms: item?.elapsed_ms ?? null,
      timeout_sec: item?.timeout_sec ?? null,
      error_type: item?.error_type ?? null,
      error: item?.error ?? null,
    }
  }
  return {
    source: item?.execution_source ?? 'interface_lab',
    event_type: item?.event_type ?? 'goal_execution',
    goal_id: item?.goal_id ?? null,
    goal: item?.goal ?? null,
    accepted: item?.accepted ?? null,
    feedback: Array.isArray(item?.feedback) ? item.feedback : [],
    result: item?.result ?? null,
    status: actionStatus(item),
    success: item?.success === true,
    duration_ms: item?.elapsed_ms ?? null,
    error_type: item?.error_type ?? null,
    error: item?.error ?? null,
  }
}

export function buildHistoryRows(items, kind) {
  return items.map((item, index) => {
    const timestamp = historyTimestamp(item, kind)
    return {
      key: `${timestamp ?? 'unknown'}-${index}`,
      timestamp,
      status: historyStatus(item, kind),
      formattedPayload: JSON.stringify(historyPayload(item, kind), null, 2),
    }
  })
}

export function formatHistoryTime(value) {
  if (!value) return '-'
  const date = new Date(Number(value) * 1000)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

function actionStatus(item) {
  return item?.status_label ?? item?.result_status ?? item?.error_type ?? null
}

function actionStatusLabel(status) {
  return {
    accepted: '수락됨',
    succeeded: '성공',
    canceled: '취소됨',
    aborted: '중단됨',
    canceling: '취소 중',
    executing: '실행 중',
    feedback: 'Feedback',
    success: '성공',
  }[status] ?? status
}
