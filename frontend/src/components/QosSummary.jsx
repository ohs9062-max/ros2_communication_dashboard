const ACTION_CHANNELS = [
  ['goal', 'Goal Service'],
  ['result', 'Result Service'],
  ['cancel', 'Cancel Service'],
  ['feedback', 'Feedback Topic'],
  ['status', 'Status Topic'],
]

export function QosStatusBadge({ qos }) {
  const status = qosDisplayStatus(qos)
  const display = ({
    compatible: ['QoS 호환', 'good'],
    incompatible: ['QoS 불일치', 'bad'],
    partial: ['QoS 일부 호환', 'warn'],
    observed: ['QoS 발견됨', 'observed'],
    unknown: ['QoS 확인 불가', 'muted'],
  })[status]
  return <span className={`qos-list-badge ${display[1]}`}>{display[0]}</span>
}

export function QosSummaryNotice({ kind, qos }) {
  const actionStates = isActionQos(qos)
    ? ACTION_CHANNELS.map(([key, label]) => ({ key, label, qos: qos[key] ?? {} }))
    : null
  const status = qosDisplayStatus(qos)
  if (status === 'compatible') return null

  const tone = status === 'incompatible'
    ? 'bad'
    : status === 'partial' ? 'warn' : status === 'observed' ? 'observed' : 'muted'
  const lines = actionStates
    ? actionNoticeLines(actionStates, status)
    : [resourceNotice(kind, qos, status)]

  return (
    <div className={`qos-summary-notice ${tone}`}>
      <div>
        {lines.map((line) => <p key={line}>{line}</p>)}
        {status === 'incompatible' && mismatchSummary(qos) && (
          <small>{mismatchSummary(qos)}</small>
        )}
      </div>
    </div>
  )
}

function qosDisplayStatus(qos) {
  if (isActionQos(qos)) {
    const states = ACTION_CHANNELS.map(([key]) => stateOf(qos[key]))
    if (states.includes('incompatible')) return 'incompatible'
    if (states.includes('partial')) return 'partial'
    if (states.length && states.every((state) => state === 'compatible')) return 'compatible'
    if (
      states.includes('observed')
      && states.every((state) => ['compatible', 'observed'].includes(state))
    ) return 'observed'
    return 'unknown'
  }
  return stateOf(qos)
}

function stateOf(qos) {
  if (!qos) return 'unknown'
  if (qos.qos_status === 'incompatible' || qos.graph_qos_status === 'incompatible') {
    return 'incompatible'
  }
  if (qos.qos_status === 'partial' || qos.graph_qos_status === 'partial') return 'partial'
  if (qos.qos_status === 'compatible') return 'compatible'
  if (qos.qos_status === 'observed') return 'observed'
  return 'unknown'
}

function isActionQos(qos) {
  return Boolean(qos && ACTION_CHANNELS.some(([key]) => qos[key] && typeof qos[key] === 'object'))
}

function actionNoticeLines(states, aggregate) {
  const incompatible = states.filter(({ qos }) => stateOf(qos) === 'incompatible')
  if (incompatible.length) {
    return incompatible.map(({ label }) => `Action ${label}의 QoS가 호환되지 않습니다.`)
  }
  const partial = states.filter(({ qos }) => stateOf(qos) === 'partial')
  if (partial.length) {
    return partial.map(({ label }) => `Action ${label}의 일부 endpoint만 QoS가 호환됩니다.`)
  }
  if (aggregate === 'unknown') return ['상대 endpoint QoS를 확인하지 못한 Action 채널이 있습니다.']
  if (aggregate === 'observed') return ['DDS/Graph에서 Action endpoint QoS를 발견했습니다. 호환성은 실제 통신 QoS 적용 시 판정됩니다.']
  return []
}

function resourceNotice(kind, qos, status) {
  if (status === 'partial') return '일부 endpoint만 QoS가 호환됩니다.'
  if (status === 'observed') return 'DDS/Graph에서 상대 endpoint QoS를 발견했습니다. 호환성은 실제 통신 QoS 적용 시 판정됩니다.'
  if (status === 'unknown') return '상대 endpoint QoS를 확인하지 못했습니다.'
  if (kind === 'topic') {
    const pairs = qos?.endpoint_pair_count
    const mismatches = qos?.incompatible_endpoint_pair_count
    const count = Number.isInteger(pairs) && Number.isInteger(mismatches)
      ? ` (${mismatches}/${pairs} endpoint 조합)`
      : ''
    return `일부 Topic endpoint의 QoS가 호환되지 않습니다.${count}`
  }
  return 'QoS 불일치가 감지되었습니다.'
}

function mismatchSummary(qos) {
  if (isActionQos(qos)) {
    return ACTION_CHANNELS.flatMap(([key, label]) => {
      const policies = qos[key]?.mismatch_policies ?? []
      return policies.length ? [`${label}: ${policies.join(', ')}`] : []
    }).join(' · ')
  }
  const policies = qos?.mismatch_policies ?? []
  return policies.length ? `불일치 정책: ${policies.join(', ')}` : ''
}
