export const DEFAULT_MANUAL_QOS = Object.freeze({
  reliability: 'reliable',
  durability: 'volatile',
  history: 'keep_last',
  depth: 10,
})

export function createManualQos() {
  return { ...DEFAULT_MANUAL_QOS }
}

export function topicQosSelection(mode, profile) {
  return mode === 'manual'
    ? { mode, profile: { ...profile, depth: Number(profile.depth) } }
    : { mode: 'auto' }
}

export function serviceQosSelection(requestMode, requestProfile, responseMode, responseProfile) {
  return {
    request: topicQosSelection(requestMode, requestProfile),
    response: topicQosSelection(responseMode, responseProfile),
  }
}

export function actionQosSelection(channels) {
  return Object.fromEntries(
    Object.entries(channels).map(([key, channel]) => [
      key,
      topicQosSelection(channel.qosMode, channel.qosProfile),
    ]),
  )
}
