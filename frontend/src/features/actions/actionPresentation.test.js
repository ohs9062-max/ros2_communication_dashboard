import assert from 'node:assert/strict'

import {
  actionPresentation,
  matchesActionStatusFilter,
} from './actionPresentation.js'

const conflicting = {
  runtime: {
    elapsed_time_ms: 900,
    feedback_preview: { source: 'runtime' },
    last_feedback_at: 80,
    last_goal_status: 'executing',
    last_status_at: 70,
    observed_goal_count: 1,
    result_preview: { source: 'runtime' },
    result_status: 'pending',
  },
  last_goal_summary: {
    execution_time_ms: 120,
    last_feedback_at: 110,
    last_feedback_preview: { source: 'summary' },
    last_goal_sent_at: 100,
    last_goal_status: 'succeeded',
    last_result_at: 120,
    last_result_preview: { source: 'summary' },
    success: true,
  },
}

const completed = actionPresentation(conflicting)
assert.equal(completed.goalStatus, 'succeeded')
assert.equal(completed.isRunning, false)
assert.equal(completed.isSucceeded, true)
assert.equal(completed.executionTimeMs, 120)
assert.equal(completed.lastGoalAt, 100)
assert.equal(completed.lastResponseAt, 120)
assert.deepEqual(completed.feedbackPreview, { source: 'summary' })
assert.deepEqual(completed.resultPreview, { source: 'summary' })
assert.equal(matchesActionStatusFilter(conflicting, 'running'), false)
assert.equal(matchesActionStatusFilter(conflicting, 'succeeded'), true)

const runtimeOnly = {
  runtime: {
    elapsed_time_ms: 25,
    last_goal_status: 'executing',
    last_status_at: 20,
    observed_goal_count: 1,
    result_status: 'pending',
  },
}
const running = actionPresentation(runtimeOnly)
assert.equal(running.goalStatus, 'executing')
assert.equal(running.isRunning, true)
assert.equal(running.feedbackWaiting, true)
assert.equal(running.executionTimeMs, 25)
assert.equal(matchesActionStatusFilter(runtimeOnly, 'running'), true)

const unobserved = actionPresentation({ runtime: { last_goal_status: 'unknown', observed_goal_count: 0 } })
assert.equal(unobserved.goalStatus, 'goal_unobserved')
assert.equal(unobserved.goalUnobserved, true)
assert.equal(matchesActionStatusFilter({ runtime: { last_goal_status: 'unknown' } }, 'unobserved'), true)

const failed = {
  last_goal_summary: {
    error_type: 'validation_error',
    last_goal_status: 'goal_rejected',
  },
  runtime: { last_goal_status: 'executing', result_status: 'success' },
}
assert.equal(actionPresentation(failed).isFailedOrCanceled, true)
assert.equal(matchesActionStatusFilter(failed, 'failed'), true)
assert.equal(matchesActionStatusFilter(failed, 'succeeded'), false)

const inconsistentSuccess = {
  last_goal_summary: {
    last_goal_status: 'succeeded',
    last_result_preview: { success: false },
    success: false,
  },
}
assert.equal(actionPresentation(inconsistentSuccess).result.value, 'failed')
assert.equal(actionPresentation(inconsistentSuccess).isSucceeded, false)
assert.equal(actionPresentation(inconsistentSuccess).isFailedOrCanceled, true)

console.log('Action presentation tests passed')
