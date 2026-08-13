import assert from 'node:assert/strict'

import { policyLabel, qosReasonText } from './qosDisplayText.js'

assert.equal(
  qosReasonText('Topic endpoint QoS could not be discovered from the ROS2 graph.'),
  'ROS2 Graph에서 Topic endpoint QoS를 확인하지 못했습니다.',
)
assert.equal(
  qosReasonText('ERROR: Best effort publisher and reliable subscription;'),
  'BEST_EFFORT Publisher와 RELIABLE Subscription은 호환되지 않습니다.',
)
assert.equal(
  qosReasonText('RMW incompatible QoS event (policy=reliability)'),
  'RMW에서 QoS 불일치 이벤트가 확인되었습니다. (정책: 신뢰성(Reliability))',
)
assert.equal(
  qosReasonText('unrecognized middleware reason', {
    qos_status: 'incompatible', mismatch_policies: ['durability'],
  }),
  '내구성(Durability) 정책이 호환되지 않습니다.',
)
assert.equal(
  qosReasonText('unrecognized observed reason', { qos_status: 'observed' }),
  '상대 endpoint QoS를 발견했지만 적용 profile과의 호환 여부는 아직 판정되지 않았습니다.',
)
assert.equal(qosReasonText(null), '-')
assert.equal(policyLabel('deadline'), 'Deadline')

console.log('QoS display text tests passed')
