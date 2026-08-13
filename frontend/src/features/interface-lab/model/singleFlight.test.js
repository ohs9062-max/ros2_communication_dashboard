import assert from 'node:assert/strict'
import test from 'node:test'

import { runSharedFlight, runSingleFlight } from './singleFlight.js'

function deferred() {
  let reject
  let resolve
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

test('skips a polling task while the previous task is still running', async () => {
  const lockRef = { current: false }
  const pending = deferred()
  let calls = 0
  const first = runSingleFlight(lockRef, async () => {
    calls += 1
    await pending.promise
  })

  const second = await runSingleFlight(lockRef, async () => {
    calls += 1
  })

  assert.equal(second, false)
  assert.equal(calls, 1)
  pending.resolve()
  assert.equal(await first, true)
})

test('allows the next polling task after completion', async () => {
  const lockRef = { current: false }
  let calls = 0

  assert.equal(await runSingleFlight(lockRef, async () => { calls += 1 }), true)
  assert.equal(await runSingleFlight(lockRef, async () => { calls += 1 }), true)
  assert.equal(calls, 2)
})

test('releases the polling lock after a failed task', async () => {
  const lockRef = { current: false }

  await assert.rejects(
    runSingleFlight(lockRef, async () => { throw new Error('poll failed') }),
    /poll failed/,
  )
  assert.equal(lockRef.current, false)
  assert.equal(await runSingleFlight(lockRef, async () => {}), true)
})

test('shares one result across overlapping refresh callers', async () => {
  const promiseRef = { current: null }
  const pending = deferred()
  let calls = 0
  const task = async () => {
    calls += 1
    await pending.promise
    return 'snapshot-result'
  }

  const first = runSharedFlight(promiseRef, task)
  const second = runSharedFlight(promiseRef, task)
  pending.resolve()

  assert.deepEqual(await Promise.all([first, second]), ['snapshot-result', 'snapshot-result'])
  assert.equal(calls, 1)
  assert.equal(promiseRef.current, null)
})

test('clears a failed shared refresh so the next refresh can retry', async () => {
  const promiseRef = { current: null }
  let calls = 0

  await assert.rejects(runSharedFlight(promiseRef, async () => {
    calls += 1
    throw new Error('refresh failed')
  }), /refresh failed/)
  assert.equal(promiseRef.current, null)
  assert.equal(await runSharedFlight(promiseRef, async () => {
    calls += 1
    return 'recovered'
  }), 'recovered')
  assert.equal(calls, 2)
})
