const ACTION_QOS_CHANNELS = new Set([
  'goal',
  'result',
  'cancel',
  'feedback',
  'status',
])

export function qosAlertChannel(alert) {
  if (ACTION_QOS_CHANNELS.has(alert?.channel)) return alert.channel
  if (alert?.code !== 'action_qos_incompatible') return null
  const channel = String(alert.id ?? alert.alert_key ?? '').split(':').at(-1)
  return ACTION_QOS_CHANNELS.has(channel) ? channel : null
}
