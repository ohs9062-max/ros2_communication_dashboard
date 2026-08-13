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
    observed: ['QoS 발견', 'observed'],
    unknown: ['QoS 확인 불가', 'muted'],
  })[status]
  return <span className={`qos-list-badge ${display[1]}`}>{display[0]}</span>
}

export function QosSummaryNotice({ kind, qos }) {
  const actionStates = isActionQos(qos)
    ? ACTION_CHANNELS.map(([key, label]) => ({ key, label, qos: qos[key] ?? {} }))
    : null
  const status = qosDisplayStatus(qos)
  if (status === 'compatible' || status === 'observed') return null

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
    return incompatible.map(({ label }) => `Action ${label} QoS is incompatible.`)
  }
  const partial = states.filter(({ qos }) => stateOf(qos) === 'partial')
  if (partial.length) {
    return partial.map(({ label }) => `Only some Action ${label} endpoints are QoS compatible.`)
  }
  if (aggregate === 'unknown') return ['QoS compatibility could not be determined for one or more Action channels.']
  if (aggregate === 'observed') return ['Action endpoint QoS was discovered through DDS or the ROS2 graph. Compatibility is determined when a communication profile is applied.']
  return []
}

function resourceNotice(kind, qos, status) {
  if (status === 'partial') return 'Only some endpoints are QoS compatible.'
  if (status === 'observed') return 'Remote endpoint QoS was discovered through DDS or the ROS2 graph. Compatibility is determined when a communication profile is applied.'
  if (status === 'unknown') return 'QoS compatibility could not be determined.'
  if (kind === 'topic') {
    const pairs = qos?.endpoint_pair_count
    const mismatches = qos?.incompatible_endpoint_pair_count
    const count = Number.isInteger(pairs) && Number.isInteger(mismatches)
      ? ` (${mismatches}/${pairs} endpoint pairs)`
      : ''
    return `Some Topic endpoints have incompatible QoS settings.${count}`
  }
  return 'QoS incompatibility detected.'
}

function mismatchSummary(qos) {
  if (isActionQos(qos)) {
    return ACTION_CHANNELS.flatMap(([key, label]) => {
      const policies = qos[key]?.mismatch_policies ?? []
      return policies.length ? [`${label}: ${policies.join(', ')}`] : []
    }).join(' · ')
  }
  const policies = qos?.mismatch_policies ?? []
  return policies.length ? `Incompatible policies: ${policies.join(', ')}` : ''
}
