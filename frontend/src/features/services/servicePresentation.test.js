import assert from 'node:assert/strict'

import {
  isIssueService,
  isRunningService,
  matchesServicePresentationFilter,
  servicePresentation,
} from './servicePresentation.js'
import { filterServices } from './serviceFilters.js'

const called = {
  call_status: 'not_called',
  client_count: 4,
  client_node_count: 0,
  effective_status: 'timeout',
  last_call_summary: {
    last_call_status: 'timeout',
    last_called_at: 100,
    last_error: 'Service call timed out.',
    last_request_preview: { request: true },
    last_response_preview: { response: true },
    last_response_time_ms: 2000,
    sent_to_server: true,
  },
  server_count: 2,
  server_node_count: 1,
  status: 'active',
}

const timeout = servicePresentation(called)
assert.equal(timeout.effectiveStatus, 'timeout')
assert.equal(timeout.statusLabel, 'Timeout')
assert.equal(timeout.callStatus, 'timeout')
assert.equal(timeout.callLabel, 'Timeout')
assert.equal(timeout.serverNodeCount, 1)
assert.equal(timeout.clientNodeCount, 0)
assert.equal(timeout.responseTimeMs, 2000)
assert.deepEqual(timeout.requestPreview, { request: true })
assert.deepEqual(timeout.responsePreview, { response: true })
assert.equal(matchesServicePresentationFilter(called, 'issues'), true)

const waiting = servicePresentation({
  call_status: 'not_called',
  status: 'waiting_server',
})
assert.equal(waiting.effectiveStatus, 'waiting_server')
assert.equal(waiting.isWaiting, true)
assert.equal(waiting.statusLabel, undefined)
assert.equal(waiting.callLabel, '호출 이력 없음')

const available = servicePresentation({
  call_status: 'not_called',
  effective_status: 'active',
  status: 'active',
})
assert.equal(available.statusLabel, '서버 있음')
assert.equal(available.isIssue, false)

const validation = servicePresentation({
  call_status: 'validation_error',
  effective_status: 'active',
  last_call_summary: {
    error_type: 'validation_error',
    last_call_status: 'validation_error',
    sent_to_server: false,
  },
  status: 'active',
})
assert.equal(validation.statusLabel, '정상')
assert.equal(validation.callLabel, '입력 검증 실패')
assert.equal(validation.callTone, 'warn')
assert.equal(validation.sentToServer, false)
assert.equal(validation.isIssue, false)

const qosPreflight = servicePresentation({
  call_status: 'qos_preflight_incompatible',
  effective_status: 'active',
  last_call_summary: {
    error_type: 'qos_preflight_incompatible',
    last_call_status: 'qos_preflight_incompatible',
    sent_to_server: false,
  },
  status: 'active',
})
assert.equal(qosPreflight.statusLabel, '정상')
assert.equal(qosPreflight.callLabel, 'QoS 불일치')
assert.equal(qosPreflight.callTone, 'bad')
assert.equal(qosPreflight.sentToServer, false)
assert.equal(qosPreflight.isIssue, false)

const legacy = servicePresentation({
  last_called_at: 10,
  last_request_preview: { legacy: true },
  last_response_time_ms: 5,
  status: 'active',
})
assert.equal(legacy.effectiveStatus, 'active')
assert.equal(legacy.lastCalledAt, 10)
assert.deepEqual(legacy.requestPreview, { legacy: true })
assert.equal(legacy.responseTimeMs, 5)

const runningService = {
  effective_status: 'active',
  graph_present: true,
  server_count: 1,
  status: 'active',
}
assert.equal(isRunningService(runningService), true)
assert.equal(isIssueService(runningService), false)
assert.equal(isRunningService({ graph_present: true, server_count: 0 }), false)
assert.equal(isIssueService({ graph_present: true, server_count: 0, status: 'inactive' }), true)
assert.equal(isIssueService({
  ...runningService,
  qos_status: 'incompatible',
}), true)

const internalRunningService = {
  ...runningService,
  category: 'parameter',
  is_primary: true,
  name: '/node/get_parameters',
}
const primaryRunningService = {
  ...runningService,
  is_primary: true,
  name: '/registered',
  qos_status: 'incompatible',
}
const calledRunningService = {
  ...called,
  graph_present: true,
  name: '/called',
}
assert.deepEqual(filterServices({
  primaryServices: [],
  search: '',
  services: [
    runningService,
    internalRunningService,
    primaryRunningService,
    calledRunningService,
  ],
  statusFilter: 'running',
}), [primaryRunningService, calledRunningService])
assert.deepEqual(filterServices({
  primaryServices: [],
  search: '',
  services: [runningService, internalRunningService],
  statusFilter: 'all',
}), [runningService, internalRunningService])

console.log('Service presentation tests passed')
