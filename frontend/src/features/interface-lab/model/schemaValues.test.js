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
  normalizeNumericValues as normalizeLegacyNumericValues,
} from './interfaceUploadModel.js'

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
