import assert from 'node:assert/strict'
import test from 'node:test'

import {
  configuredServerDomainIds,
  findExactServer,
  serverTypesForDomain,
  suggestServerResourceName,
} from './serverSelection.js'

test('uses only configured Domain IDs from the Domains API', () => {
  assert.deepEqual(configuredServerDomainIds({
    data: { configured_domain_ids: [99, 2, 2, 0] },
  }), [0, 2, 99])
})

test('shows only importable server types for the selected Domain', () => {
  const items = [
    { domain_id: 2, service_type: 'demo/srv/B', import_available: true, server_creatable: true },
    { domain_id: 2, service_type: 'demo/srv/A', import_available: true, server_creatable: true },
    { domain_id: 99, service_type: 'demo/srv/A', import_available: true, server_creatable: true },
    { domain_id: 2, service_type: 'demo/srv/C', import_available: false, server_creatable: false },
  ]
  assert.deepEqual(
    serverTypesForDomain(items, 2, 'service_type').map((item) => item.service_type),
    ['demo/srv/A', 'demo/srv/B'],
  )
})

test('prefers an existing matching Graph name and otherwise derives the interface name', () => {
  const resources = [{
    action_name: '/device_control', action_type: 'demo/action/Control', domain_id: 99,
  }]
  assert.equal(suggestServerResourceName({
    domainId: 99, nameField: 'action_name', resources,
    resourceType: 'demo/action/Control', typeField: 'action_type',
  }), '/device_control')
  assert.equal(suggestServerResourceName({
    domainId: 2, nameField: 'action_name', resources,
    resourceType: 'demo/action/Control', typeField: 'action_type',
  }), '/Control')
})

test('keeps multiple Service servers active and resolves only the exact selected identity', () => {
  const servers = [
    { domain_id: 99, service_name: '/RobotControl', service_type: 'demo/srv/RobotControl' },
    { domain_id: 99, service_name: '/ScheduleCrud', service_type: 'demo/srv/ScheduleCrud' },
    { domain_id: 1, service_name: '/RobotControl', service_type: 'demo/srv/RobotControl' },
  ]
  const fields = { nameField: 'service_name', typeField: 'service_type' }

  assert.equal(findExactServer(servers, {
    domainId: 99, name: '/RobotControl', type: 'demo/srv/RobotControl',
  }, fields), servers[0])
  assert.equal(findExactServer(servers, {
    domainId: 99, name: '/ScheduleCrud', type: 'demo/srv/ScheduleCrud',
  }, fields), servers[1])
  assert.equal(findExactServer(servers, {
    domainId: 1, name: '/RobotControl', type: 'demo/srv/RobotControl',
  }, fields), servers[2])
  assert.equal(findExactServer(servers, {
    domainId: 99, name: '/Pending', type: 'demo/srv/RobotControl',
  }, fields), undefined)
})

test('keeps multiple Action servers active and resolves only the exact selected identity', () => {
  const servers = [
    { domain_id: 99, action_name: '/action_a', action_type: 'demo/action/Test' },
    { domain_id: 99, action_name: '/action_b', action_type: 'demo/action/Test' },
    { domain_id: 1, action_name: '/action_a', action_type: 'demo/action/Test' },
  ]
  const fields = { nameField: 'action_name', typeField: 'action_type' }

  assert.equal(findExactServer(servers, {
    domainId: 99, name: '/action_a', type: 'demo/action/Test',
  }, fields), servers[0])
  assert.equal(findExactServer(servers, {
    domainId: 99, name: '/action_b', type: 'demo/action/Test',
  }, fields), servers[1])
  assert.equal(findExactServer(servers, {
    domainId: 1, name: '/action_a', type: 'demo/action/Test',
  }, fields), servers[2])
  assert.equal(findExactServer(servers, {
    domainId: 99, name: '/action_c', type: 'demo/action/Test',
  }, fields), undefined)
})
