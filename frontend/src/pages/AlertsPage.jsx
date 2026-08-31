import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  diagnoseAlert,
  diagnoseAlertLocally,
  fetchAlertHistory,
  resetAlertHistory,
  resetCurrentAlerts,
} from '../api/rosApi.js'
import { AlertDetailModal } from '../components/AlertDetailModal.jsx'
import { AlertsList } from '../components/AlertsList.jsx'

export function AlertsPage({
  actionDashboard,
  alertId,
  dashboard,
  nodeDashboard,
  onNavigate,
  serviceDashboard,
}) {
  const [activeTab, setActiveTab] = useState('current')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deletePending, setDeletePending] = useState(false)
  const [historySearchInput, setHistorySearchInput] = useState('')
  const [historyName, setHistoryName] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyResponse, setHistoryResponse] = useState(null)
  const [historyPending, setHistoryPending] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [highlightedAlertId, setHighlightedAlertId] = useState(null)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [hasCloudAnalysisCache, setHasCloudAnalysisCache] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [analysisProvider, setAnalysisProvider] = useState('cloud')
  const [localAiAnalysis, setLocalAiAnalysis] = useState(null)
  const [hasLocalAnalysisCache, setHasLocalAnalysisCache] = useState(false)
  const [localAiError, setLocalAiError] = useState(null)
  const [localAiLoading, setLocalAiLoading] = useState(false)
  const [alternateAiError, setAlternateAiError] = useState(null)
  const [alternateAiLoading, setAlternateAiLoading] = useState(false)
  const aiRequestRef = useRef({ pending: false, token: 0 })
  const localAiRequestRef = useRef({ pending: false, token: 0 })
  const alternateAiRequestRef = useRef({ pending: false, token: 0 })
  const response = dashboard.alerts.data
  const currentAlerts = useMemo(
    () => (response?.data ?? []).filter((alert) => alert.alert_state !== 'resolved'),
    [response?.data],
  )
  const previousAlerts = useMemo(
    () => historyResponse?.data ?? response?.history ?? [],
    [historyResponse?.data, response?.history],
  )
  const historyPagination = historyResponse?.pagination ?? response?.history_pagination ?? {
    page: 1,
    page_size: 50,
    total: previousAlerts.length,
    total_pages: 1,
    has_previous: false,
    has_next: false,
  }
  const alerts = activeTab === 'previous' ? previousAlerts : currentAlerts

  useEffect(() => {
    if (!alertId) {
      setHighlightedAlertId(null)
      return
    }
    if (currentAlerts.some((alert) => alert.id === alertId)) {
      setActiveTab('current')
      setHighlightedAlertId(alertId)
      return
    }
    if (previousAlerts.some((alert) => alert.id === alertId)) {
      setActiveTab('previous')
      setHighlightedAlertId(alertId)
      return
    }
    setHighlightedAlertId(null)
  }, [alertId, currentAlerts, previousAlerts])

  const loadHistory = useCallback(async ({ name, page }) => {
    setHistoryPending(true)
    setHistoryError(null)
    try {
      const result = await fetchAlertHistory({ name, page })
      setHistoryResponse(result)
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : 'Failed to load previous Alerts.',
      )
    } finally {
      setHistoryPending(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'previous') loadHistory({ name: historyName, page: historyPage })
  }, [activeTab, historyName, historyPage, loadHistory])

  const deleteAlerts = async () => {
    if (deletePending) return
    setDeletePending(true)
    setDeleteError(null)
    try {
      if (activeTab === 'previous') {
        await resetAlertHistory()
        setHistoryPage(1)
        await loadHistory({ name: historyName, page: 1 })
      } else {
        await resetCurrentAlerts()
        await dashboard.alerts.refresh()
      }
      setDeleteConfirmOpen(false)
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Failed to delete the previous Alert history.',
      )
    } finally {
      setDeletePending(false)
    }
  }

  const openAlert = (alert) => {
    aiRequestRef.current.token += 1
    localAiRequestRef.current.token += 1
    alternateAiRequestRef.current.token += 1
    const cloudAnalysis = loadAlertAiAnalysis(alert)
    const localAnalysis = loadAlertAiAnalysis(alert, 'local')
    setSelectedAlert(alert)
    setAiAnalysis(cloudAnalysis)
    setHasCloudAnalysisCache(Boolean(cloudAnalysis))
    setAiError(null)
    setAiLoading(aiRequestRef.current.pending)
    setLocalAiAnalysis(localAnalysis)
    setHasLocalAnalysisCache(Boolean(localAnalysis))
    setLocalAiError(null)
    setLocalAiLoading(localAiRequestRef.current.pending)
    setAlternateAiError(null)
    setAlternateAiLoading(alternateAiRequestRef.current.pending)
    setAnalysisProvider(localAnalysis ? 'local' : 'cloud')
    onNavigate('alerts')
  }

  const closeAlert = () => {
    aiRequestRef.current.token += 1
    localAiRequestRef.current.token += 1
    alternateAiRequestRef.current.token += 1
    setSelectedAlert(null)
    setAiAnalysis(null)
    setHasCloudAnalysisCache(false)
    setAiError(null)
    setLocalAiAnalysis(null)
    setHasLocalAnalysisCache(false)
    setLocalAiError(null)
    setAlternateAiError(null)
  }

  const analyzeSelectedAlert = async () => {
    if (!selectedAlert || aiRequestRef.current.pending) return
    const alert = selectedAlert
    setAnalysisProvider('cloud')
    aiRequestRef.current.pending = true
    const token = aiRequestRef.current.token + 1
    aiRequestRef.current.token = token
    setAiLoading(true)
    setAiError(null)
    setAlternateAiError(null)
    try {
      const result = await diagnoseAlert(alert)
      if (aiRequestRef.current.token === token) {
        setAiAnalysis(result.data)
        setHasCloudAnalysisCache(saveAlertAiAnalysis(alert, result.data))
      }
    } catch (error) {
      if (aiRequestRef.current.token === token) {
        setAiError(error instanceof Error ? error.message : 'AI 분석 요청에 실패했습니다.')
      }
    } finally {
      aiRequestRef.current.pending = false
      setAiLoading(false)
    }
  }

  const analyzeSelectedAlertLocally = async () => {
    if (!selectedAlert || localAiRequestRef.current.pending) return
    const alert = selectedAlert
    setAnalysisProvider('local')
    localAiRequestRef.current.pending = true
    const token = localAiRequestRef.current.token + 1
    localAiRequestRef.current.token = token
    setLocalAiLoading(true)
    setLocalAiError(null)
    setAlternateAiError(null)
    try {
      const result = await diagnoseAlertLocally(alert)
      if (localAiRequestRef.current.token === token) {
        if (!isLocalAlertAiAnalysis(result.data)) {
          setLocalAiAnalysis(null)
          setHasLocalAnalysisCache(false)
          setLocalAiError('로컬 AI가 한국어 설명을 반환하지 않아 결과를 표시하지 않았습니다.')
          return
        }
        setLocalAiAnalysis(result.data)
        setHasLocalAnalysisCache(saveAlertAiAnalysis(alert, result.data, 'local'))
      }
    } catch (error) {
      if (localAiRequestRef.current.token === token) {
        setLocalAiError(
          error instanceof Error ? error.message : '로컬 AI 분석 요청에 실패했습니다.',
        )
      }
    } finally {
      localAiRequestRef.current.pending = false
      setLocalAiLoading(false)
    }
  }

  const showStoredAlertAiAnalysis = (provider) => {
    if (!selectedAlert) return
    const isLocal = provider === 'local'
    const analysis = loadAlertAiAnalysis(selectedAlert, provider)
    setAnalysisProvider(provider)
    setAlternateAiError(null)
    if (isLocal) {
      setHasLocalAnalysisCache(Boolean(analysis))
      setLocalAiError(analysis ? null : '저장된 분석 결과가 없습니다.')
      setLocalAiAnalysis(analysis)
      return Boolean(analysis)
    }
    setHasCloudAnalysisCache(Boolean(analysis))
    setAiError(analysis ? null : '저장된 분석 결과가 없습니다.')
    setAiAnalysis(analysis)
    return Boolean(analysis)
  }

  const handleCloudAnalysis = () => {
    if (hasCloudAnalysisCache) {
      showStoredAlertAiAnalysis('cloud')
      return
    }
    analyzeSelectedAlert()
  }

  const handleLocalAnalysis = () => {
    if (hasLocalAnalysisCache) {
      showStoredAlertAiAnalysis('local')
      return
    }
    analyzeSelectedAlertLocally()
  }

  const analyzeFromAnotherPerspective = async () => {
    if (!selectedAlert || alternateAiRequestRef.current.pending) return
    const provider = analysisProvider
    const currentAnalysis = provider === 'local' ? localAiAnalysis : aiAnalysis
    if (!currentAnalysis) {
      setAlternateAiError('먼저 Cloud 또는 Local AI 분석을 실행해주세요.')
      return
    }

    const alert = selectedAlert
    alternateAiRequestRef.current.pending = true
    const token = alternateAiRequestRef.current.token + 1
    alternateAiRequestRef.current.token = token
    setAlternateAiLoading(true)
    setAlternateAiError(null)
    try {
      const result = provider === 'local'
        ? await diagnoseAlertLocally(alert, { alternate: true })
        : await diagnoseAlert(alert, { alternate: true })
      if (alternateAiRequestRef.current.token === token) {
        if (provider === 'local') {
          if (!isLocalAlertAiAnalysis(result.data)) {
            setAlternateAiError('로컬 AI가 한국어 설명을 반환하지 않아 기존 결과를 유지합니다.')
            return
          }
          setLocalAiAnalysis(result.data)
        } else setAiAnalysis(result.data)
      }
    } catch (error) {
      if (alternateAiRequestRef.current.token === token) {
        setAlternateAiError(
          error instanceof Error ? error.message : '다른 관점 분석 요청에 실패했습니다.',
        )
      }
    } finally {
      alternateAiRequestRef.current.pending = false
      setAlternateAiLoading(false)
    }
  }

  const selectedResource = selectedAlert
    ? findAlertResource(selectedAlert, {
        actions: actionDashboard.actions,
        nodes: nodeDashboard.nodes,
        services: serviceDashboard.services,
        topics: dashboard.topicItems,
      })
    : null

  return (
    <main className="single-page">
      <section className="topic-section">
        <div className="section-heading">
          <div>
            <h2>Alert</h2>
            <p className="muted">
              현재 장애와 최근 해결된 Alert를 구분해 표시합니다
            </p>
          </div>
          {dashboard.alerts.error && (
            <span className="error-text">{dashboard.alerts.error}</span>
          )}
        </div>
        <div className="alert-tabs" role="tablist" aria-label="Alert 목록">
          <button
            aria-selected={activeTab === 'current'}
            className={activeTab === 'current' ? 'active' : ''}
            onClick={() => {
              setActiveTab('current')
              setDeleteConfirmOpen(false)
              setDeleteError(null)
            }}
            role="tab"
            type="button"
          >
            현재 Alert
            <span>{currentAlerts.length}</span>
          </button>
          <button
            aria-selected={activeTab === 'previous'}
            className={activeTab === 'previous' ? 'active' : ''}
            onClick={() => {
              setActiveTab('previous')
              setDeleteConfirmOpen(false)
              setDeleteError(null)
            }}
            role="tab"
            type="button"
          >
            이전 Alert
            <span>{historyPagination.total}</span>
          </button>
          <button
            className="alert-history-delete-button"
            disabled={deletePending || (activeTab === 'previous'
              ? historyPagination.total === 0
              : alerts.length === 0)}
            onClick={() => {
              setDeleteError(null)
              setDeleteConfirmOpen(true)
            }}
            type="button"
          >
            {activeTab === 'previous' ? '이력 삭제' : '현재 Alert 삭제'}
          </button>
        </div>
        {activeTab === 'previous' && (
          <form
            className="alert-history-toolbar"
            onSubmit={(event) => {
              event.preventDefault()
              const nextName = historySearchInput.trim()
              setHistoryName(nextName)
              setHistoryPage(1)
            }}
          >
            <input
              aria-label="이전 Alert 이름 검색"
              onChange={(event) => setHistorySearchInput(event.target.value)}
              placeholder="이름 검색"
              type="search"
              value={historySearchInput}
            />
            <button disabled={historyPending} type="submit">검색</button>
          </form>
        )}
        {deleteConfirmOpen && (
          <div className="alert-history-delete-confirm" role="alert">
            <span>
              {activeTab === 'previous'
                ? '해결된 이전 Alert 이력을 모두 삭제합니다. 삭제 후 복구할 수 없습니다.'
                : '현재 Alert를 모두 확인 처리하고 숨깁니다. 같은 원인이 해소된 뒤 다시 발생하면 다시 표시됩니다.'}
            </span>
            <div>
              <button
                className="alert-history-delete-cancel"
                disabled={deletePending}
                onClick={() => {
                  setDeleteConfirmOpen(false)
                  setDeleteError(null)
                }}
                type="button"
              >
                취소
              </button>
              <button
                className="alert-history-delete-confirm-button"
                disabled={deletePending}
                onClick={deleteAlerts}
                type="button"
              >
                {deletePending ? '삭제 중…' : '확인'}
              </button>
            </div>
          </div>
        )}
        {deleteError && <p className="error-text alert-history-delete-error">{deleteError}</p>}
        {historyError && activeTab === 'previous' && (
          <p className="error-text alert-history-delete-error">{historyError}</p>
        )}
        <AlertsList
          alerts={alerts}
          emptyMessage={
            activeTab === 'previous'
              ? '이전 Alert가 없습니다'
              : '현재 발생 중인 Alert가 없습니다'
          }
          key={activeTab}
          onAlertClick={openAlert}
          selectedAlertId={highlightedAlertId}
          variant={activeTab}
        />
        {activeTab === 'previous' && (
          <div className="alert-history-pagination">
            <button
              disabled={historyPending || !historyPagination.has_previous}
              onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              이전
            </button>
            <span>
              {historyPagination.page} / {historyPagination.total_pages}
            </span>
            <button
              disabled={historyPending || !historyPagination.has_next}
              onClick={() => setHistoryPage((current) => current + 1)}
              type="button"
            >
              다음
            </button>
          </div>
        )}
      </section>
      {selectedAlert && (
        <AlertDetailModal
          analysisProvider={analysisProvider}
          alternateAiError={alternateAiError}
          alternateAiLoading={alternateAiLoading}
          aiAnalysis={aiAnalysis}
          aiError={aiError}
          aiLoading={aiLoading}
          alert={selectedAlert}
          currentResource={selectedResource}
          hasCloudAnalysisCache={hasCloudAnalysisCache}
          hasLocalAnalysisCache={hasLocalAnalysisCache}
          localAiAnalysis={localAiAnalysis}
          localAiError={localAiError}
          localAiLoading={localAiLoading}
          onAnalyze={handleCloudAnalysis}
          onAnalyzeAlternative={analyzeFromAnotherPerspective}
          onAnalyzeLocally={handleLocalAnalysis}
          onClose={closeAlert}
        />
      )}
    </main>
  )
}

const ALERT_AI_CACHE_PREFIX = 'alert_ai_diagnosis:'
const LOCAL_ALERT_AI_CACHE_PREFIX = 'alert_ai_diagnosis:local:'

function loadAlertAiAnalysis(alert, provider = 'cloud') {
  const key = alertAiCacheKey(alert, provider)
  if (!key) return null
  try {
    const cached = window.sessionStorage.getItem(key)
    if (!cached) return null
    const analysis = JSON.parse(cached)
    if (
      isAlertAiAnalysis(analysis)
      && (provider !== 'local' || isLocalAlertAiAnalysis(analysis))
    ) return analysis
    window.sessionStorage.removeItem(key)
  } catch {
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      // Storage access itself can be unavailable; keep the Modal usable.
    }
    return null
  }
  return null
}

function saveAlertAiAnalysis(alert, analysis, provider = 'cloud') {
  const key = alertAiCacheKey(alert, provider)
  if (
    !key
    || !isAlertAiAnalysis(analysis)
    || (provider === 'local' && !isLocalAlertAiAnalysis(analysis))
  ) return false
  try {
    window.sessionStorage.setItem(key, JSON.stringify(analysis))
    return true
  } catch {
    // Browser storage can be unavailable or full; the in-memory result remains usable.
    return false
  }
}

function alertAiCacheKey(alert, provider = 'cloud') {
  const id = String(alert?.id ?? '').trim()
  const prefix = provider === 'local' ? LOCAL_ALERT_AI_CACHE_PREFIX : ALERT_AI_CACHE_PREFIX
  return id ? `${prefix}${id}` : null
}

function isAlertAiAnalysis(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.summary === 'string'
    && Array.isArray(value.evidence)
    && Array.isArray(value.likely_causes)
    && Array.isArray(value.recommended_checks)
}

function isLocalAlertAiAnalysis(value) {
  if (!isAlertAiAnalysis(value)) return false
  return [value.summary, ...value.likely_causes, ...value.recommended_checks]
    .every((item) => /[가-힣]/.test(item))
}

function findAlertResource(alert, resources) {
  const values = {
    topic: resources.topics,
    monitor_status: resources.topics,
    service: resources.services,
    action: resources.actions,
    node: resources.nodes,
  }[alert.source] ?? []
  return values.find((resource) => {
    const name = alert.source === 'node' ? resource.full_name : resource.name
    if (alert.resource_key && resource.resource_key === alert.resource_key) return true
    return name === alert.name && (
      alert.domain_id === undefined || alert.domain_id === null
      || resource.domain_id === alert.domain_id
    )
  }) ?? null
}
