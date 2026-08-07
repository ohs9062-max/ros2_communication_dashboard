import { DetailSection } from './DetailSection.jsx'

export function QosDetails({ qos, title = 'QoS' }) {
  if (!qos) return null
  const isActionQos = ['goal', 'result', 'cancel'].some(
    (part) => qos[part] && typeof qos[part] === 'object',
  )
  if (isActionQos) {
    return (
      <DetailSection collapsible title={title}>
        {['goal', 'result', 'cancel', 'feedback', 'status'].map((part) => (
          <QosState key={part} label={partLabel(part)} qos={qos[part]} />
        ))}
      </DetailSection>
    )
  }
  return <DetailSection collapsible title={title}><QosState qos={qos} /></DetailSection>
}

function QosState({ label, qos }) {
  if (!qos) return null
  const local = qos.local_qos
  return (
    <div className="qos-state">
      {label && <h4>{label}</h4>}
      <Line label="호환 상태" value={qos.qos_status ?? 'unknown'} />
      <Line label="판정 근거" value={qos.qos_detection_source ?? 'unavailable'} />
      <Line label="자동 적용" value={qos.qos_auto_applied ? '예' : '아니오'} />
      <Line label="Local QoS" value={profileLabel(local)} />
      <Line label="불일치 정책" value={qos.mismatch_policies?.join(', ') || '-'} />
      <Line label="사유" value={qos.mismatch_reason ?? '-'} />
      <details>
        <summary>상대 Endpoint QoS</summary>
        <pre className="preview-json">{JSON.stringify(qos.remote_qos ?? [], null, 2)}</pre>
      </details>
    </div>
  )
}

function Line({ label, value }) {
  return <div className="detail-line"><span>{label}</span><strong>{value}</strong></div>
}

function profileLabel(profile) {
  if (!profile) return '-'
  return `${profile.reliability}/${profile.durability} · depth ${profile.depth}`
}

function partLabel(part) {
  return ({ goal: 'Goal Service', result: 'Result Service', cancel: 'Cancel Service', feedback: 'Feedback Topic', status: 'Status Topic' })[part]
}
