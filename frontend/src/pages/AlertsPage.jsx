import { useState } from 'react'

import { resetAlertHistory, resetCurrentAlerts } from '../api/rosApi.js'
import { AlertsList } from '../components/AlertsList.jsx'

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
  const response = dashboard.alerts.data
  const currentAlerts = (response?.data ?? []).filter(
    (alert) => alert.alert_state !== 'resolved',
  )
  const previousAlerts = response?.history ?? []
  const alerts = activeTab === 'previous' ? previousAlerts : currentAlerts

  const deleteAlerts = async () => {
    if (deletePending) return
    setDeletePending(true)
    setDeleteError(null)
    try {
      if (activeTab === 'previous') {
        await resetAlertHistory()
      } else {
        await resetCurrentAlerts()
      }
      await dashboard.alerts.refresh()
      setDeleteConfirmOpen(false)
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : '이전 Alert 이력을 삭제하지 못했습니다.',
      )
    } finally {
      setDeletePending(false)
    }
  }

  const openAlert = (alert) => {
    if (alert.source === 'topic' || alert.source === 'monitor_status') {
      dashboard.setIncludeAllTopics(true)
      dashboard.setSelectedTopicName(alert.name)
      onNavigate('topics')
      return
    }

    if (alert.source === 'service') {
      serviceDashboard.setIncludeHidden(true)
      serviceDashboard.setSelectedServiceName(alert.name)
      onNavigate('services')
      return
    }

    if (alert.source === 'action') {
      actionDashboard.setIncludeIdleActions(true)
      actionDashboard.setSelectedActionName(alert.name)
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
            <span>{previousAlerts.length}</span>
          </button>
          <button
            className="alert-history-delete-button"
            disabled={deletePending || alerts.length === 0}
            onClick={() => {
              setDeleteError(null)
              setDeleteConfirmOpen(true)
            }}
            type="button"
          >
            {activeTab === 'previous' ? '이력 삭제' : '현재 Alert 삭제'}
          </button>
        </div>
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
        <AlertsList
          alerts={alerts}
          emptyMessage={
            activeTab === 'previous'
              ? '해결된 이전 Alert가 없습니다'
              : '현재 active Alert가 없습니다'
          }
          onAlertClick={openAlert}
          timeLabel={activeTab === 'previous' ? '해결 시각' : '감지 시각'}
        />
      </section>
    </main>
  )
}
