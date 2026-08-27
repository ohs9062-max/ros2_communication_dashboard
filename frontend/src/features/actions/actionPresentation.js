const RUNNING_GOAL_STATUSES = new Set(['accepted', 'executing', 'canceling'])
const FAILED_GOAL_STATUSES = new Set([
  'aborted',
  'canceled',
  'goal_rejected',
  'goal_send_failed',
  'goal_accept_timeout',
  'result_timeout',
  'result_receive_failed',
])
const FAILED_RESULT_STATES = new Set([
  'aborted',
  'failed',
  'goal_rejected',
  'goal_accept_timeout',
  'goal_send_failed',
  'result_canceled',
  'result_error',
  'result_receive_failed',
  'result_timeout',
  'timeout',
  'validation_error',
])

export function actionPresentation(action) {
  const runtime = action.runtime ?? {}
  const summary = action.last_goal_summary ?? null
  const goalStatus = actionGoalStatus(action)
  const feedback = feedbackDisplay(action)
  const result = resultDisplay(action)
  const observedGoalCount = Number(runtime.observed_goal_count ?? 0)
  const feedbackPreview = actionFeedbackPreview(action)

  return {
    executionTimeMs: actionExecutionTimeMs(action),
    feedback,
    feedbackPreview,
    feedbackReceived: feedbackPreview != null,
    feedbackWaiting: RUNNING_GOAL_STATUSES.has(goalStatus) && feedbackPreview == null,
    goalExecuting: goalStatus === 'executing',
    goalStatus,
    goalUnobserved: goalStatus === 'goal_unobserved',
    isFailedOrCanceled:
      FAILED_GOAL_STATUSES.has(goalStatus) ||
      FAILED_RESULT_STATES.has(result.value),
    isRunning: RUNNING_GOAL_STATUSES.has(goalStatus),
    isSucceeded:
      result.value === 'success' ||
      (goalStatus === 'succeeded' && !FAILED_RESULT_STATES.has(result.value)),
    lastFeedbackAt: summary?.last_feedback_at ?? runtime.last_feedback_at ?? null,
    lastGoalAt: actionLastGoalAt(action),
    lastResponseAt: actionLastResponseAt(action),
    observedGoalCount: Number.isFinite(observedGoalCount) ? observedGoalCount : 0,
    result,
    resultPreview: actionResultPreview(action),
  }
}

export function actionGoalStatus(action) {
  const status = normalizeStatus(
    action.last_goal_summary?.last_goal_status ??
    action.runtime?.last_goal_status ??
    action.last_goal_status,
  )
  return !status || status === 'unknown' ? 'goal_unobserved' : status
}

export function actionExecutionTimeMs(action) {
  return action.last_goal_summary?.execution_time_ms ?? action.runtime?.elapsed_time_ms
}

export function actionLastGoalAt(action) {
  return action.last_goal_summary?.last_goal_sent_at ?? action.runtime?.last_status_at ?? null
}

export function actionFeedbackPreview(action) {
  return action.last_goal_summary?.last_feedback_preview ?? action.runtime?.feedback_preview
}

export function actionResultPreview(action) {
  return action.last_goal_summary?.last_result_preview ?? action.runtime?.result_preview
}

export function actionLastResponseAt(action) {
  const summary = action.last_goal_summary ?? {}
  const runtime = action.runtime ?? {}
  const feedbackAt = summary.last_feedback_at ?? runtime.last_feedback_at
  const resultAt = summary.last_result_at
    ?? ((runtime.result_preview || runtime.result_error || runtime.result_status)
      ? runtime.last_status_at
      : null)
  const timestamps = [feedbackAt, resultAt]
    .map(Number)
    .filter(Number.isFinite)

  return timestamps.length ? Math.max(...timestamps) : null
}

export function matchesActionStatusFilter(action, statusFilter) {
  if (statusFilter === 'all') return true
  if (statusFilter === 'running') return isRunningAction(action)
  if (statusFilter === 'issues') return isIssueAction(action)
  return true
}

export function isRunningAction(action) {
  if (action?.graph_present === false) return false
  return (
    normalizeStatus(action?.status) === 'active' &&
    Number(action?.server_endpoint_count ?? action?.server_count ?? 0) > 0
  )
}

export function isIssueAction(action) {
  return !isRunningAction(action) || hasIncompatibleActionQos(action?.qos)
}

function hasIncompatibleActionQos(qos) {
  return Object.values(qos ?? {}).some(
    (channel) => channel && typeof channel === 'object' && (
      channel.qos_status === 'incompatible' ||
      channel.graph_qos_status === 'incompatible'
    ),
  )
}

export function actionSearchValues(action) {
  const presentation = actionPresentation(action)
  return [
    action.name,
    action.type,
    action.status,
    action.reason,
    presentation.goalStatus,
    presentation.result.value,
    action.last_goal_summary?.last_error,
    action.runtime?.result_error,
  ]
}

export function feedbackDisplay(action) {
  const summary = action.last_goal_summary
  if (summary?.last_feedback_preview) {
    return resultState('feedback_received', '수신됨', 9)
  }
  if (summary?.error_type === 'validation_error') {
    return resultState('validation_error', '검증 실패', 1)
  }
  const runtime = action.runtime ?? {}
  const lastGoalStatus = String(runtime.last_goal_status || '').toLowerCase()

  if (runtime.feedback_error) {
    return resultState('feedback_error', '수신 오류', 1)
  }
  if (runtime.feedback_preview) {
    return resultState('feedback_received', '수신됨', 8)
  }
  if (['executing', 'accepted', 'canceling'].includes(lastGoalStatus)) {
    return resultState('feedback_waiting', '대기 중', 5)
  }
  if ((runtime.observed_goal_count ?? 0) === 0) {
    return resultState('goal_unobserved', 'Goal 미관찰', 0)
  }
  if (action.feedback_supported === false) {
    return resultState('feedback_unsupported', '미지원', 0)
  }
  return resultState('feedback_none', '수신 없음', 0)
}

export function resultDisplay(action) {
  const summary = action.last_goal_summary
  const summaryStatus = String(summary?.last_goal_status || '').toLowerCase()
  if (summaryStatus === 'aborted') {
    return resultState('aborted', '실패 종료', 1)
  }
  if (summaryStatus === 'canceled') {
    return resultState('result_canceled', '취소됨', 4)
  }
  if (summaryStatus === 'result_timeout') {
    return resultState('result_timeout', 'Result Timeout', 2)
  }
  if (summaryStatus === 'result_receive_failed') {
    return resultState('result_receive_failed', 'Result 수신 실패', 1)
  }
  if (summaryStatus === 'goal_rejected') {
    return resultState('goal_rejected', 'Goal 거절', 3)
  }
  if (['goal_send_failed', 'goal_accept_timeout'].includes(summaryStatus)) {
    return resultState(summaryStatus, 'Goal 전송 실패', 1)
  }
  if (summary?.last_result_preview) {
    return resultState(
      summary.success ? 'success' : 'failed',
      summary.success ? '성공' : '실패',
      9,
    )
  }
  if (summary?.error_type === 'validation_error') {
    return resultState('validation_error', '검증 실패', 1)
  }

  const runtime = action.runtime ?? {}
  const resultStatus = String(runtime.result_status || '').toLowerCase()
  const lastGoalStatus = String(runtime.last_goal_status || '').toLowerCase()
  if (resultStatus) {
    const states = {
      success: resultState('success', '성공', 8),
      succeeded: resultState('success', '성공', 8),
      aborted: resultState('aborted', '실패 종료', 1),
      canceled: resultState('result_canceled', '취소됨', 4),
      timeout: resultState('timeout', 'Timeout', 2),
      error: resultState('result_error', '결과 조회 오류', 2),
      unavailable: resultState('result_none', '결과 없음', 0),
    }
    if (states[resultStatus]) return states[resultStatus]
  }
  if (runtime.result_error) {
    return resultState('result_error', '결과 조회 오류', 2)
  }
  if (lastGoalStatus === 'executing') {
    return resultState('result_waiting', '결과 대기', 6)
  }
  if (lastGoalStatus === 'accepted') {
    return resultState('accepted', 'Goal 수락', 5)
  }
  if (lastGoalStatus === 'canceling') {
    return resultState('result_canceled', '취소 중', 4)
  }
  if ((runtime.observed_goal_count ?? 0) === 0) {
    return resultState('goal_unobserved', 'Goal 미관찰', 0)
  }
  return resultState('result_none', '결과 없음', 0)
}

function resultState(value, label, sortValue) {
  return { label, sortValue, value }
}

export function resultLabel(action) {
  return action.result_policy === 'observed_goal_only' ? '관찰된 Goal만 조회' : '지원'
}

export function resultPolicyLabel(policy) {
  return policy === 'observed_goal_only' ? '관찰된 Goal만 조회' : policy ?? '-'
}

export function goalStatusLabel(status) {
  const labels = {
    accepted: 'Goal 수락', executing: '실행 중', canceling: '취소 중',
    succeeded: '성공', canceled: '취소됨', aborted: '실패 종료',
    goal_unobserved: 'Goal 미관찰', validation_error: '검증 실패',
    goal_rejected: 'Goal 거절', goal_send_failed: 'Goal 전송 실패',
    goal_accept_timeout: 'Goal 수락 Timeout', result_timeout: 'Result Timeout',
    result_receive_failed: 'Result 수신 실패',
  }
  return labels[String(status || '').toLowerCase()] ?? status ?? '-'
}

export function resultStatusLabel(status) {
  const labels = {
    success: '성공', succeeded: '성공', aborted: '실패 종료', canceled: '취소됨',
    timeout: '시간 초과', error: '결과 조회 오류', unavailable: '결과 없음',
    failed: '실패', goal_unobserved: 'Goal 미관찰', result_canceled: '취소됨',
    result_error: '결과 조회 오류', result_none: '결과 없음', validation_error: '검증 실패',
    pending: '결과 대기', goal_rejected: 'Goal 거절',
    goal_send_failed: 'Goal 전송 실패', goal_accept_timeout: 'Goal 수락 Timeout',
    result_timeout: 'Result Timeout', result_receive_failed: 'Result 수신 실패',
  }
  return labels[String(status || '').toLowerCase()] ?? status ?? '-'
}

export function actionStatusTone(status) {
  const value = String(status || '').toLowerCase()
  if (['active', 'success', 'succeeded'].includes(value)) return 'good'
  if ([
    'warning', 'waiting_server', 'pending', 'canceling', 'canceled',
    'goal_rejected', 'result_timeout', 'cancel_failed',
  ].includes(value)) return 'warn'
  if ([
    'error', 'critical', 'disconnected', 'failed', 'aborted', 'timeout',
    'goal_send_failed', 'goal_accept_timeout', 'result_receive_failed',
    'result_error', 'validation_error',
  ].includes(value)) return 'bad'
  if (['accepted', 'executing'].includes(value)) return 'info'
  return 'muted'
}

function normalizeStatus(status) {
  return String(status ?? '').trim().toLowerCase()
}
