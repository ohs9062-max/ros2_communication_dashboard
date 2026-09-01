import assert from 'node:assert/strict'

import {
  formatBytes,
  localModelNextAction,
  localModelProgressLabel,
  localModelResumeAction,
} from './localModelFlow.js'

assert.equal(localModelNextAction({ ollama_available: false }), 'runtime-unavailable')
assert.equal(localModelNextAction({ ollama_available: true, model_installed: true }), 'analyze')
assert.equal(localModelNextAction({
  ollama_available: true, model_installed: false, download_state: 'idle',
}), 'prompt-download')
assert.equal(localModelNextAction({
  ollama_available: true, model_installed: false, download_state: 'downloading',
}), 'poll')
assert.equal(localModelNextAction({
  ollama_available: true, model_installed: false, download_state: 'failed',
}), 'retry')
assert.equal(formatBytes(1932735283), '1.8 GB')
assert.equal(localModelProgressLabel({ completed: 1932735283, total: 3113851289 }), '1.8 GB / 2.9 GB')
assert.equal(localModelProgressLabel({ completed: null, total: null }), '')
assert.equal(localModelResumeAction(
  { alertId: 'alert-1', alternate: false },
  { model_installed: true, download_state: 'completed' },
), 'default')
assert.equal(localModelResumeAction(
  { alertId: 'alert-1', alternate: true },
  { model_installed: true, download_state: 'completed' },
), 'alternate')
assert.equal(localModelResumeAction(
  { alertId: 'alert-1', alternate: false },
  { model_installed: false, download_state: 'failed' },
), null)

console.log('Local AI model flow tests passed')
