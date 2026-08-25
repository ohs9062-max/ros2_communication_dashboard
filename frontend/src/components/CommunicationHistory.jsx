import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchActionHistory,
  fetchServiceHistory,
  fetchTopicHistory,
} from '../api/rosApi.js'
import {
  buildHistoryRows,
  formatHistoryTime,
} from '../features/communication-history/communicationHistory.js'

export function CommunicationHistory({ kind, name, resourceType }) {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const requestId = useRef(0)
  const rows = useMemo(() => buildHistoryRows(items, kind), [items, kind])

  useEffect(() => {
    requestId.current += 1
    setItems([])
    setMeta({})
    setError('')
    setLoaded(false)
    setLoading(false)
  }, [kind, name, resourceType])

  async function load() {
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    setLoading(true)
    setError('')
    try {
      const payload = await historyFetcher(kind)(name, resourceType)
      if (requestId.current !== currentRequest) return
      setItems(Array.isArray(payload.data) ? payload.data : [])
      setMeta(payload.meta ?? {})
      setLoaded(true)
    } catch (loadError) {
      if (requestId.current !== currentRequest) return
      setError(loadError.message)
      setLoaded(true)
    } finally {
      if (requestId.current === currentRequest) setLoading(false)
    }
  }

  function handleToggle(event) {
    if (event.currentTarget.open && !loaded && !loading) load()
  }

  return (
    <details className="detail-section detail-section-collapsible communication-history" onToggle={handleToggle}>
      <summary>최근 데이터 로그 {loaded ? `(${items.length})` : ''}</summary>
      <div className="detail-section-body">
        <div className="communication-history-heading">
          <p className="detail-help-text">{historySourceText(kind)}</p>
          <button disabled={loading} onClick={load} type="button">
            {loading ? '불러오는 중…' : '새로고침'}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && loaded && items.length === 0 && (
          <p className="muted">아직 기록된 통신 데이터가 없습니다.</p>
        )}
        {items.length > 0 && (
          <div aria-label="최근 통신 데이터" className="communication-history-stream" role="log">
            {rows.map((row) => (
              <article className="communication-history-entry" key={row.key}>
                <header>
                  <time>[{formatHistoryTime(row.timestamp)}]</time>
                  <strong>{row.status}</strong>
                </header>
                <pre>{row.formattedPayload}</pre>
              </article>
            ))}
          </div>
        )}
        {loaded && <p className="detail-help-text">메모리 보존 한도: {meta.limit ?? items.length}개</p>}
      </div>
    </details>
  )
}

function historyFetcher(kind) {
  if (kind === 'topic') return (name) => fetchTopicHistory(name)
  if (kind === 'service') return fetchServiceHistory
  return fetchActionHistory
}

function historySourceText(kind) {
  if (kind === 'topic') return 'Monitor가 실제 수신한 Topic 데이터입니다.'
  if (kind === 'service') return 'Dashboard Interface Lab에서 실행한 Service Call 이력만 표시합니다.'
  return 'Dashboard Interface Lab에서 실행한 Action Goal 이력만 표시합니다.'
}
