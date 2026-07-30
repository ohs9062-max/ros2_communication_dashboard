export function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : fallback
}

export const TOPIC_POLL_INTERVAL_MS = parsePositiveInt(
  import.meta.env?.VITE_TOPIC_POLL_INTERVAL_MS,
  1000,
)

export const DASHBOARD_POLL_INTERVAL_MS = parsePositiveInt(
  import.meta.env?.VITE_DASHBOARD_POLL_INTERVAL_MS,
  3000,
)

export const VISUALIZATION_POLL_INTERVAL_MS = parsePositiveInt(
  import.meta.env?.VITE_VISUALIZATION_POLL_INTERVAL_MS,
  5000,
)
