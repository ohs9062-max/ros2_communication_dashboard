import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchActionHistory,
  fetchServiceHistory,
  fetchTopicHistory,
} from '../api/rosApi.js'
import { TOPIC_POLL_INTERVAL_MS } from '../config/polling.js'
import {
  buildHistoryRows,
  formatHistoryTime,
} from '../features/communication-history/communicationHistory.js'

export function CommunicationHistory({ embedded = false, kind, name, resourceType, domainId }) {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const requestId = useRef(0)
  const requestInFlight = useRef(false)
  const rows = useMemo(() => buildHistoryRows(items, kind), [items, kind])

  useEffect(() => {
    requestId.current += 1
    setItems([])
    setMeta({})
    setError('')
    setLoaded(false)
    setLoading(false)
  }, [domainId, kind, name, resourceType])

  const load = useCallback(async ({ background = false } = {}) => {
    if (requestInFlight.current) return

    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    requestInFlight.current = true
    if (!background) setLoading(true)
    setError('')
    try {
      const payload = await historyFetcher(kind)(name, resourceType, domainId)
      if (requestId.current !== currentRequest) return
      setItems(Array.isArray(payload.data) ? payload.data : [])
      setMeta(payload.meta ?? {})
      setLoaded(true)
    } catch (loadError) {
      if (requestId.current !== currentRequest) return
      setError(loadError.message)
      setLoaded(true)
    } finally {
      requestInFlight.current = false
      if (requestId.current === currentRequest && !background) setLoading(false)
    }
  }, [domainId, kind, name, resourceType])

  useEffect(() => {
    if (!embedded && !isOpen) return undefined

    load()
    const timer = window.setInterval(
      () => load({ background: true }),
      TOPIC_POLL_INTERVAL_MS,
    )
    return () => window.clearInterval(timer)
  }, [embedded, isOpen, load])

  function handleToggle(event) {
    setIsOpen(event.currentTarget.open)
  }

  const content = (
    <>
      {!embedded && <p className="detail-help-text">{historySourceText(kind)}</p>}
      <button disabled={loading} onClick={() => load()} type="button">
        {loading ? '불러오는 중…' : '새로고침'}
      </button>
    </>
  )

  const entries = (
    <>
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
    </>
  )

  if (embedded) {
    return (
      <section className="communication-history communication-history-embedded">
        <div className="communication-history-heading">
          <strong>최근 데이터 로그 {loaded ? `(${items.length})` : ''}</strong>
          {content}
        </div>
        {entries}
      </section>
    )
  }

  return (
    <details className="detail-section detail-section-collapsible communication-history" onToggle={handleToggle}>
      <summary>최근 데이터 로그 {loaded ? `(${items.length})` : ''}</summary>
      <div className="detail-section-body">
        <div className="communication-history-heading">
          {content}
        </div>
        {entries}
      </div>
    </details>
  )
}

function historyFetcher(kind) {
  if (kind === 'topic') return (name, _type, domainId) => fetchTopicHistory(name, 100, domainId)
  if (kind === 'service') {
    return (name, serviceType, domainId) => fetchServiceHistory(name, serviceType, 30, domainId)
  }
  return (name, actionType, domainId) => fetchActionHistory(name, actionType, 100, domainId)
}

function historySourceText(kind) {
  if (kind === 'topic') return 'Monitor가 실제 수신한 Topic 데이터입니다.'
  if (kind === 'service') return 'Dashboard Interface Lab에서 실행한 Service Call 이력만 표시합니다.'
  return 'Interface Lab Goal과 Monitor가 실제 관찰한 Feedback, Status, Result를 표시합니다. 외부 Goal payload와 거절 응답은 관찰할 수 없습니다.'
}
