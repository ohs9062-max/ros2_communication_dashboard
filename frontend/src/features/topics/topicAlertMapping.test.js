import assert from 'node:assert/strict'
import test from 'node:test'

import { mapNodeAlertsToTopics } from './topicAlertMapping.js'

const cameraTopic = {
  domain_id: 99,
  name: '/camera/image_raw',
  resource_key: '99:/camera/image_raw',
}

test('maps a disconnected camera node Alert to its retained Topic connection', () => {
  const [mapped] = mapNodeAlertsToTopics({
    alerts: [{
      code: 'node_stale',
      domain_id: 99,
      id: 'domain:99:node:/camera:node_stale',
      message: 'Monitored Node is confirmed absent from the ROS2 graph.',
      name: '/camera',
      resource_key: '99:/camera',
      source: 'node',
    }],
    nodes: [{
      domain_id: 99,
      full_name: '/camera',
      graph_present: false,
      resource_key: '99:/camera',
      topic_publishers: [{ name: '/camera/image_raw' }],
      topic_subscribers: [],
    }],
    topics: [cameraTopic],
  })

  assert.equal(mapped.mapped_topic_alert, true)
  assert.equal(mapped.name, '/camera/image_raw')
  assert.equal(mapped.resource_key, '99:/camera/image_raw')
  assert.equal(mapped.message, 'Monitored Node is confirmed absent from the ROS2 graph.')
})

test('does not project a Node Alert onto a same-name Topic in another Domain', () => {
  assert.deepEqual(mapNodeAlertsToTopics({
    alerts: [{ code: 'node_stale', name: '/camera', resource_key: '99:/camera', source: 'node' }],
    nodes: [{
      domain_id: 99,
      full_name: '/camera',
      resource_key: '99:/camera',
      topic_publishers: ['/camera/image_raw'],
    }],
    topics: [{ ...cameraTopic, domain_id: 0, resource_key: '0:/camera/image_raw' }],
  }), [])
})
