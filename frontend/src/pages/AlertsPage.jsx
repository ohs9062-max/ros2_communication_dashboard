import { useCallback, useEffect, useState } from 'react'

import {
  fetchAlertHistory,
  resetAlertHistory,
  resetCurrentAlerts,
} from '../api/rosApi.js'
import { AlertsList } from '../components/AlertsList.jsx'
import { qosAlertChannel } from '../utils/qosAlerts.js'

export function AlertsPage({
  actionDashboard,
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
  const response = dashboard.alerts.data
  const currentAlerts = (response?.data ?? []).filter(
    (alert) => alert.alert_state !== 'resolved',
  )
  const previousAlerts = historyResponse?.data ?? response?.history ?? []
  const historyPagination = historyResponse?.pagination ?? response?.history_pagination ?? {
    page: 1,
    page_size: 50,
    total: previousAlerts.length,
    total_pages: 1,
    has_previous: false,
    has_next: false,
  }
  const alerts = activeTab === 'previous' ? previousAlerts : currentAlerts

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
    if (alert.source === 'topic' || alert.source === 'monitor_status') {
      dashboard.setIncludeAllTopics(true)
      dashboard.setSelectedTopicName(alert.name)
      if (alert.code === 'topic_qos_incompatible') {
        dashboard.focusQosDetails(alert.name, qosAlertChannel(alert))
      }
      onNavigate('topics')
      return
    }

    if (alert.source === 'service') {
      serviceDashboard.setIncludeHidden(true)
      serviceDashboard.setSelectedServiceName(alert.name)
      if (alert.code === 'service_qos_incompatible') {
        serviceDashboard.focusQosDetails(alert.name, qosAlertChannel(alert))
      }
      onNavigate('services')
      return
    }

    if (alert.source === 'action') {
      actionDashboard.setIncludeIdleActions(true)
      actionDashboard.setSelectedActionName(alert.name)
      if (alert.code === 'action_qos_incompatible') {
        actionDashboard.focusQosDetails(alert.name, qosAlertChannel(alert))
      }
      onNavigate('actions')
      return
    }

    if (alert.source === 'node' || alert.code === 'node_stale') {
      const targetNode = nodeDashboard.nodes.find(
        (node) => node.full_name === alert.name || node.name === alert.name,
      )
      nodeDashboard.setIncludeInternalNodes(true)
      nodeDashboard.setStatusFilter('all')
      nodeDashboard.setSelectedNodeName(targetNode?.full_name ?? alert.name)
      onNavigate('nodes')
    }
  }

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
    </main>
  )
}
