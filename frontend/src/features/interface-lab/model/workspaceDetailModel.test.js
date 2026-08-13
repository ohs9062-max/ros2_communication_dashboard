import assert from 'node:assert/strict'
import test from 'node:test'

import {
  communicationSnapshot,
  compactEndpoint,
  connectionCount,
  defaultDetailView,
  detailTabs,
} from './workspaceDetailModel.js'

test('uses communication tabs for ROS interfaces and one information tab for packages', () => {
  assert.deepEqual(detailTabs('message').map(({ id }) => id), [
    'details',
    'history',
    'advanced',
    'open-execution',
  ])
  assert.deepEqual(detailTabs('service').map(({ id }) => id), [
    'details',
    'history',
    'advanced',
    'open-execution',
  ])
  assert.deepEqual(detailTabs('package'), [
    { id: 'advanced', label: 'Package 정보' },
  ])
  assert.equal(defaultDetailView('package'), 'advanced')
  assert.equal(defaultDetailView('action'), 'details')
  assert.equal(defaultDetailView(), 'details')
})

test('counts only array-backed Graph connections', () => {
  assert.equal(connectionCount({
    connectedTopics: [{}, {}],
    connectedServices: [{}],
    connectedActions: null,
  }), 3)
  assert.equal(connectionCount(), 0)
})

test('keeps diagnostic endpoint fields and removes unrelated payload data', () => {
  assert.deepEqual(compactEndpoint({
    topic_name: '/scan',
    message_type: 'sensor_msgs/msg/LaserScan',
    publisher_count: 1,
    qos: { status: 'compatible' },
    payload: { ranges: [1, 2, 3] },
    debug_value: 'hidden',
  }), {
    topic_name: '/scan',
    message_type: 'sensor_msgs/msg/LaserScan',
    publisher_count: 1,
    qos: { status: 'compatible' },
  })
})

test('builds the existing QoS communication snapshot shape with safe defaults', () => {
  assert.deepEqual(communicationSnapshot({
    qos: { mode: 'manual' },
    connectedTopics: [{ topic_name: '/cmd_vel', payload: { ignored: true } }],
    connectedServices: [{ service_name: '/control', server_count: 1 }],
    connectedActions: [{ action_name: '/navigate', channel: 'feedback' }],
    topicStates: [{ topic_name: '/status', available: true }],
  }), {
    qos_mode: 'manual',
    topics: [{ topic_name: '/cmd_vel' }],
    services: [{ service_name: '/control', server_count: 1 }],
    actions: [{ action_name: '/navigate', channel: 'feedback' }],
    subscriptions: [{ topic_name: '/status', available: true }],
  })

  assert.deepEqual(communicationSnapshot(), {
    qos_mode: 'auto',
    topics: [],
    services: [],
    actions: [],
    subscriptions: [],
  })
})
