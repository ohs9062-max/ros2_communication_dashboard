export const ACTIVE_LOCAL_MODEL_STATES = new Set(['preparing', 'downloading', 'verifying'])

export function localModelNextAction(status) {
  if (!status?.ollama_available) return 'runtime-unavailable'
  if (status.model_installed) return 'analyze'
  if (ACTIVE_LOCAL_MODEL_STATES.has(status.download_state)) return 'poll'
  if (status.download_state === 'failed') return 'retry'
  return 'prompt-download'
}

export function localModelResumeAction(intent, status) {
  if (
    !intent
    || !status?.model_installed
    || status.download_state !== 'completed'
  ) return null
  return intent.alternate ? 'alternate' : 'default'
}

export function localModelProgressLabel(status) {
  const completed = formatBytes(status?.completed)
  const total = formatBytes(status?.total)
  return completed && total ? `${completed} / ${total}` : ''
}

export function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let amount = value
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }
  const digits = unit === 0 || amount >= 10 ? 0 : 1
  return `${amount.toFixed(digits)} ${units[unit]}`
}
