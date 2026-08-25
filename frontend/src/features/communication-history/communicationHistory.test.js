import assert from 'node:assert/strict'
import {
  buildHistoryRows,
  historyPayload,
  historyStatus,
  historyTimestamp,
} from './communicationHistory.js'

assert.equal(historyTimestamp({ received_at: 1 }, 'topic'), 1)
assert.equal(historyStatus({ success: false, error_type: 'timeout' }, 'service'), '시간 초과')
assert.deepEqual(historyPayload({ payload: { data: 'hello' } }, 'topic'), { data: 'hello' })
assert.deepEqual(
  historyPayload({
    request: { id: 1 }, response: { ok: true }, success: true,
    sent_to_server: true, elapsed_ms: 2.5,
  }, 'service'),
  {
    request: { id: 1 }, response: { ok: true }, success: true,
    sent_to_server: true, duration_ms: 2.5, timeout_sec: null,
    error_type: null, error: null,
  },
)
assert.equal(historyStatus({ accepted: false }, 'action'), 'Goal 거절')
assert.equal(historyStatus({ success: true, status_label: 'canceled' }, 'action'), '취소됨')
assert.deepEqual(
  historyPayload({ goal: { id: 1 }, feedback: [{ step: 1 }], result: { ok: true } }, 'action'),
  {
    source: 'interface_lab', event_type: 'goal_execution', goal_id: null,
    goal: { id: 1 }, accepted: null, feedback: [{ step: 1 }], result: { ok: true },
    status: null, success: false, duration_ms: null, error_type: null, error: null,
  },
)

const rows = buildHistoryRows([
  { received_at: 3, payload: { value: 3 } },
  { received_at: 2, payload: { value: 2 } },
], 'topic')
assert.deepEqual(rows.map((row) => row.timestamp), [3, 2])
assert.equal(rows[0].status, '수신')
assert.equal(rows[0].formattedPayload, '{\n  "value": 3\n}')

const hundredRows = buildHistoryRows(
  Array.from({ length: 100 }, (_, index) => ({ received_at: 100 - index, payload: { index } })),
  'topic',
)
assert.equal(hundredRows.length, 100)
assert.equal(hundredRows[0].timestamp, 100)
assert.equal(hundredRows[99].timestamp, 1)

const [serviceRow] = buildHistoryRows([{
  called_at: 4,
  request: { id: 1 },
  response: { ok: true },
  success: true,
}], 'service')
assert.match(serviceRow.formattedPayload, /"request": \{/)
assert.match(serviceRow.formattedPayload, /"response": \{/)

const [actionRow] = buildHistoryRows([{
  sent_at: 5,
  goal: { id: 1 },
  feedback: [{ progress: 50 }],
  result: { done: true },
  success: true,
  status_label: 'succeeded',
}], 'action')
assert.match(actionRow.formattedPayload, /"goal": \{/)
assert.match(actionRow.formattedPayload, /"feedback": \[/)
assert.match(actionRow.formattedPayload, /"result": \{/)
assert.equal(actionRow.status, '성공')

const [observedFeedback] = buildHistoryRows([{
  action_name: '/CanControl',
  action_type: 'pkg/action/Demo',
  execution_source: 'monitor_observed',
  event_type: 'feedback',
  goal_id: '01ab',
  received_at: 6,
  feedback: [{ progress: 75 }],
}], 'action')
assert.equal(observedFeedback.timestamp, 6)
assert.equal(observedFeedback.status, 'Feedback')
assert.match(observedFeedback.formattedPayload, /"source": "monitor_observed"/)
assert.match(observedFeedback.formattedPayload, /"goal_id": "01ab"/)

console.log('Communication history tests passed')
