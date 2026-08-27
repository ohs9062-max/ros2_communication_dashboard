import assert from 'node:assert/strict'
import test from 'node:test'

import { matchesDomainFilter } from './domainFilter.js'

test('keeps every resource for the all-Domain selection', () => {
  assert.equal(matchesDomainFilter({ domain_id: 0 }, null), true)
  assert.equal(matchesDomainFilter({ domain_id: 99 }, null), true)
})

test('matches only the selected resource Domain', () => {
  assert.equal(matchesDomainFilter({ domain_id: 2 }, 2), true)
  assert.equal(matchesDomainFilter({ domain_id: 99 }, 2), false)
  assert.equal(matchesDomainFilter({ name: '/legacy' }, 2), false)
})
