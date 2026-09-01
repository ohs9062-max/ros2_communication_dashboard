import { useEffect } from 'react'

import { displayText } from '../utils/displayText.js'
import { formatTime } from '../utils/format.js'
import { ACTIVE_LOCAL_MODEL_STATES, localModelProgressLabel } from '../features/alerts/localModelFlow.js'

export function AlertDetailModal({
  analysisProvider,
  alternateAiError,
  alternateAiLoading,
  aiAnalysis,
  aiError,
  aiLoading,
  alert,
  currentResource,
  hasCloudAnalysisCache,
  hasLocalAnalysisCache,
  localAiAnalysis,
  localAiError,
  localAiLoading,
  localModelChecking,
  localModelDialogOpen,
  localModelDownloadPending,
  localModelStatus,
  onAnalyze,
  onAnalyzeAlternative,
  onAnalyzeLocally,
  onClose,
  onCloseLocalModelDialog,
  onDownloadLocalModel,
}) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const runtimeSummary = alertRuntimeSummary(alert, currentResource)
  const alertLevel = String(alert.level ?? '')
  const showingLocalAnalysis = analysisProvider === 'local'
  const displayedAnalysis = showingLocalAnalysis ? localAiAnalysis : aiAnalysis
  const displayedError = showingLocalAnalysis ? localAiError : aiError
  const displayedLoading = showingLocalAnalysis
    ? localAiLoading || localModelChecking
    : aiLoading
  const analyzeButtonLabel = aiLoading
    ? '분석 중...'
    : hasCloudAnalysisCache
      ? '클라우드 결과 보기'
      : 'AI 분석'
  const localAnalyzeButtonLabel = localModelChecking
    ? '모델 확인 중...'
    : localAiLoading
    ? '로컬 분석 중...'
    : hasLocalAnalysisCache
      ? '로컬 결과 보기'
      : '로컬 AI 분석'
  const analysisModel = typeof displayedAnalysis?.model === 'string'
    ? displayedAnalysis.model.trim()
    : ''

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
          <div className="alert-detail-modal-actions">
            <button
              className="preview-modal-close"
              disabled={alternateAiLoading || displayedLoading || !displayedAnalysis}
              onClick={onAnalyzeAlternative}
              type="button"
            >
              {alternateAiLoading ? '다른 관점 분석 중...' : '다른 관점 분석'}
            </button>
            <button
              aria-label="Alert 상세 닫기"
              className="preview-modal-close"
              onClick={onClose}
              type="button"
            >
              닫기
            </button>
          </div>
        </header>

        <div className="alert-detail-grid">
          <div className="alert-detail-column">
            <section className="alert-detail-section">
              <h3>Alert 정보</h3>
              <dl className="alert-detail-list">
                <dt>상태</dt><dd>{alert.alert_state === 'resolved' ? '해결됨' : '발생 중'}</dd>
                <dt>레벨</dt>
                <dd className={`alert-detail-level ${alertLevel.toLowerCase()}`}>{alertLevel}</dd>
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
              <div className="alert-ai-actions">
                <button
                  className="alert-ai-analyze-button"
                  disabled={aiLoading}
                  onClick={onAnalyze}
                  type="button"
                >
                  {analyzeButtonLabel}
                </button>
                <button
                  className="alert-ai-analyze-button"
                  disabled={localAiLoading || localModelChecking}
                  onClick={onAnalyzeLocally}
                  type="button"
                >
                  {localAnalyzeButtonLabel}
                </button>
              </div>
            </div>

            <div className="alert-ai-content">
              {(alternateAiError || displayedError) && (
                <p className="error-text alert-ai-error">{alternateAiError || displayedError}</p>
              )}
              {!displayedAnalysis && !displayedError && !displayedLoading && (
                <div className="empty-state alert-ai-empty">
                  AI 분석 버튼을 누르면 선택한 Alert를 진단합니다.
                </div>
              )}
              {displayedLoading && (
                <div className="empty-state alert-ai-empty" aria-live="polite">
                  Alert와 현재 통신 데이터를 분석하고 있습니다…
                </div>
              )}
              {displayedAnalysis && !displayedLoading && (
                <div className="alert-ai-result" aria-live="polite">
                  <AnalysisSection title="요약" value={displayedAnalysis.summary} />
                  <AnalysisSection title="판단 근거" value={displayedAnalysis.evidence} />
                  <AnalysisSection title="가능한 원인" value={displayedAnalysis.likely_causes} />
                  <AnalysisSection title="확인 순서" ordered value={displayedAnalysis.recommended_checks} />
                </div>
              )}
            </div>
          </section>
        </div>

        {localModelDialogOpen && (
          <LocalModelDownloadModal
            downloadPending={localModelDownloadPending}
            onClose={onCloseLocalModelDialog}
            onDownload={onDownloadLocalModel}
            status={localModelStatus}
          />
        )}

        {displayedAnalysis && !displayedLoading && analysisModel && (
          <footer className="alert-detail-modal-footer">
            분석 모델 : <strong>{analysisModel} · {showingLocalAnalysis ? 'Local' : 'Cloud'}</strong>
          </footer>
        )}
      </section>
    </div>
  )
}

function LocalModelDownloadModal({ downloadPending, onClose, onDownload, status }) {
  const state = status?.download_state ?? 'idle'
  const active = ACTIVE_LOCAL_MODEL_STATES.has(state)
  const runtimeUnavailable = status?.ollama_available === false
  const failed = state === 'failed'
  const completed = state === 'completed' && status?.model_installed === true
  const progress = Number.isFinite(status?.progress_percent)
    ? Math.max(0, Math.min(100, status.progress_percent))
    : null
  const progressLabel = localModelProgressLabel(status)
  const title = runtimeUnavailable
    ? 'Local AI runtime이 준비되지 않았습니다'
    : failed
      ? 'Local AI 모델 다운로드에 실패했습니다'
      : completed
        ? '모델 다운로드 완료'
      : active
        ? '모델 다운로드 중'
        : '로컬 AI 모델이 필요합니다'

  return (
    <div
      aria-label="Local AI 모델 준비"
      aria-modal="true"
      className="local-model-modal-backdrop"
      onClick={(event) => event.stopPropagation()}
      role="dialog"
    >
      <section className="local-model-modal">
        <h3>{title}</h3>
        {runtimeUnavailable ? (
          <p>
            설치 스크립트를 다시 실행해 Ollama runtime과 service를 준비하세요.
          </p>
        ) : (
          <>
            {!active && !failed && !completed && (
              <p>Local AI 분석을 사용하려면 다음 모델을 다운로드해야 합니다.</p>
            )}
            <code className="local-model-name">{status?.model || '-'}</code>
            {!active && !failed && !completed && (
              <p className="muted">다운로드에는 네트워크 환경에 따라 시간이 걸릴 수 있습니다.</p>
            )}
            {completed && (
              <p aria-live="polite">모델 확인이 완료되어 요청한 Local AI 분석을 시작합니다.</p>
            )}
            {active && (
              <div className="local-model-progress" aria-live="polite">
                {progress !== null ? (
                  <>
                    <div
                      aria-label={`모델 다운로드 ${progress}%`}
                      aria-valuemax="100"
                      aria-valuemin="0"
                      aria-valuenow={progress}
                      className="local-model-progress-track"
                      role="progressbar"
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <strong>{progress}%</strong>
                  </>
                ) : (
                  <strong>모델 준비 중...</strong>
                )}
                {progressLabel && <span>{progressLabel}</span>}
                <span className="muted">{status?.status}</span>
              </div>
            )}
            {failed && (
              <p className="error-text local-model-error">
                원인: {status?.error || '현재 오류 원인을 확인할 수 없습니다.'}
              </p>
            )}
          </>
        )}
        {!completed && <div className="local-model-modal-actions">
          <button disabled={downloadPending} onClick={onClose} type="button">
            {active || failed || runtimeUnavailable ? '닫기' : '취소'}
          </button>
          {!runtimeUnavailable && !active && (
            <button
              className="alert-ai-analyze-button"
              disabled={downloadPending}
              onClick={onDownload}
              type="button"
            >
              {downloadPending ? '요청 중...' : failed ? '다시 시도' : '다운로드'}
            </button>
          )}
        </div>}
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
