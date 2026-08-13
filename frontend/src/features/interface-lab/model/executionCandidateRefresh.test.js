import assert from 'node:assert/strict'
import test from 'node:test'

import {
  refreshExecutionCandidates,
  removeWithExecutionRefresh,
} from './executionCandidateRefresh.js'

test('refreshes Topic, Service, and Action candidates together', async () => {
  const calls = []
  await refreshExecutionCandidates([
    async () => calls.push('topic'),
    async () => calls.push('service'),
    async () => calls.push('action'),
  ])

  assert.deepEqual(calls.sort(), ['action', 'service', 'topic'])
})

test('propagates loader failures to the delete action lifecycle', async () => {
  await assert.rejects(
    refreshExecutionCandidates([
      async () => true,
      async () => { throw new Error('Service candidates failed') },
    ]),
    /Service candidates failed/,
  )
})

test('passes the exact target and refresh callback to existing remove functions', async () => {
  const target = { full_type: 'example_interfaces/msg/Test' }
  const refresh = async () => true
  const remove = async (receivedTarget, receivedRefresh) => ({
    receivedRefresh,
    receivedTarget,
  })

  assert.deepEqual(await removeWithExecutionRefresh(remove, target, refresh), {
    receivedRefresh: refresh,
    receivedTarget: target,
  })
})
