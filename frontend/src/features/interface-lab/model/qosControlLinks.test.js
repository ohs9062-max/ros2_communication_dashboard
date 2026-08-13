import assert from 'node:assert/strict'
import test from 'node:test'

import {
  changeFirstQosMode,
  changeQosProfile,
  firstQosMode,
  linkedQosControls,
  qosProfilesByKey,
} from './qosControlLinks.js'

test('maps channel profiles and selects the shared mode from the first control', () => {
  const controls = [
    { key: 'goal', mode: 'manual', profile: { depth: 3 } },
    { key: 'feedback', mode: 'manual', profile: { depth: 5 } },
  ]

  assert.deepEqual(qosProfilesByKey(controls), {
    goal: { depth: 3 },
    feedback: { depth: 5 },
  })
  assert.equal(firstQosMode(controls), 'manual')
  assert.equal(firstQosMode(), 'auto')
})

test('routes mode and profile updates to the matching original controls', () => {
  const calls = []
  const controls = [
    {
      key: 'goal',
      onModeChange: (mode) => calls.push(['mode', mode]),
      onProfileChange: (profile) => calls.push(['goal', profile]),
    },
    {
      key: 'feedback',
      onProfileChange: (profile) => calls.push(['feedback', profile]),
    },
  ]

  changeFirstQosMode(controls, 'manual')
  changeQosProfile(controls, 'feedback', { reliability: 'best_effort' })
  changeQosProfile(controls, 'missing', {})

  assert.deepEqual(calls, [
    ['mode', 'manual'],
    ['feedback', { reliability: 'best_effort' }],
  ])
})

test('builds linked controls without dropping labels or profiles', () => {
  const calls = []
  const controls = [{
    key: 'status',
    label: 'Status Topic',
    mode: 'auto',
    profile: { depth: 10 },
  }]
  const qosLink = {
    changeExecutionMode: (mode) => calls.push(['execution-mode', mode]),
    changeExecutionProfile: (key, profile) => calls.push(['execution-profile', key, profile]),
    changeReceiveMode: (mode) => calls.push(['receive-mode', mode]),
    changeReceiveProfile: (key, profile) => calls.push(['receive-profile', key, profile]),
  }

  const execution = linkedQosControls(controls, qosLink, 'execution')
  const receive = linkedQosControls(controls, qosLink, 'receive')
  execution[0].onModeChange('manual')
  execution[0].onProfileChange({ depth: 4 })
  receive[0].onModeChange('manual')
  receive[0].onProfileChange({ depth: 6 })

  assert.equal(execution[0].label, 'Status Topic')
  assert.deepEqual(execution[0].profile, { depth: 10 })
  assert.deepEqual(calls, [
    ['execution-mode', 'manual'],
    ['execution-profile', 'status', { depth: 4 }],
    ['receive-mode', 'manual'],
    ['receive-profile', 'status', { depth: 6 }],
  ])
})
