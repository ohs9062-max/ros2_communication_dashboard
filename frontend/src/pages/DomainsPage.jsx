import { useMemo, useState } from 'react'
import { addDomain, fetchDomains, removeDomain } from '../api/rosApi.js'
import { DASHBOARD_POLL_INTERVAL_MS } from '../config/polling.js'
import { usePolling } from '../hooks/usePolling.js'

export function DomainsPage() {
  const domains = usePolling(fetchDomains, DASHBOARD_POLL_INTERVAL_MS, {
    initialData: { data: {} },
  })
  const [input, setInput] = useState('')
  const [applyError, setApplyError] = useState('')
  const [applying, setApplying] = useState(false)
  const data = domains.data?.data ?? {}
  const configuredDomainIds = useMemo(
    () => Array.isArray(data.configured_domain_ids) ? data.configured_domain_ids : [],
    [data.configured_domain_ids],
  )
  const activeDomainIds = useMemo(
    () => Array.isArray(data.active_domain_ids) ? data.active_domain_ids : [],
    [data.active_domain_ids],
  )
  const resourceCountsByDomain = useMemo(
    () => new Map(
      (Array.isArray(data.resource_counts) ? data.resource_counts : [])
        .filter((item) => Number.isInteger(item?.domain_id))
        .map((item) => [item.domain_id, item]),
    ),
    [data.resource_counts],
  )

  const add = async () => {
    const value = Number(input.trim())
    if (!Number.isInteger(value) || value < 0 || value > 232) {
      setApplyError('ROS Domain ID는 0~232 정수여야 합니다.')
      return
    }
    if (configuredDomainIds.includes(value)) {
      setApplyError(`Domain ${value}는 이미 감시 중입니다.`)
      return
    }
    setApplying(true)
    setApplyError('')
    try {
      await addDomain(value)
      setInput('')
      await domains.refresh()
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : 'Domain 설정을 저장하지 못했습니다.')
    } finally {
      setApplying(false)
    }
  }
  const remove = async (domainId) => {
    setApplying(true)
    setApplyError('')
    try {
      await removeDomain(domainId)
      await domains.refresh()
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : 'Domain runtime을 종료하지 못했습니다.')
    } finally { setApplying(false) }
  }

  const domainIds = [...new Set([...configuredDomainIds, ...activeDomainIds])]
    .sort((left, right) => left - right)

  return (
    <main className="domains-page">
      <section className="page-intro">
        <p className="eyebrow">ROS Domains</p>
        <h2>Domain 감시 설정</h2>
        <p className="muted">
          저장한 Domain ID마다 독립 rclpy Context를 만들고 실제 runtime 상태를 표시합니다.
        </p>
      </section>

      <div className="domains-summary" aria-label="Domain 감시 요약">
        <div className="domains-summary-item">
          <span>등록 Domain</span>
          <strong>{configuredDomainIds.length}</strong>
        </div>
        <div className="domains-summary-item good">
          <span>감시 중 Domain</span>
          <strong>{activeDomainIds.length}</strong>
        </div>
      </div>

      <section className="topic-section domains-card">
        <div className="section-heading">
          <div>
            <h2>ROS Domain IDs</h2>
            <p className="muted">하나의 ID를 추가하면 해당 Domain runtime을 즉시 시작합니다.</p>
          </div>
        </div>
        <div className="domains-form">
          <label htmlFor="domain-ids">ROS Domain ID</label>
          <div className="domains-input-row">
            <input
              id="domain-ids"
              inputMode="numeric"
              onChange={(event) => { setInput(event.target.value); setApplyError('') }}
              placeholder="0"
              value={input}
            />
            <button disabled={applying} onClick={add} type="button">
              {applying ? '처리 중…' : '추가'}
            </button>
          </div>
          {applyError && <p className="error-text">{applyError}</p>}
          <p className="detail-help-text">
            적용하면 추가 Domain runtime은 시작하고, 제거한 Domain runtime은 종료합니다.
          </p>
        </div>
      </section>

      <section className="topic-section domains-card">
        <div className="section-heading">
          <div>
            <h2>감시 중 Domain</h2>
            <p className="muted">현재 Monitor snapshot에서 확인한 실제 Domain별 rclpy runtime 상태입니다.</p>
          </div>
        </div>
        {domains.error && <p className="error-text domains-message">{domains.error}</p>}
        {!domains.error && domainIds.length === 0 && (
          <p className="muted domains-message">저장되었거나 실제 감시 중인 Domain이 없습니다.</p>
        )}
        {!domains.error && domainIds.length > 0 && (
          <div className="domains-list">
            <div className="domains-table-header" role="row">
              <span>Domain</span>
              <span>상태</span>
              <span>발견된 리소스</span>
              <span>관리</span>
            </div>
            {domainIds.map((domainId) => {
              const runtime = (data.runtime_domains ?? []).find((item) => item.domain_id === domainId)
              const resourceCounts = resourceCountsByDomain.get(domainId)
              const active = activeDomainIds.includes(domainId)
              const status = active && runtime?.status === 'monitoring'
                ? { label: '감시 중', tone: 'good' }
                : active
                  ? { label: runtimeStatusLabel(runtime?.status), tone: 'warn' }
                  : { label: '시작 대기', tone: 'muted' }
              return (
                <div className="domains-row" key={domainId}>
                  <strong>D{domainId}</strong>
                  <span className={`domains-status ${status.tone}`}>
                    <span className="dot" />
                    {status.label}
                  </span>
                  <div className="domains-resources">
                    <ResourceCountsList counts={resourceCounts} />
                  </div>
                  <button disabled={applying} onClick={() => remove(domainId)} type="button">삭제</button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function ResourceCountsList({ counts }) {
  const values = [
    ['Topic', counts?.topics ?? 0],
    ['Service', counts?.services ?? 0],
    ['Action', counts?.actions ?? 0],
    ['Node', counts?.nodes ?? 0],
  ]
  return (
    <div className="domains-resources-list">
      {values.map(([label, count]) => (
        <span className="domains-resource-item" key={label}>
          <span>{label}</span>
          <strong>{count}</strong>
        </span>
      ))}
    </div>
  )
}

function runtimeStatusLabel(status) {
  if (status === 'stopped') return '중지됨'
  if (status === 'unavailable') return '상태 확인 불가'
  return '시작 중'
}
