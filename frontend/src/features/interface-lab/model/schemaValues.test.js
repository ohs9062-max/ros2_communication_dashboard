import assert from 'node:assert/strict'
import test from 'node:test'

import {
  defaultValue,
  defaultValues,
  isArrayType,
  isComplexType,
  isCustomType,
  isNumericType,
  normalizeNumericValues,
  schemaFields,
} from './schemaValues.js'
import {
  defaultFieldValue,
  defaultRequestValues,
  domainIdFromResource,
  executionCandidateForTarget,
  executionResourceOptions,
  normalizeNumericValues as normalizeLegacyNumericValues,
} from './interfaceUploadModel.js'
import { graphPublishTopicCandidates } from '../../../utils/interfaceTopics.js'

test('classifies primitive, array, sequence, and custom ROS2 field types', () => {
  assert.equal(isNumericType('float64'), true)
  assert.equal(isNumericType('string'), false)
  assert.equal(isArrayType('uint8[]'), true)
  assert.equal(isArrayType('sequence<string>'), true)
  assert.equal(isCustomType('geometry_msgs/msg/Twist'), true)
  assert.equal(isCustomType('geometry_msgs/Twist'), true)
  assert.equal(isComplexType('geometry_msgs/msg/Twist'), true)
  assert.equal(isComplexType('string'), false)
})

test('creates schema defaults without type or field-name special cases', () => {
  const schema = [
    { name: 'enabled', type: 'bool' },
    { name: 'count', type: 'int32' },
    { name: 'labels', type: 'string[]' },
    { name: 'pose', type: 'geometry_msgs/msg/Pose' },
    { name: 'title', type: 'string' },
    { type: 'float64' },
  ]

  assert.deepEqual(defaultValues(schema), {
    enabled: false,
    count: 0,
    labels: [],
    pose: {},
    title: '',
  })
  assert.deepEqual(defaultValue('sequence<uint8>'), [])
})

test('normalizes only non-empty numeric schema values', () => {
  const values = {
    count: '12',
    ratio: '',
    label: '12',
    nested: { value: 3 },
  }
  const schema = [
    { name: 'count', type: 'int32' },
    { name: 'ratio', type: 'float64' },
    { name: 'label', type: 'string' },
    { name: 'nested', type: 'example_interfaces/msg/Nested' },
  ]

  assert.deepEqual(normalizeNumericValues(values, schema), {
    count: 12,
    ratio: '',
    label: '12',
    nested: { value: 3 },
  })
})

test('treats a non-array schema as empty', () => {
  assert.deepEqual(schemaFields(null), [])
  assert.deepEqual(defaultValues({}), {})
})

test('keeps the existing interfaceUploadModel schema helper contract', () => {
  const schema = [{ name: 'count', type: 'int32' }]

  assert.equal(defaultFieldValue('int32'), 0)
  assert.deepEqual(defaultRequestValues(schema), { count: 0 })
  assert.deepEqual(normalizeLegacyNumericValues({ count: '7' }, schema), { count: 7 })
})

test('takes a monitored Domain only from the selected resource identity', () => {
  assert.equal(domainIdFromResource({ resource_key: '2:/add_two_ints', domain_id: 99 }), 2)
  assert.equal(domainIdFromResource({ domain_id: 7 }), 7)
  assert.equal(domainIdFromResource({ resource_key: 'invalid:/add', domain_id: undefined }), null)
  assert.equal(domainIdFromResource({ resource_key: '233:/outside' }), null)
})

test('resolves a grouped callable to the exact Graph resource target', () => {
  const grouped = {
    resource_candidates: [
      { action_name: '/work', action_type: 'demo/action/Work', domain_id: 0, resource_key: '0:/work' },
      { action_name: '/work', action_type: 'demo/action/Work', domain_id: 2, resource_key: '2:/work' },
    ],
  }
  assert.equal(
    executionCandidateForTarget(grouped, {
      domainId: 2, fullType: 'demo/action/Work', name: '/work', resourceKey: '2:/work',
    }, 'action_name', 'action_type'),
    grouped.resource_candidates[1],
  )
})

test('builds one Service execution option and drops Domain placeholders', () => {
  const options = executionResourceOptions([
    { service_name: '', service_type: 'demo/srv/Read', domain_id: 0, callable: false },
    { service_name: '', service_type: 'demo/srv/Read', domain_id: 1, callable: false },
    {
      service_name: '/read', service_type: 'demo/srv/Read', domain_id: 2,
      resource_key: '2:/read', callable: true, server_count: 1,
    },
    { service_name: '', service_type: 'demo/srv/Read', domain_id: 3, callable: false },
    { service_name: '', service_type: 'demo/srv/Read', domain_id: 99, callable: false },
  ], 'service_name', 'service_type')

  assert.equal(options.length, 1)
  assert.equal(options[0].resource_key, '2:/read')
  assert.equal(options[0].resource_candidates.length, 1)
})

test('keeps same Action in multiple Domains as separate actual resource options', () => {
  const options = executionResourceOptions([
    {
      action_name: '/work', action_type: 'demo/action/Work', domain_id: 0,
      resource_key: '0:/work', callable: true, server_count: 1,
    },
    {
      action_name: '/work', action_type: 'demo/action/Work', domain_id: 2,
      resource_key: '2:/work', callable: true, server_count: 1,
    },
  ], 'action_name', 'action_type')

  assert.equal(options.length, 2)
  assert.deepEqual(options.map((option) => option.resource_key), ['0:/work', '2:/work'])
  assert.equal(options[0].resource_candidates.length, 2)
  assert.equal(options[1].resource_candidates.length, 2)
})

test('keeps only currently present Domain-specific Topic Graph candidates', () => {
  const candidates = graphPublishTopicCandidates([
    { name: '/cmd_vel', type: 'geometry_msgs/msg/Twist', domain_id: 0, resource_key: '0:/cmd_vel', graph_present: true },
    { name: '/cmd_vel', type: 'geometry_msgs/msg/Twist', domain_id: 1, resource_key: '1:/cmd_vel', graph_present: false },
    { name: '/cmd_vel', type: 'geometry_msgs/msg/Twist', domain_id: 99, resource_key: '99:/cmd_vel', graph_present: true },
    { name: '/other', type: 'std_msgs/msg/String', domain_id: 2, resource_key: '2:/other', graph_present: true },
  ], 'geometry_msgs/msg/Twist')

  assert.deepEqual(candidates.map((topic) => topic.resource_key), ['0:/cmd_vel', '99:/cmd_vel'])
})
