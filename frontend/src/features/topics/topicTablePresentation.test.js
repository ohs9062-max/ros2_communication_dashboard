import assert from 'node:assert/strict'
import test from 'node:test'

import { createTopicSortColumns, topicHzKey } from './topicTablePresentation.js'

test('uses resource identity instead of a name-only key for Topic Hz', () => {
  const zero = { domain_id: 0, name: '/same', resource_key: '0:/same' }
  const two = { domain_id: 2, name: '/same', resource_key: '2:/same' }
  const hzByTopic = {
    '0:/same': { data: { hz: 3 } },
    '2:/same': { data: { hz: 7 } },
  }
  const columns = createTopicSortColumns(hzByTopic)

  assert.equal(topicHzKey(zero), '0:/same')
  assert.equal(topicHzKey(two), '2:/same')
  assert.equal(columns.hz.value(zero), 3)
  assert.equal(columns.hz.value(two), 7)
})
