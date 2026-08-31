import assert from 'node:assert/strict'

import { diagnoseAlert, diagnoseAlertLocally } from './monitoring.js'

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

  assert.deepEqual(requests.map(({ path }) => path), [
    '/ros/alerts/ai-diagnosis',
    '/ros/alerts/ai-diagnosis',
    '/ros/alerts/ai-diagnosis/local',
    '/ros/alerts/ai-diagnosis/local',
  ])
  assert.deepEqual(requests.map(({ options }) => JSON.parse(options.body)), [
    { alert },
    { alert, alternate: true },
    { alert },
    { alert, alternate: true },
  ])
} finally {
  globalThis.fetch = originalFetch
}

console.log('Alert AI API mapping tests passed')
