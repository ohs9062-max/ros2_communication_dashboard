import { useEffect } from 'react'

import { displayText } from '../utils/displayText.js'
import { formatTime } from '../utils/format.js'

export function AlertDetailModal({
  aiAnalysis,
  aiError,
  aiLoading,
  alert,
  currentResource,
  onAnalyze,
  onClose,
}) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const runtimeSummary = alertRuntimeSummary(alert, currentResource)
  const analyzeButtonLabel = aiLoading
    ? '분석 중...'
    : aiError
      ? '분석 재시도'
      : aiAnalysis
        ? '다시 분석'
        : 'AI 분석'

  return (
    <div
      aria-label="Alert 상세"
      aria-modal="true"
      className="preview-modal-backdrop alert-detail-modal-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <section
        className="preview-modal alert-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="preview-modal-header alert-detail-modal-header">
          <div>
            <strong>Alert 상세</strong>
            <span>{alert.name}</span>
          </div>
          <button
            aria-label="Alert 상세 닫기"
            className="preview-modal-close"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </header>

        <div className="alert-detail-grid">
          <div className="alert-detail-column">
            <section className="alert-detail-section">
              <h3>Alert 정보</h3>
              <dl className="alert-detail-list">
                <dt>상태</dt><dd>{alert.alert_state === 'resolved' ? '해결됨' : '발생 중'}</dd>
                <dt>레벨</dt><dd>{displayText(alert.level)}</dd>
                <dt>종류</dt><dd>{displayText(alert.source)}</dd>
                <dt>코드</dt><dd>{alert.code}</dd>
                <dt>메시지</dt><dd>{alert.message}</dd>
                <dt>감지 시각</dt><dd>{formatTime(alert.first_detected_at ?? alert.detected_at)}</dd>
                <dt>해결 시각</dt><dd>{alert.resolved_at ? formatTime(alert.resolved_at) : '-'}</dd>
              </dl>
            </section>

            <section className="alert-detail-section">
              <h3>현재 통신 상태</h3>
              <p className="muted alert-runtime-note">
                현재 Monitor 상태이며 Alert 발생 당시 상태와 다를 수 있습니다.
              </p>
              {runtimeSummary ? (
                <pre className="alert-runtime-json">{JSON.stringify(runtimeSummary, null, 2)}</pre>
              ) : (
                <p className="muted">현재 Runtime에서 일치하는 resource를 찾지 못했습니다.</p>
              )}
            </section>
          </div>

          <section className="alert-detail-section alert-ai-feedback">
            <div className="alert-ai-feedback-heading">
              <div>
                <h3>AI 피드백</h3>
                <p className="muted">제공된 Dashboard 데이터 범위에서 원인과 확인 순서를 분석합니다.</p>
              </div>
              <button
                className="alert-ai-analyze-button"
                disabled={aiLoading}
                onClick={onAnalyze}
                type="button"
              >
                {analyzeButtonLabel}
              </button>
            </div>

            {aiError && <p className="error-text alert-ai-error">{aiError}</p>}
            {!aiAnalysis && !aiError && !aiLoading && (
              <div className="empty-state alert-ai-empty">
                AI 분석 버튼을 누르면 선택한 Alert를 진단합니다.
              </div>
            )}
            {aiLoading && (
              <div className="empty-state alert-ai-empty" aria-live="polite">
                Alert와 현재 통신 데이터를 분석하고 있습니다…
              </div>
            )}
            {aiAnalysis && !aiLoading && (
              <div className="alert-ai-result" aria-live="polite">
                <AnalysisSection title="요약" value={aiAnalysis.summary} />
                <AnalysisSection title="판단 근거" value={aiAnalysis.evidence} />
                <AnalysisSection title="가능한 원인" value={aiAnalysis.likely_causes} />
                <AnalysisSection title="확인 순서" ordered value={aiAnalysis.recommended_checks} />
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}

function AnalysisSection({ ordered = false, title, value }) {
  const items = Array.isArray(value) ? value : []
  return (
    <section>
      <h4>{title}</h4>
      {typeof value === 'string' ? (
        <p>{value}</p>
      ) : items.length ? (
        ordered ? (
          <ol>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ol>
        ) : (
          <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul>
        )
      ) : (
        <p className="muted">현재 정보만으로 확인할 수 없음</p>
      )}
    </section>
  )
}

function alertRuntimeSummary(alert, resource) {
  if (!resource) return null
  const common = pick(resource, ['domain_id', 'resource_key', 'name', 'full_name', 'type', 'types'])
  const fields = {
    topic: [
      'status', 'effective_status', 'graph_present', 'publisher_count',
      'subscriber_count', 'hz', 'last_message_preview', 'last_received_at',
      'qos_status',
    ],
    service: [
      'status', 'graph_present', 'server_count', 'client_count', 'call_status',
      'last_call_summary', 'qos_status',
    ],
    action: [
      'status', 'graph_present', 'server_count', 'client_count',
      'last_goal_summary', 'runtime', 'qos',
    ],
    node: [
      'status', 'graph_present', 'topic_publishers', 'topic_subscribers',
      'service_servers', 'service_clients', 'action_servers', 'action_clients',
    ],
  }[alert.source] ?? []
  return { ...common, ...pick(resource, fields) }
}

function pick(value, keys) {
  return Object.fromEntries(
    keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]),
  )
}
