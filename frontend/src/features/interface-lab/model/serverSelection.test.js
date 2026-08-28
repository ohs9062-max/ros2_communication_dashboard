import assert from 'node:assert/strict'
import test from 'node:test'

import {
  configuredServerDomainIds,
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
