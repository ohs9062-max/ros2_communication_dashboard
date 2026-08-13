export function compactDataPreview(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  try {
    return JSON.stringify(value) ?? '-'
  } catch {
    return String(value)
  }
}

export function fullDataPreview(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2) ?? '-'
  } catch {
    return String(value)
  }
}
