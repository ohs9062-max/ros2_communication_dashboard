import { useMemo } from 'react'
import { AlertsPreview } from '../components/AlertsPreview.jsx'
import { DomainFilterButtons } from '../components/DomainFilterButtons.jsx'
import { NodeDetailPanel } from '../components/NodeDetailPanel.jsx'
import { NodeSummaryCards } from '../components/NodeSummaryCards.jsx'
import { NodeTable } from '../components/NodeTable.jsx'
import { isIssueNode, isPrimaryNode, isRunningNode } from '../utils/nodeFilters.js'
import { matchesResourceSearch } from '../utils/resourceSearch.js'
import { matchesDomainFilter } from '../utils/domainFilter.js'
import { useDomainFilter } from '../hooks/useDomainFilter.js'

const NODE_FILTERS = [
  { id: 'running', label: '실행 중' },
  { id: 'all', label: '전체' },
  { id: 'issues', label: '오류' },
]

export function NodesPage({ actions, dashboard, domainIds, services, topics }) {
  const { selectedDomainId, setSelectedDomainId } = useDomainFilter(domainIds)
  const {
    alerts,
    error,
    loading,
    meta,
    nodeAlerts,
    nodes,
    search,
    selectedNode,
    selectedNodeName,
    setIncludeInternalNodes,
    setSearch,
    setSelectedNodeName,
    setStatusFilter,
    statusFilter,
    priorityError,
    toggleUserPriority,
    isPriorityPending,
  } = dashboard

  const primaryNodes = useMemo(
    () =>
      nodes.filter((node) =>
        (
          node.user_primary === true ||
          !isInternalNode(node)
        ) && isPrimaryNode(node, { actions, services, topics }),
      ),
    [actions, nodes, services, topics],
  )

  const filteredNodes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return nodes.filter((node) => {
      const matchesStatus = statusFilter === 'all'
          ? true
          : statusFilter === 'running'
            ? isRunningNode(node)
          : statusFilter === 'issues'
            ? isIssueNode(node)
            : true
      const matchesSearch =
        !normalizedSearch || nodeMatchesSearch(node, normalizedSearch)

      return matchesStatus && matchesSearch && matchesDomainFilter(node, selectedDomainId)
    })
  }, [nodes, search, selectedDomainId, statusFilter])

  const detailNode = filteredNodes.some(
    (node) => (node.resource_key ?? node.full_name) === selectedNodeName,
  )
    ? selectedNode
    : null
  const openNodeAlert = (alert) => {
    const targetNode = nodes.find(
      (node) => node.resource_key === alert.resource_key || (
        !alert.resource_key && (node.full_name === alert.name || node.name === alert.name)
      ),
    )
    setIncludeInternalNodes(true)
    setSearch('')
    setStatusFilter('all')
    const key = targetNode?.resource_key ?? alert.resource_key ?? alert.name
    setSelectedNodeName(key)
    focusMonitorRow(key, setSelectedNodeName)
  }

  return (
    <main className={`topics-page node-page${detailNode ? ' detail-open' : ''}`}>
      <section className="main-panel">
        <section className="topic-section page-intro">
          <div className="section-heading">
            <div>
              <h2>Nodes</h2>
              <p className="muted">
                기본 화면은 운영 시 먼저 확인할 핵심 Node와 종료가 감지된
                Node를 표시합니다. 통신 수치는 실제 메시지·요청·Goal 횟수가
                아니라 현재 Graph의 고유 Topic·Service·Action 관계 수입니다.
              </p>
            </div>
            {loading && <span className="muted">로딩 중</span>}
            {error && <span className="error-text">Failed to connect to the Node API.</span>}
          </div>
        </section>

        <NodeSummaryCards meta={meta} nodes={nodes} primaryNodes={primaryNodes} />

        <AlertsPreview
          alerts={nodeAlerts}
          collapsible
          compactItems
          collapsedItems={3}
          emptyMessage="현재 Node Alert가 없습니다."
          error={alerts.error}
          maxItems={Infinity}
          onAlertClick={openNodeAlert}
          showSource={false}
          title="Node Alert"
        />

        <section className="topic-section">
          <div className="filter-toolbar topic-toolbar">
            <input
              aria-label="Node 검색"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="이름 또는 타입, Domain 검색"
              type="search"
              value={search}
            />
            <div className="service-filter-actions">
              <div
                className="filter-buttons"
                role="group"
                aria-label="Node 상태 필터"
              >
                {NODE_FILTERS.map((filter) => (
                  <button
                    className={
                      statusFilter === filter.id ? 'filter active' : 'filter'
                    }
                    key={filter.id}
                    onClick={() => {
                      setStatusFilter(filter.id)
                    }}
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

          <NodeTable
            emptyMessage={
              statusFilter === 'running'
                ? '현재 실행 중인 Node가 없습니다.'
                : '표시할 Node가 없습니다.'
            }
            nodes={filteredNodes}
            onSelectNode={setSelectedNodeName}
            selectedNodeName={selectedNodeName}
            onTogglePriority={toggleUserPriority}
            isPriorityPending={isPriorityPending}
          />
          {priorityError && <p className="error-text">{priorityError}</p>}
        </section>
      </section>

      {detailNode && (
        <NodeDetailPanel node={detailNode} onClose={() => setSelectedNodeName('')} />
      )}
    </main>
  )
}

function nodeMatchesSearch(node, search) {
  const fields = [
    node.full_name,
    node.name,
    node.namespace,
    ...entitySearchFields(node.topic_publishers),
    ...entitySearchFields(node.topic_subscribers),
    ...entitySearchFields(node.service_servers),
    ...entitySearchFields(node.service_clients),
    ...entitySearchFields(node.action_servers),
    ...entitySearchFields(node.action_clients),
  ]

  return matchesResourceSearch(node, search, fields)
}

function entitySearchFields(items = []) {
  return items.flatMap((item) => [item.name, item.type, ...(item.types ?? [])])
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
