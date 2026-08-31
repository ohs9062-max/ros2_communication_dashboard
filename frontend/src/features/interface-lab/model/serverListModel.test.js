import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mergeRunningServers,
  runningServerStopPayload,
  stopRunningServer,
} from './serverListModel.js'

test('merges Service and Action status into exact Domain-scoped rows', () => {
  const rows = mergeRunningServers([
    { domain_id: 99, service_name: '/RobotControl', service_type: 'demo/srv/RobotControl' },
    { domain_id: 99, service_name: '/ScheduleCrud', service_type: 'demo/srv/ScheduleCrud' },
    { domain_id: 4, service_name: '/RobotControl', service_type: 'demo/srv/RobotControl' },
  ], [
    { domain_id: 99, action_name: '/action_a', action_type: 'demo/action/Test' },
    { domain_id: 99, action_name: '/action_b', action_type: 'demo/action/Test' },
  ])

  assert.equal(rows.length, 5)
  assert.deepEqual(rows.map((row) => [row.kindLabel, row.domainId, row.name]), [
    ['Service', 4, '/RobotControl'],
    ['Action', 99, '/action_a'],
    ['Action', 99, '/action_b'],
    ['Service', 99, '/RobotControl'],
    ['Service', 99, '/ScheduleCrud'],
  ])
  assert.notEqual(rows[0].identityKey, rows[3].identityKey)
})

test('routes exact Service and Action rows to their existing Stop payload contracts', async () => {
  const calls = []
  const dependencies = {
    stopAction: async (payload) => calls.push(['action', payload]),
    stopService: async (payload) => calls.push(['service', payload]),
  }
  const [service] = mergeRunningServers([
    { domain_id: 99, service_name: '/RobotControl', service_type: 'demo/srv/RobotControl' },
  ], [])
  const [action] = mergeRunningServers([], [
    { domain_id: 4, action_name: '/CanControl', action_type: 'demo/action/CanControl' },
  ])

  await stopRunningServer(service, dependencies)
  await stopRunningServer(action, dependencies)

  assert.deepEqual(calls, [
    ['service', runningServerStopPayload(service)],
    ['action', runningServerStopPayload(action)],
  ])
  assert.deepEqual(calls[0][1], {
    domain_id: 99,
    service_name: '/RobotControl',
    service_type: 'demo/srv/RobotControl',
  })
  assert.deepEqual(calls[1][1], {
    action_name: '/CanControl',
    action_type: 'demo/action/CanControl',
    domain_id: 4,
  })
})
