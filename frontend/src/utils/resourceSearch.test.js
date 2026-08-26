import assert from 'node:assert/strict'
import test from 'node:test'

import { matchesResourceSearch } from './resourceSearch.js'

const resource = { domain_id: 99, name: '/cmd_vel', type: 'geometry_msgs/msg/Twist' }

test('matches an exact D<number> search against resource Domain ID', () => {
  assert.equal(matchesResourceSearch(resource, 'D99', [resource.name, resource.type]), true)
  assert.equal(matchesResourceSearch(resource, 'd5', [resource.name, resource.type]), false)
  assert.equal(matchesResourceSearch({ name: '/legacy' }, 'D0', ['/legacy']), false)
})

test('keeps name and type substring search outside Domain tokens', () => {
  assert.equal(matchesResourceSearch(resource, 'cmd', [resource.name, resource.type]), true)
  assert.equal(matchesResourceSearch(resource, 'twist', [resource.name, resource.type]), true)
  assert.equal(matchesResourceSearch(resource, 'D99x', [resource.name, resource.type]), false)
})
