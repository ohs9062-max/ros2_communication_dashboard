import assert from 'node:assert/strict'
import test from 'node:test'

import {
  actionGoalPayload,
  actionKey,
  domainIdFromResource,
  executionResourceForSelection,
  executionResourceForTarget,
  refreshServiceCallState,
  serviceKey,
} from './interfaceUploadModel.js'
import { topicSelectionForDomain } from '../../../utils/interfaceTopics.js'

test('keeps goal and qos in the Action Goal API payload', () => {
  const qos = { goal: { mode: 'manual', profile: { depth: 7 } } }
  const payload = actionGoalPayload({
    actionName: '/control',
    actionType: 'demo/action/Control',
    domainId: 99,
    goal: { command: 3 },
    qosSelection: qos,
    timeoutSec: 10,
  })

  assert.deepEqual(payload, {
    action_name: '/control',
    action_type: 'demo/action/Control',
    domain_id: 99,
    goal: { command: 3 },
    qos,
    timeout_sec: 10,
  })
  assert.equal('goal_json' in payload, false)
})

test('resolves the existing camelCase execution target to the exact Service and Action', () => {
  const services = [
    service('/control_a', 1),
    service('/control_b', 99),
  ]
  const actions = [
    action('/move_a', 1),
    action('/move_b', 99),
  ]

  assert.equal(executionResourceForTarget(services, {
    domainId: 99,
    fullType: 'demo/srv/Control',
    name: '/control_b',
    resourceKey: '99:/control_b',
  }, 'service_name', 'service_type')?.resource_key, '99:/control_b')
  assert.equal(executionResourceForTarget(actions, {
    domainId: 99,
    fullType: 'demo/action/Move',
    name: '/move_b',
    resourceKey: '99:/move_b',
  }, 'action_name', 'action_type')?.resource_key, '99:/move_b')

  const groupedService = {
    ...service('/control_a', null),
    resource_candidates: [service('/control_a', 1), service('/control_b', 99)],
  }
  assert.equal(executionResourceForTarget([groupedService], {
    domainId: 99,
    fullType: 'demo/srv/Control',
    name: '/control_b',
    resourceKey: '99:/control_b',
  }, 'service_name', 'service_type')?.resource_key, '99:/control_b')
})

test('replaces or clears a stale Topic resource key when the Domain changes', () => {
  const message = { message_type: 'std_msgs/msg/String' }
  const topics = [
    { name: '/chat_1', type: 'std_msgs/msg/String', domain_id: 1, resource_key: '1:/chat_1', graph_present: true },
    { name: '/chat_99', type: 'std_msgs/msg/String', domain_id: 99, resource_key: '99:/chat_99', graph_present: true },
  ]

  const domainOne = topicSelectionForDomain({ message, domainId: 1, topics })
  assert.equal(domainOne.resourceKey, '1:/chat_1')
  assert.equal(domainIdFromResource({ domain_id: 1, resource_key: domainOne.resourceKey }), 1)

  const missingDomain = topicSelectionForDomain({ message, domainId: 2, topics })
  assert.equal(missingDomain.resourceKey, '')
  assert.equal(domainIdFromResource({ domain_id: 2, resource_key: missingDomain.resourceKey }), 2)
})

test('preserves exact identity for same-Domain same-type resources with different names', () => {
  const services = [service('/control_a', 99), service('/control_b', 99)]
  const actions = [action('/move_a', 99), action('/move_b', 99)]

  assert.equal(executionResourceForSelection(
    services, serviceKey(services[1]), 99, serviceKey, 'service_type',
  )?.service_name, '/control_b')
  assert.equal(executionResourceForSelection(
    actions, actionKey(actions[1]), 99, actionKey, 'action_type',
  )?.action_name, '/move_b')
})

test('refreshes Service history and state after a completed or failed call path', async () => {
  const updates = []
  await refreshServiceCallState({
    fetchHistory: async () => ({ data: [{ service_name: '/failed', success: false }] }),
    onStateChanged: () => updates.push('state'),
    setHistory: (history) => updates.push(history),
  })

  assert.deepEqual(updates, [
    [{ service_name: '/failed', success: false }],
    'state',
  ])
})

function service(name, domainId) {
  return {
    callable: true,
    domain_id: domainId,
    import_available: true,
    resource_key: `${domainId}:${name}`,
    service_name: name,
    service_type: 'demo/srv/Control',
  }
}

function action(name, domainId) {
  return {
    action_name: name,
    action_type: 'demo/action/Move',
    callable: true,
    domain_id: domainId,
    import_available: true,
    resource_key: `${domainId}:${name}`,
  }
}
