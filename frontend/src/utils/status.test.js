import assert from 'node:assert/strict'

import {
  getTopicSummary,
  matchesStatusFilter,
  topicEffectiveStatus,
  topicSeverity,
} from './status.js'
import { topicDisplayStatus } from '../features/topics/topicTablePresentation.js'

const topics = [
  { name: '/active', status: 'active', effective_status: 'active' },
  { name: '/never', status: 'active', effective_status: 'never_received' },
  { name: '/stale', status: 'active', effective_status: 'stale' },
]

assert.equal(topicEffectiveStatus(topics[1]), 'never_received')
assert.equal(topicDisplayStatus(topics[1]), 'never_received')
assert.equal(topicSeverity(topics[1]), 0)
assert.equal(matchesStatusFilter(topics[1], 'error'), true)
assert.deepEqual(getTopicSummary(topics), {
  total: 3,
  active: 1,
  warning: 1,
  error: 1,
  inactive: 0,
  noSubscriber: 0,
  otherWarning: 1,
  unsupported: 0,
  deep: 0,
})

assert.equal(
  topicDisplayStatus({ status: 'active' }),
  'active',
  'old snapshots must keep the Graph status fallback',
)

console.log('status tests passed')
