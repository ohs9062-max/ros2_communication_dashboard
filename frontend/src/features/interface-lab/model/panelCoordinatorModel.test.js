import assert from 'node:assert/strict'
import test from 'node:test'

import {
  closeExecutionPanel,
  isExecutionMode,
  isWorkspaceExpanded,
  runExecutionPanelLoad,
} from './panelCoordinatorModel.js'

test('closing invalidates pending loads and releases the execution busy state', () => {
  const requestRef = { current: 3 }
  const events = []

  closeExecutionPanel({
    requestRef,
    setBusy: (busy) => events.push(['busy', busy]),
    setExecutionMode: (mode) => events.push(['mode', mode]),
  })

  assert.equal(requestRef.current, 4)
  assert.deepEqual(events, [['busy', false], ['mode', null]])
})

test('loads an execution panel and preserves the busy and management-panel sequence', async () => {
  const events = []
  const result = await runExecutionPanelLoad({
    hideManagementPanels: () => events.push('hide-management'),
    loaders: { topic: async () => events.push('load-topic') },
    mode: 'topic',
    setBusy: (busy) => events.push(`busy:${busy}`),
    setExecutionMode: (mode) => events.push(`mode:${mode}`),
    setFeedback: () => events.push('feedback'),
  })

  assert.equal(result, true)
  assert.deepEqual(events, [
    'busy:true', 'load-topic', 'mode:topic', 'hide-management', 'busy:false',
  ])
})

test('keeps management panels open only when requested', async () => {
  const events = []
  const result = await runExecutionPanelLoad({
    hideManagementPanels: () => events.push('hide-management'),
    keepOpen: true,
    loaders: { service: async () => events.push('load-service') },
    mode: 'service',
    setBusy: (busy) => events.push(`busy:${busy}`),
    setExecutionMode: (mode) => events.push(`mode:${mode}`),
    setFeedback: () => events.push('feedback'),
  })

  assert.equal(result, true)
  assert.deepEqual(events, ['busy:true', 'load-service', 'mode:service', 'busy:false'])
})

test('reports load failure and always releases busy state', async () => {
  const events = []
  const result = await runExecutionPanelLoad({
    hideManagementPanels: () => events.push('hide-management'),
    loaders: { action: async () => { throw new Error('load failed') } },
    mode: 'action',
    setBusy: (busy) => events.push(['busy', busy]),
    setExecutionMode: (mode) => events.push(['mode', mode]),
    setFeedback: (feedback) => events.push(['feedback', feedback]),
  })

  assert.equal(result, false)
  assert.deepEqual(events, [
    ['busy', true],
    ['feedback', { tone: 'error', text: 'load failed' }],
    ['busy', false],
  ])
})

test('applies only the latest execution-panel request when responses finish out of order', async () => {
  let currentRequest = 1
  let resolveTopic
  let resolveService
  const topicPending = new Promise((resolve) => { resolveTopic = resolve })
  const servicePending = new Promise((resolve) => { resolveService = resolve })
  const events = []
  const common = {
    hideManagementPanels: () => events.push('hide-management'),
    setBusy: (busy) => events.push(`busy:${busy}`),
    setExecutionMode: (mode) => events.push(`mode:${mode}`),
    setFeedback: (feedback) => events.push(`feedback:${feedback.text}`),
  }

  const topicLoad = runExecutionPanelLoad({
    ...common,
    isCurrent: () => currentRequest === 1,
    loaders: { topic: () => topicPending },
    mode: 'topic',
  })
  currentRequest = 2
  const serviceLoad = runExecutionPanelLoad({
    ...common,
    isCurrent: () => currentRequest === 2,
    loaders: { service: () => servicePending },
    mode: 'service',
  })

  resolveService()
  assert.equal(await serviceLoad, true)
  resolveTopic()
  assert.equal(await topicLoad, false)
  assert.deepEqual(events, [
    'busy:true', 'busy:true', 'mode:service', 'hide-management', 'busy:false',
  ])
})

test('suppresses stale request errors and does not release the latest busy state', async () => {
  let current = false
  const events = []
  const result = await runExecutionPanelLoad({
    hideManagementPanels: () => events.push('hide-management'),
    isCurrent: () => current,
    loaders: { topic: async () => { throw new Error('stale failure') } },
    mode: 'topic',
    setBusy: (busy) => events.push(`busy:${busy}`),
    setExecutionMode: (mode) => events.push(`mode:${mode}`),
    setFeedback: (feedback) => events.push(`feedback:${feedback.text}`),
  })

  assert.equal(result, false)
  assert.deepEqual(events, ['busy:true'])
})

test('ignores unsupported execution modes without changing UI state', async () => {
  const events = []
  const result = await runExecutionPanelLoad({
    hideManagementPanels: () => events.push('hide-management'),
    loaders: {},
    mode: 'mock',
    setBusy: (busy) => events.push(['busy', busy]),
    setExecutionMode: (mode) => events.push(['mode', mode]),
    setFeedback: (feedback) => events.push(['feedback', feedback]),
  })

  assert.equal(result, false)
  assert.deepEqual(events, [])
  assert.equal(isExecutionMode('topic'), true)
  assert.equal(isExecutionMode('mock'), false)
})

test('expands only an active management or matching receive workspace', () => {
  const base = {
    executionMode: null,
    receiveMode: 'mock',
    showManualInput: false,
    showPackages: false,
    showReceivePanel: false,
    showRegistry: false,
    workspaceExpanded: true,
  }

  assert.equal(isWorkspaceExpanded(base), false)
  assert.equal(isWorkspaceExpanded({ ...base, showManualInput: true }), true)
  assert.equal(isWorkspaceExpanded({
    ...base, executionMode: 'topic', receiveMode: 'topic', showReceivePanel: true,
  }), true)
  assert.equal(isWorkspaceExpanded({
    ...base, executionMode: 'service', receiveMode: 'topic', showReceivePanel: true,
  }), false)
  assert.equal(isWorkspaceExpanded({
    ...base, receiveMode: 'topic', showReceivePanel: true, workspaceExpanded: false,
  }), false)
})
