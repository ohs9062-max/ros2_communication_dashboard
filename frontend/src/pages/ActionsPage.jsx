import { useMemo, useState } from 'react'
import { ActionDetailPanel } from '../components/ActionDetailPanel.jsx'
import { ActionSummaryCards } from '../components/ActionSummaryCards.jsx'
import { ActionTable } from '../components/ActionTable.jsx'
import { AlertsPreview } from '../components/AlertsPreview.jsx'
import { DomainFilterButtons } from '../components/DomainFilterButtons.jsx'
import { isPrimaryAction } from '../utils/primaryFilters.js'
import { qosAlertChannel } from '../utils/qosAlerts.js'
import {
  actionSearchValues,
  matchesActionStatusFilter,
} from '../features/actions/actionPresentation.js'
import { matchesResourceSearch } from '../utils/resourceSearch.js'
import { matchesDomainFilter } from '../utils/domainFilter.js'
import { useDomainFilter } from '../hooks/useDomainFilter.js'

const ACTION_FILTERS = [
  { id: 'primary', label: '주요 항목' },
  { id: 'all', label: '전체' },
  { id: 'running', label: '실행 중' },
  { id: 'succeeded', label: '성공' },
  { id: 'failed', label: '실패/취소' },
]

export function ActionsPage({ dashboard, domainIds }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('primary')
  const { selectedDomainId, setSelectedDomainId } = useDomainFilter(domainIds)
  const {
    actionAlerts,
    actionParticipants,
    actions,
    alerts,
    error,
    loading,
    focusQosDetails,
    qosFocusRequest,
    meta,
    selectedAction,
    selectedActionName,
    setIncludeIdleActions,
    setSelectedActionName,
    priorityError,
    toggleUserPriority,
    isPriorityPending,
  } = dashboard

  const primaryActions = useMemo(
    () => actions.filter((action) => isPrimaryAction(action)),
    [actions],
  )

  const filteredActions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const baseActions = statusFilter === 'primary' ? primaryActions : actions

    return baseActions.filter((action) => {
      if (!matchesActionStatusFilter(action, statusFilter)) {
        return false
      }

      if (!matchesDomainFilter(action, selectedDomainId)) return false

      return matchesResourceSearch(
        action,
        normalizedSearch,
        actionSearchValues(action),
      )
    })
  }, [actions, primaryActions, search, selectedDomainId, statusFilter])

  const detailAction = filteredActions.some(
    (action) => (action.resource_key ?? action.name) === selectedActionName,
  )
    ? selectedAction
    : null
  const openActionAlert = (alert) => {
    setIncludeIdleActions(true)
    setSearch('')
    setStatusFilter('all')
    setSelectedActionName(alert.resource_key ?? alert.name)
    if (alert.code === 'action_qos_incompatible') {
      focusQosDetails(alert.resource_key ?? alert.name, qosAlertChannel(alert))
    }
    focusMonitorRow(alert.resource_key ?? alert.name, setSelectedActionName)
  }

  return (
    <main className={`topics-page${detailAction ? ' detail-open' : ''}`}>
      <section className="main-panel">
        <ActionSummaryCards actions={actions} activeActions={primaryActions} meta={meta} />
        <AlertsPreview
          alerts={actionAlerts}
          collapsible
          compactItems
          collapsedItems={3}
          emptyMessage="Action 알림 없음"
          error={alerts.error}
          maxItems={Infinity}
          onAlertClick={openActionAlert}
          showSource={false}
          title="Action Alert"
        />

        <section className="topic-section">
          <div className="section-heading">
            <div>
              <h2>Action 목록</h2>
              <p className="muted">
                Action 목록은 3초마다 갱신됩니다. Goal 실행 상태와 최근
                Feedback·Result를 우선 표시합니다.
              </p>
            </div>
            {loading && <span className="muted">로딩 중</span>}
            {error && <span className="error-text">Failed to connect to the Action API.</span>}
          </div>

          <div className="filter-toolbar">
            <input
              aria-label="Action 검색"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="이름 또는 타입, Domain 검색"
              type="search"
              value={search}
            />
            <div className="service-filter-actions">
              <div
                aria-label="Action 상태 필터"
                className="filter-buttons"
                role="group"
              >
                {ACTION_FILTERS.map((filter) => (
                  <button
                    className={
                      statusFilter === filter.id ? 'filter active' : 'filter'
                    }
                    key={filter.id}
                    onClick={() => setStatusFilter(filter.id)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <DomainFilterButtons
                domainIds={domainIds}
                onChange={setSelectedDomainId}
                selectedDomainId={selectedDomainId}
              />
            </div>
          </div>

          <ActionTable
            actions={filteredActions}
            emptyMessage={
              statusFilter === 'primary'
                ? '현재 주요 Action이 없습니다'
                : '표시할 Action이 없습니다'
            }
            onSelectAction={setSelectedActionName}
            selectedActionName={selectedActionName}
            onTogglePriority={toggleUserPriority}
            isPriorityPending={isPriorityPending}
          />
          {priorityError && <p className="error-text">{priorityError}</p>}
        </section>
      </section>

      {detailAction && (
        <ActionDetailPanel
          action={detailAction}
          onClose={() => setSelectedActionName('')}
          participants={actionParticipants[detailAction.resource_key ?? detailAction.name] ?? null}
          qosFocusRequest={qosFocusRequest}
        />
      )}
    </main>
  )
}

function focusMonitorRow(name, select) {
  window.setTimeout(() => focusMonitorRowAttempt(name, select, 0), 50)
}

function focusMonitorRowAttempt(name, select, attempt) {
  select(name)
  const row = findMonitorRow(name)
  if (row) {
    row.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    return
  }

  if (attempt < 6) {
    window.setTimeout(() => focusMonitorRowAttempt(name, select, attempt + 1), 80)
  }
}

function findMonitorRow(name) {
  return [...document.querySelectorAll('[data-monitor-name]')].find(
    (row) => row.getAttribute('data-monitor-name') === name,
  )
}
