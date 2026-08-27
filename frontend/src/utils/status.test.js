import assert from 'node:assert/strict'

import {
  getTopicSummary,
  isRunningTopic,
  matchesStatusFilter,
  topicEffectiveStatus,
  topicSeverity,
} from './status.js'
import { topicDisplayStatus } from '../features/topics/topicTablePresentation.js'
import { isInternalNode, isIssueNode, isRunningNode } from './nodeFilters.js'

const topics = [
  { name: '/active', status: 'active', effective_status: 'active' },
  { name: '/never', status: 'active', effective_status: 'never_received' },
  { name: '/stale', status: 'active', effective_status: 'stale' },
]

assert.equal(topicEffectiveStatus(topics[1]), 'never_received')
assert.equal(topicDisplayStatus(topics[1]), 'never_received')
assert.equal(topicSeverity(topics[1]), 0)
assert.equal(matchesStatusFilter(topics[1], 'error'), true)
assert.equal(matchesStatusFilter(topics[0], 'issues'), false)
assert.equal(matchesStatusFilter(topics[1], 'issues'), true)
assert.equal(matchesStatusFilter({ name: '/unsupported', status: 'active', supported_type: false }, 'issues'), true)
assert.equal(isRunningTopic({
  deep_monitoring: true,
  graph_present: true,
  publisher_endpoint_count: 1,
  status: 'active',
}), true)
assert.equal(isRunningTopic({
  deep_monitoring: true,
  graph_present: false,
  publisher_endpoint_count: 1,
  status: 'active',
}), false)
assert.equal(isRunningTopic({
  deep_monitoring: false,
  graph_present: true,
  publisher_endpoint_count: 1,
  status: 'active',
}), false)
assert.equal(isRunningTopic({
  deep_monitoring: true,
  effective_status: 'active',
  graph_present: true,
  last_received_at: 100,
  publisher_endpoint_count: 0,
  subscriber_endpoint_count: 0,
}), true)
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

assert.equal(isRunningNode({ graph_present: true, status: 'active' }), true)
assert.equal(isRunningNode({ graph_present: false, status: 'active' }), false)
assert.equal(isRunningNode({ status: 'active' }), true)
assert.equal(isIssueNode({ graph_present: false, status: 'disconnected' }), true)
assert.equal(isIssueNode({ graph_present: true, status: 'active' }), false)
assert.equal(isInternalNode({ is_internal: true }), true)
assert.equal(isInternalNode({ is_internal: false, name: '/external_node' }), false)

console.log('status tests passed')
