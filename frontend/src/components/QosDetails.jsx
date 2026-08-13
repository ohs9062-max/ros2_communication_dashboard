import { useEffect, useRef } from 'react'
import { policyLabel, qosReasonText } from '../utils/qosDisplayText.js'
import { DetailSection } from './DetailSection.jsx'
import { endpointRoleLabel, groupQosEndpoints } from './qosEndpointGroups.js'

const ACTION_QOS_GROUPS = [
  {
    key: 'service',
    label: 'Service 통신',
    caption: 'Goal · Result · Cancel',
    parts: ['goal', 'result', 'cancel'],
  },
  {
    key: 'topic',
    label: 'Topic 통신',
    caption: 'Feedback · Status',
    parts: ['feedback', 'status'],
  },
]

const RMW_INFINITE_DURATION_NS = Number('9223372036854775807')

export function QosDetails({ focusRequest, qos, title = 'QoS' }) {
  const detailsRef = useRef(null)
  useEffect(() => {
    if (!focusRequest || !detailsRef.current) return
    detailsRef.current.open = true
    if (focusRequest.channel) {
      const part = detailsRef.current.querySelector(
        `[data-qos-part="${focusRequest.channel}"]`,
      )
      if (part) {
        part.open = true
        const group = part.closest('.qos-channel-group')
        if (group) group.open = true
      }
    }
    window.setTimeout(() => detailsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    }), 0)
  }, [focusRequest])

  if (!qos) return null
  const isActionQos = ['goal', 'result', 'cancel'].some(
    (part) => qos[part] && typeof qos[part] === 'object',
  )
  if (isActionQos) {
    return (
      <DetailSection collapsible detailsRef={detailsRef} title={title}>
        <div className="qos-channel-groups">
          {ACTION_QOS_GROUPS.map((group) => (
            <ActionQosGroup group={group} key={group.key} qos={qos} />
          ))}
        </div>
      </DetailSection>
    )
  }
  return (
    <DetailSection collapsible detailsRef={detailsRef} title={title}>
      <QosState collapseEndpointGroups qos={qos} />
    </DetailSection>
  )
}

function ActionQosGroup({ group, qos }) {
  const states = group.parts.map((part) => qos[part]).filter(Boolean)
  const groupTone = aggregateStatusTone(states)
  return (
    <details className="qos-channel-group">
      <summary className="qos-channel-summary">
        <span className="qos-channel-heading">
          <strong className="qos-item-title">{group.label}</strong>
          <small className="qos-channel-caption">{group.caption}</small>
        </span>
        <StatusPill label={aggregateStatusLabel(states)} tone={groupTone} />
      </summary>
      <div className="qos-channel-body">
        {group.parts.map((part) => (
          <details className="qos-channel-item" data-qos-part={part} key={part}>
            <summary className="qos-part-summary">
              <strong className="qos-item-title">{partLabel(part)}</strong>
              <StatusPill label={statusLabel(qos[part] ?? {})} tone={statusTone(qos[part])} />
            </summary>
            <div className="qos-channel-item-body">
              <QosState qos={qos[part]} />
            </div>
          </details>
        ))}
      </div>
    </details>
  )
}

function QosState({ collapseEndpointGroups = false, qos }) {
  if (!qos) return null
  const local = qos.local_qos
  const publishers = qos.publisher_qos ?? []
  const subscribers = qos.subscriber_qos ?? []
  const stateTone = statusTone(qos)
  return (
    <div className="qos-state">
      <Line label="호환 상태" tone={stateTone} value={statusLabel(qos)} />
      {qos.graph_qos_status && qos.graph_qos_status !== qos.qos_status && (
        <Line
          label="Graph endpoint 호환"
          tone={statusTone({ qos_status: qos.graph_qos_status })}
          value={statusLabel({ qos_status: qos.graph_qos_status })}
        />
      )}
      <Line
        label="판정 근거"
        tone={stateTone}
        value={sourceLabel(qos.qos_detection_source)}
      />
      <Line
        label="자동 적용"
        tone={qos.qos_auto_applied ? 'good' : 'muted'}
        value={qos.qos_auto_applied ? '예' : '아니오'}
      />
      <Line
        label="Fallback 적용 항목"
        tone={qos.qos_fallback_policies?.length ? 'warn' : 'muted'}
        value={qos.qos_fallback_policies?.join(', ') || '-'}
      />
      {local && !collapseEndpointGroups && <QosProfile label="Dashboard 적용 QoS" profile={local} />}
      <Line
        label="불일치 정책"
        tone={qos.qos_status === 'incompatible' ? 'bad' : qos.mismatch_policies?.length ? 'warn' : 'muted'}
        value={qos.mismatch_policies?.map(policyLabel).join(', ') || '-'}
      />
      <ReasonLine
        tone={stateTone}
        value={qosReasonText(qos.mismatch_reason, qos)}
      />
      <QosEndpointGroups
        local={collapseEndpointGroups ? local : null}
        publishers={publishers}
        subscribers={subscribers}
      />
      {!publishers.length && !subscribers.length && (qos.remote_qos ?? []).length > 0 && (
        <details>
          <summary>상대 Endpoint QoS</summary>
          <pre className="preview-json">{JSON.stringify(qos.remote_qos, null, 2)}</pre>
        </details>
      )}
    </div>
  )
}

function QosEndpointGroups({ local, publishers, subscribers }) {
  const isService = [...publishers, ...subscribers].some((endpoint) => endpoint.service_channel)
  return (
    <div className="qos-channel-groups">
      {local && (
        <QosProfileGroup caption="Dashboard에서 실제 사용하는 profile" label="Dashboard 적용 QoS">
          <QosProfile label="적용 Profile" profile={local} />
        </QosProfileGroup>
      )}
      <EndpointGroup
        endpoints={publishers}
        fallback="Publisher"
        label={isService ? 'Response 통신' : 'Publisher'}
      />
      <EndpointGroup
        endpoints={subscribers}
        fallback="Subscriber"
        label={isService ? 'Request 통신' : 'Subscriber'}
      />
    </div>
  )
}

function EndpointGroup({ endpoints, fallback, label }) {
  if (!endpoints.length) return null
  const groups = groupQosEndpoints(endpoints)
  return (
    <QosProfileGroup
      caption={`${endpoints.length}개 endpoint · ${groups.length}개 QoS profile`}
      label={label}
    >
      {groups.map((group, index) => (
        <EndpointProfileGroup
          fallback={fallback}
          group={group}
          groupCount={groups.length}
          index={index}
          key={group.key}
        />
      ))}
    </QosProfileGroup>
  )
}

function EndpointProfileGroup({ fallback, group, groupCount, index }) {
  const endpoint = group.endpoints[0]
  const role = endpointRoleLabel(endpoint, fallback)
  const count = group.endpoints.length
  const label = [
    count > 1 ? `${role} × ${count}` : role,
    groupCount > 1 ? `QoS Profile ${index + 1}` : null,
  ].filter(Boolean).join(' · ')
  return (
    <section className="qos-endpoint-profile-group">
      <div className="qos-endpoint-profile-heading">
        <strong>{label}</strong>
        {count > 1 && <small>QoS 동일</small>}
      </div>
      <EndpointScope endpoint={endpoint} />
      <QosProfile label="공통 QoS" profile={group.profile} />
      <EndpointIdentityDetails endpoints={group.endpoints} fallback={fallback} />
    </section>
  )
}

function EndpointScope({ endpoint }) {
  return (
    <div className="qos-endpoint-scope">
      {endpoint?.topic_name && <Line label="ROS Topic" tone="meta" value={endpoint.topic_name} />}
      {endpoint?.topic_type && <Line label="ROS Type" tone="meta" value={endpoint.topic_type} />}
      {endpoint?.dds_topic && <Line label="DDS Topic" tone="meta" value={endpoint.dds_topic} />}
      {endpoint?.dds_type && <Line label="DDS Type" tone="meta" value={endpoint.dds_type} />}
    </div>
  )
}

function EndpointIdentityDetails({ endpoints, fallback }) {
  return (
    <details className="qos-endpoint-identities">
      <summary>Endpoint 상세 보기 · {endpoints.length}개</summary>
      <div className="qos-endpoint-identity-list">
        {endpoints.map((endpoint, index) => (
          <div className="qos-endpoint-identity" key={endpointIdentityKey(endpoint, index)}>
            <strong>{endpointRoleLabel(endpoint, fallback)} {index + 1}</strong>
            <Line label="Node" value={endpoint.node_name || '-'} />
            <Line label="Namespace" value={endpoint.node_namespace || '-'} />
            <Line label={endpoint.guid ? 'GUID' : 'GID'} tone="meta" value={endpoint.guid || endpoint.gid || '-'} />
            <Line label="Participant" tone="meta" value={endpoint.participant_id || '-'} />
            <Line label="Dashboard endpoint" value={endpoint.dashboard_owned ? '예' : '아니오'} />
            <Line label="Endpoint kind" tone="meta" value={endpoint.endpoint_kind || '-'} />
          </div>
        ))}
      </div>
    </details>
  )
}

function QosProfileGroup({ caption, children, label }) {
  return (
    <details className="qos-channel-group">
      <summary className="qos-channel-summary">
        <span className="qos-channel-heading">
          <strong className="qos-item-title">{label}</strong>
          <small className="qos-channel-caption">{caption}</small>
        </span>
      </summary>
      <div className="qos-channel-body">{children}</div>
    </details>
  )
}

function QosProfile({ label, profile }) {
  if (!profile) return null
  return (
    <div className="qos-profile">
      <h5>{label}</h5>
      <ProfileLine label="Reliability" rawValue={profile.reliability} />
      <ProfileLine label="Durability" rawValue={profile.durability} />
      <ProfileLine label="History" rawValue={profile.history} />
      <ProfileLine label="Depth" rawValue={profile.depth} />
      <DurationProfileLine field="deadline" label="Deadline (ns)" profile={profile} />
      <DurationProfileLine field="lifespan" label="Lifespan (ns)" profile={profile} />
      <ProfileLine label="Liveliness" rawValue={profile.liveliness} />
      <DurationProfileLine
        field="liveliness_lease_duration"
        label="Lease duration (ns)"
        profile={profile}
      />
    </div>
  )
}

function ProfileLine({ label, rawValue }) {
  const value = knownValue(rawValue)
  return <Line label={label} tone={value === '확인할 수 없음' ? 'muted' : 'info'} value={value} />
}

function DurationProfileLine({ field, label, profile }) {
  const value = durationValue(profile, field)
  const tone = isUnlimitedDuration(profile, field)
    ? 'unlimited'
    : value === '확인할 수 없음' ? 'muted' : 'info'
  return <Line label={label} tone={tone} value={value} />
}

function Line({ label, tone, value }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      <strong className={tone ? `detail-value-${tone}` : undefined}>{value}</strong>
    </div>
  )
}

function ReasonLine({ tone, value }) {
  return (
    <div className="qos-reason">
      <span className="qos-reason-label">사유</span>
      <strong className={`qos-reason-description detail-value-${tone}`}>
        {value}
      </strong>
    </div>
  )
}

function StatusPill({ label, tone }) {
  return <span className={`qos-status-pill ${tone}`}>{label}</span>
}

function statusTone(qos) {
  if (!qos) return 'muted'
  if (qos.qos_status === 'incompatible') return 'bad'
  if (qos.qos_status === 'partial') return 'warn'
  if (qos.qos_status === 'compatible') return 'good'
  if (qos.qos_detection_source === 'fastdds_discovery' && qos.qos_status === 'observed') {
    return 'good'
  }
  if (qos.qos_visibility === 'graph_unavailable') return 'warn'
  if (qos.qos_status === 'unknown') return 'warn'
  if (qos.qos_status === 'observed') return 'warn'
  return 'muted'
}

function aggregateStatusTone(states) {
  const tones = states.map(statusTone)
  if (tones.includes('bad')) return 'bad'
  if (tones.includes('warn') || tones.includes('muted')) return 'warn'
  if (tones.length && tones.every((tone) => tone === 'good')) return 'good'
  if (tones.length && tones.every((tone) => tone === 'info')) return 'info'
  return tones.includes('good') && tones.includes('info') ? 'info' : 'muted'
}

function aggregateStatusLabel(states) {
  return ({
    good: '정상',
    info: '정상',
    warn: '일부 확인',
    bad: '불일치',
    muted: '확인 불가',
  })[aggregateStatusTone(states)]
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

function endpointIdentityKey(endpoint, index) {
  return endpoint.guid || endpoint.gid || [
    endpoint.node_namespace,
    endpoint.node_name,
    endpoint.endpoint_kind,
    index,
  ].join(':')
}

function knownValue(value) {
  if (value === null || value === undefined || value === '' || value === 'unknown') {
    return '확인할 수 없음'
  }
  return value
}

function durationValue(profile, field) {
  const value = profile[`${field}_ns`]
  if (isUnlimitedDuration(profile, field)) {
    return ({
      deadline: '기한 제한 없음',
      lifespan: '만료되지 않음',
      liveliness_lease_duration: '임대 만료 없음',
    })[field] ?? '시간 제한 없음'
  }
  if (value !== null && value !== undefined) return value
  return '확인할 수 없음'
}

function isUnlimitedDuration(profile, field) {
  if (profile[`${field}_status`] === 'infinite') return true
  const value = profile[`${field}_ns`]
  return typeof value === 'number' && value >= RMW_INFINITE_DURATION_NS
}
