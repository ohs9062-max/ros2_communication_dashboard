import assert from 'node:assert/strict'

import {
  endpointRoleLabel,
  groupQosEndpoints,
  qosFingerprint,
} from './qosEndpointGroups.js'

const reliable = {
  reliability: 'reliable', durability: 'volatile', history: 'unknown', depth: 0,
  deadline_ns: null, deadline_status: 'infinite', lifespan_ns: null,
  lifespan_status: 'unknown', liveliness: 'automatic',
  liveliness_lease_duration_ns: null,
  liveliness_lease_duration_status: 'infinite',
}

const sameQosEndpoints = [
  { endpoint_kind: 'subscriptions', gid: 'gid-a', topic_name: '/scan', topic_type: 'pkg/msg/Scan', qos: reliable },
  { endpoint_kind: 'subscriptions', gid: 'gid-b', topic_name: '/scan', topic_type: 'pkg/msg/Scan', qos: { ...reliable } },
]
const grouped = groupQosEndpoints(sameQosEndpoints)
assert.equal(grouped.length, 1)
assert.equal(grouped[0].endpoints.length, 2)
assert.deepEqual(grouped[0].endpoints.map((endpoint) => endpoint.gid), ['gid-a', 'gid-b'])

const differentQos = groupQosEndpoints([
  sameQosEndpoints[0],
  { ...sameQosEndpoints[1], qos: { ...reliable, reliability: 'best_effort' } },
])
assert.equal(differentQos.length, 2)

const differentActionChannels = groupQosEndpoints([
  { endpoint_kind: 'reader', service_channel: 'request', dds_topic: 'rqGoal', dds_type: 'Goal', qos: reliable },
  { endpoint_kind: 'reader', service_channel: 'request', dds_topic: 'rqResult', dds_type: 'Result', qos: reliable },
])
assert.equal(differentActionChannels.length, 2)

assert.notEqual(
  qosFingerprint({ ...reliable, deadline_ns: null, deadline_status: 'unknown' }),
  qosFingerprint({ ...reliable, deadline_ns: null, deadline_status: 'infinite' }),
)
assert.notEqual(qosFingerprint({ ...reliable, depth: null }), qosFingerprint(reliable))
assert.equal(
  endpointRoleLabel({ service_channel: 'response', endpoint_kind: 'writer' }, 'Publisher'),
  'Response DataWriter',
)

console.log('QoS endpoint grouping tests passed')
