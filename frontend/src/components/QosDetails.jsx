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
  const publishers = qos.publisher_qos ?? []
  const subscribers = qos.subscriber_qos ?? []
  return (
    <div className="qos-state">
      {label && <h4>{label}</h4>}
      <Line label="호환 상태" value={statusLabel(qos)} />
      {qos.graph_qos_status && qos.graph_qos_status !== qos.qos_status && (
        <Line label="Graph endpoint 호환" value={statusLabel({ qos_status: qos.graph_qos_status })} />
      )}
      <Line label="판정 근거" value={sourceLabel(qos.qos_detection_source)} />
      <Line label="자동 적용" value={qos.qos_auto_applied ? '예' : '아니오'} />
      <Line label="Fallback 적용 항목" value={qos.qos_fallback_policies?.join(', ') || '-'} />
      {local && <QosProfile label="Dashboard 적용 QoS" profile={local} />}
      <Line label="불일치 정책" value={qos.mismatch_policies?.join(', ') || '-'} />
      <ReasonLine value={qos.mismatch_reason ?? '-'} />
      {publishers.map((endpoint, index) => (
        <QosProfile
          endpoint={endpoint}
          key={`publisher-${endpoint.node_namespace}-${endpoint.node_name}-${index}`}
          label={endpointLabel(endpoint, 'Publisher', index)}
          profile={endpoint.qos}
        />
      ))}
      {subscribers.map((endpoint, index) => (
        <QosProfile
          endpoint={endpoint}
          key={`subscriber-${endpoint.node_namespace}-${endpoint.node_name}-${index}`}
          label={endpointLabel(endpoint, 'Subscriber', index)}
          profile={endpoint.qos}
        />
      ))}
      {!publishers.length && !subscribers.length && (qos.remote_qos ?? []).length > 0 && (
        <details>
          <summary>상대 Endpoint QoS</summary>
          <pre className="preview-json">{JSON.stringify(qos.remote_qos, null, 2)}</pre>
        </details>
      )}
    </div>
  )
}

function QosProfile({ endpoint, label, profile }) {
  if (!profile) return null
  const nodeLabel = endpoint
    && endpoint.node_name
    ? `${endpoint.node_namespace ?? '/'}${endpoint.node_name}${endpoint.dashboard_owned ? ' (Dashboard)' : ''}`
    : null
  return (
    <div className="qos-profile">
      <h5>{label}</h5>
      {nodeLabel && <Line label="Node" value={nodeLabel} />}
      {endpoint?.dds_topic && <Line label="DDS Topic" value={endpoint.dds_topic} />}
      {endpoint?.dds_type && <Line label="DDS Type" value={endpoint.dds_type} />}
      <Line label="Reliability" value={knownValue(profile.reliability)} />
      <Line label="Durability" value={knownValue(profile.durability)} />
      <Line label="History" value={knownValue(profile.history)} />
      <Line label="Depth" value={knownValue(profile.depth)} />
      <Line label="Deadline (ns)" value={durationValue(profile, 'deadline')} />
      <Line label="Lifespan (ns)" value={durationValue(profile, 'lifespan')} />
      <Line label="Liveliness" value={knownValue(profile.liveliness)} />
      <Line label="Lease duration (ns)" value={durationValue(profile, 'liveliness_lease_duration')} />
    </div>
  )
}

function Line({ label, value }) {
  return <div className="detail-line"><span>{label}</span><strong>{value}</strong></div>
}

function ReasonLine({ value }) {
  return (
    <div className="detail-line qos-reason">
      <span>사유</span>
      <strong>{value}</strong>
    </div>
  )
}

function statusLabel(qos) {
  if (qos.qos_visibility === 'graph_unavailable') {
    return '그래프에서 확인할 수 없음'
  }
  if (qos.qos_detection_source === 'fastdds_discovery' && qos.qos_status === 'observed') {
    return 'DDS Discovery 관찰됨'
  }
  return ({
    compatible: '호환',
    incompatible: '불일치',
    observed: 'Graph 관찰됨',
    partial: '일부 endpoint만 호환',
    unknown: '확인할 수 없음',
  })[qos.qos_status] ?? qos.qos_status ?? '확인할 수 없음'
}

function sourceLabel(source) {
  return ({
    graph_endpoint_info: 'ROS2 Graph endpoint 정보',
    graph_profile_comparison: 'Graph QoS 호환성 비교',
    graph_unavailable: '그래프에서 확인할 수 없음',
    fastdds_discovery: 'Fast DDS Discovery',
    fastdds_unavailable: 'Fast DDS observer 사용 불가',
    incompatible_qos_event: 'RMW QoS 불일치 이벤트',
    default_profile: '안전 fallback',
    unavailable: '확인할 수 없음',
  })[source] ?? source ?? '확인할 수 없음'
}

function partLabel(part) {
  return ({ goal: 'Goal Service', result: 'Result Service', cancel: 'Cancel Service', feedback: 'Feedback Topic', status: 'Status Topic' })[part]
}

function endpointLabel(endpoint, fallback, index) {
  if (!endpoint?.service_channel || !endpoint?.endpoint_kind) {
    return `${fallback} ${index + 1}`
  }
  const channel = endpoint.service_channel === 'request' ? 'Request' : 'Response'
  const kind = endpoint.endpoint_kind === 'writer' ? 'DataWriter' : 'DataReader'
  return `${channel} ${kind} ${index + 1}`
}

function knownValue(value) {
  if (value === null || value === undefined || value === '' || value === 'unknown') {
    return '확인할 수 없음'
  }
  return value
}

function durationValue(profile, field) {
  const value = profile[`${field}_ns`]
  if (value !== null && value !== undefined) return value
  if (profile[`${field}_status`] === 'infinite') return '무한'
  return '확인할 수 없음'
}
