export const QOS_FINGERPRINT_FIELDS = [
  'reliability',
  'durability',
  'history',
  'depth',
  'deadline_ns',
  'deadline_status',
  'lifespan_ns',
  'lifespan_status',
  'liveliness',
  'liveliness_lease_duration_ns',
  'liveliness_lease_duration_status',
]

export function qosFingerprint(profile = {}) {
  return JSON.stringify(QOS_FINGERPRINT_FIELDS.map((field) => (
    Object.hasOwn(profile, field)
      ? [field, valueFingerprint(profile[field])]
      : [field, 'missing']
  )))
}

export function groupQosEndpoints(endpoints = []) {
  const groups = new Map()
  for (const endpoint of endpoints) {
    const key = JSON.stringify([
      endpoint.endpoint_kind ?? null,
      endpoint.service_channel ?? null,
      endpoint.service_role ?? null,
      endpoint.dds_topic ?? endpoint.topic_name ?? null,
      endpoint.dds_type ?? endpoint.topic_type ?? null,
      qosFingerprint(endpoint.qos),
    ])
    const group = groups.get(key)
    if (group) {
      group.endpoints.push(endpoint)
    } else {
      groups.set(key, {
        endpoints: [endpoint],
        key,
        profile: endpoint.qos,
      })
    }
  }
  return [...groups.values()]
}

export function endpointRoleLabel(endpoint, fallback) {
  if (!endpoint?.service_channel || !endpoint?.endpoint_kind) return fallback
  const channel = endpoint.service_channel === 'request' ? 'Request' : 'Response'
  const kind = endpoint.endpoint_kind === 'writer' ? 'DataWriter' : 'DataReader'
  return `${channel} ${kind}`
}

function valueFingerprint(value) {
  if (value === undefined) return 'undefined'
  if (typeof value === 'number' && Number.isNaN(value)) return 'nan'
  return ['value', value]
}
