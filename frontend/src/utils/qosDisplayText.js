const EXACT_QOS_REASONS = new Map([
  [
    'QoS was discovered for only one side of the Topic endpoints.',
    'Topic endpoint 한쪽에서만 QoS를 발견했습니다.',
  ],
  [
    'Topic endpoint QoS could not be discovered from the ROS2 graph.',
    'ROS2 Graph에서 Topic endpoint QoS를 확인하지 못했습니다.',
  ],
  [
    'Remote Topic endpoint QoS could not be discovered. The default profile is used.',
    '상대 Topic endpoint QoS를 확인하지 못해 기본 QoS profile을 사용합니다.',
  ],
  [
    'Remote Service endpoint QoS was discovered through Fast DDS. History and Depth are not available through discovery.',
    'Fast DDS를 통해 상대 Service endpoint QoS를 발견했습니다. Discovery에서는 History와 Depth를 확인할 수 없습니다.',
  ],
  [
    'Service endpoint QoS could not be discovered through DDS.',
    'DDS에서 Service endpoint QoS를 확인하지 못했습니다.',
  ],
  [
    'Service endpoint QoS could not be discovered from the ROS2 graph.',
    'ROS2 Graph에서 Service endpoint QoS를 확인하지 못했습니다.',
  ],
  [
    'Action Service endpoint QoS could not be discovered from the ROS2 graph.',
    'ROS2 Graph에서 Action Service endpoint QoS를 확인하지 못했습니다.',
  ],
  [
    'Remote QoS is unavailable. The default ROS2 QoS is used.',
    '상대 QoS를 확인하지 못해 ROS2 기본 QoS를 사용합니다.',
  ],
  [
    'A single Client profile cannot satisfy the remote Request and Response QoS. The default ROS2 QoS is used.',
    '하나의 Client profile로 상대 Request와 Response QoS를 모두 만족할 수 없어 ROS2 기본 QoS를 사용합니다.',
  ],
  [
    'No Action endpoint is available for remote QoS discovery.',
    '상대 QoS를 확인할 Action endpoint가 없습니다.',
  ],
])

const RCLPY_MISMATCH_REASONS = new Map([
  [
    'ERROR: Best effort publisher and reliable subscription',
    'BEST_EFFORT Publisher와 RELIABLE Subscription은 호환되지 않습니다.',
  ],
  [
    'ERROR: Volatile publisher and transient local subscription',
    'VOLATILE Publisher와 TRANSIENT_LOCAL Subscription은 호환되지 않습니다.',
  ],
  [
    'ERROR: Subscription deadline is less than publisher deadline',
    'Subscription의 Deadline이 Publisher의 Deadline보다 짧아 호환되지 않습니다.',
  ],
  [
    "ERROR: Publisher's liveliness is automatic and subscription's is manual by topic",
    'Publisher는 AUTOMATIC Liveliness이고 Subscription은 MANUAL_BY_TOPIC이어서 호환되지 않습니다.',
  ],
  [
    'ERROR: Subscription liveliness lease duration is less than publisher',
    'Subscription의 Liveliness Lease Duration이 Publisher보다 짧아 호환되지 않습니다.',
  ],
])

export function qosReasonText(reason, qos = {}, fallback = '-') {
  if (reason == null || reason === '') return fallback
  const text = String(reason).trim()
  if (!text) return fallback
  if (/[가-힣]/.test(text)) return text

  const exact = EXACT_QOS_REASONS.get(text)
  if (exact) return exact

  const event = text.match(/^RMW incompatible QoS event \(policy=(.+)\)$/i)
  if (event) {
    return `RMW에서 QoS 불일치 이벤트가 확인되었습니다. (정책: ${policyLabel(event[1])})`
  }

  const translatedParts = text
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => RCLPY_MISMATCH_REASONS.get(part))
  if (translatedParts.length && translatedParts.every(Boolean)) {
    return [...new Set(translatedParts)].join(' ')
  }

  const policies = (qos.mismatch_policies ?? []).map(policyLabel).filter(Boolean)
  if (qos.qos_status === 'incompatible') {
    return policies.length
      ? `${policies.join(', ')} 정책이 호환되지 않습니다.`
      : 'endpoint 사이의 QoS 설정이 호환되지 않습니다.'
  }
  if (qos.qos_status === 'partial') {
    return '일부 endpoint에만 호환되는 QoS profile이 적용되었습니다.'
  }
  if (qos.qos_status === 'observed') {
    return '상대 endpoint QoS를 발견했지만 적용 profile과의 호환 여부는 아직 판정되지 않았습니다.'
  }
  if (qos.qos_status === 'unknown') {
    return '상대 endpoint QoS를 확인하지 못했습니다.'
  }
  return 'QoS 상태의 상세 사유를 확인했습니다.'
}

export function policyLabel(policy) {
  const normalized = String(policy ?? '').trim().toLowerCase()
  return ({
    reliability: '신뢰성(Reliability)',
    durability: '내구성(Durability)',
    deadline: 'Deadline',
    liveliness: 'Liveliness',
    liveliness_lease_duration: 'Liveliness Lease Duration',
  })[normalized] ?? String(policy ?? '').trim()
}
