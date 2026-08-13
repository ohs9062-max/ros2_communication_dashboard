import assert from 'node:assert/strict'
import test from 'node:test'

import {
  centeredScrollPosition,
  isCameraTopicType,
  nextCameraZoom,
} from './cameraPreviewModel.js'

test('calculates the horizontal and vertical center of an overflowing image', () => {
  assert.deepEqual(centeredScrollPosition({
    clientHeight: 400,
    clientWidth: 600,
    scrollHeight: 800,
    scrollWidth: 1200,
  }), { left: 300, top: 200 })
})

test('keeps scroll at zero when the image fits inside the viewport', () => {
  assert.deepEqual(centeredScrollPosition({
    clientHeight: 800,
    clientWidth: 1200,
    scrollHeight: 400,
    scrollWidth: 600,
  }), { left: 0, top: 0 })
})

test('clamps Camera zoom to the existing 25-400 percent range', () => {
  assert.equal(nextCameraZoom(25, -25), 25)
  assert.equal(nextCameraZoom(100, 25), 125)
  assert.equal(nextCameraZoom(400, 25), 400)
})

test('recognizes only the supported ROS2 Camera Topic types', () => {
  assert.equal(isCameraTopicType('sensor_msgs/msg/Image'), true)
  assert.equal(isCameraTopicType('sensor_msgs/msg/CompressedImage'), true)
  assert.equal(isCameraTopicType('sensor_msgs/msg/LaserScan'), false)
})
