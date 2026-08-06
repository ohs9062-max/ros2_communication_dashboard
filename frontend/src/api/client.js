export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

async function fetchWithConnectionError(input, init) {
  try {
    return await globalThis.fetch(input, init)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`백엔드 서버에 연결할 수 없습니다. 서버 실행 상태와 API 주소(${API_BASE_URL})를 확인한 뒤 다시 시도하세요.`)
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
  const url = new URL(API_BASE_URL, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws/monitor'
  url.search = ''
  url.hash = ''
  return url.toString()
}
