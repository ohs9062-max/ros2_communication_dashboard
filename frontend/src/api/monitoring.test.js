import assert from 'node:assert/strict'

import {
  diagnoseAlert,
  diagnoseAlertLocally,
  fetchLocalAiModelStatus,
  startLocalAiModelDownload,
} from './monitoring.js'

const requests = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (path, options) => {
  requests.push({ path, options })
  return {
    ok: true,
    json: async () => ({ success: true, data: {} }),
  }
}

try {
  const alert = { id: 'alert-1' }
  await diagnoseAlert(alert)
  await diagnoseAlert(alert, { alternate: true })
  await diagnoseAlertLocally(alert)
  await diagnoseAlertLocally(alert, { alternate: true })
  await fetchLocalAiModelStatus()
  await startLocalAiModelDownload()

  assert.deepEqual(requests.map(({ path }) => path), [
    '/ros/alerts/ai-diagnosis',
    '/ros/alerts/ai-diagnosis',
    '/ros/alerts/ai-diagnosis/local',
    '/ros/alerts/ai-diagnosis/local',
    '/ros/alerts/ai-diagnosis/local/model',
    '/ros/alerts/ai-diagnosis/local/model',
  ])
  assert.deepEqual(requests.slice(0, 4).map(({ options }) => JSON.parse(options.body)), [
    { alert },
    { alert, alternate: true },
    { alert },
    { alert, alternate: true },
  ])
  assert.equal(requests[4].options, undefined)
  assert.equal(requests[5].options.method, 'POST')
} finally {
  globalThis.fetch = originalFetch
}

console.log('Alert AI API mapping tests passed')
