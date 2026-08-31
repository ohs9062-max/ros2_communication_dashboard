export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')

function apiDisplayUrl() {
  return API_BASE_URL || window.location.origin
}

async function fetchWithConnectionError(input, init) {
  try {
    return await globalThis.fetch(input, init)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Could not connect to the Backend. Check the server and API address (${apiDisplayUrl()}), then try again.`)
    }
    throw error
  }
}

export async function requestJson(path, init) {
  const response = await fetchWithConnectionError(`${API_BASE_URL}${path}`, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || `HTTP ${response.status}`)
  }
  return payload
}

export function requestWithJsonBody(path, method, payload) {
  return requestJson(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function monitorWebSocketUrl() {
  const url = new URL(API_BASE_URL || window.location.origin, window.location.origin)
  url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  if (!API_BASE_URL) {
    url.host = window.location.host
  }
  url.pathname = '/ws/monitor'
  url.search = ''
  url.hash = ''
  return url.toString()
}
