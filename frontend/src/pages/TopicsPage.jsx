import { useMemo, useState } from 'react'
import { AlertsPreview } from '../components/AlertsPreview.jsx'
import { FilterToolbar } from '../components/FilterToolbar.jsx'
import { SummaryCard } from '../components/SummaryCard.jsx'
import { TopicDetailPanel } from '../components/TopicDetailPanel.jsx'
import { TopicTable } from '../components/TopicTable.jsx'
import {
  getTopicSummary,
  matchesStatusFilter,
  sortTopicsByHealth,
  topicEffectiveStatus,
} from '../utils/status.js'
import { isPrimaryTopic } from '../utils/primaryFilters.js'
import { qosAlertChannel } from '../utils/qosAlerts.js'

export function TopicsPage({ dashboard }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('primary')
  const {
    alerts,
    cameraPreview,
    health,
    hz,
    includeAllTopics,
    latest,
    focusQosDetails,
    qosFocusRequest,
    selectedTopic,
    selectedTopicName,
    setIncludeAllTopics,
    setSelectedTopicName,
    topicHzByName,
    topicItems,
    topicParticipants,
    topics,
    priorityError,
    toggleUserPriority,
    isPriorityPending,
  } = dashboard

  const summary = getTopicSummary(topicItems)
  const activeTopics = useMemo(
    () =>
      topicItems.filter((topic) => isPrimaryTopic(topic)),
    [topicItems],
  )
  const warningCount = alerts.data?.meta?.warning_count ?? 0
  const errorCount =
    (alerts.data?.meta?.error_count ?? 0) +
    (alerts.data?.meta?.critical_count ?? 0)
  const missedCount = useMemo(
    () =>
      topicItems.filter((topic) =>
        isTopicMissingMessages(topic),
      ).length,
    [topicItems],
  )
  const topicAlerts = useMemo(
    () =>
      (alerts.data?.data ?? []).filter((alert) =>
        ['topic', 'monitor_status'].includes(alert.source),
      ),
    [alerts.data],
  )
  const filteredTopics = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const baseTopics = includeAllTopics || statusFilter !== 'primary'
      ? topicItems
      : activeTopics
    return sortTopicsByHealth(baseTopics).filter((topic) => {
      const type = topic.types?.[0] ?? ''
      const matchesSearch =
        !normalizedSearch ||
        topic.name.toLowerCase().includes(normalizedSearch) ||
        type.toLowerCase().includes(normalizedSearch)
      const matchesStatus =
        statusFilter === 'primary' || statusFilter === 'all'
          ? true
          : statusFilter === 'waiting'
            ? isWaitingTopic(topic)
            : statusFilter === 'missing'
              ? isTopicMissingMessages(topic)
              : matchesStatusFilter(topic, statusFilter)
      return (
        matchesSearch &&
        matchesStatus
      )
    })
  }, [activeTopics, includeAllTopics, search, statusFilter, topicItems])

  const detailTopic = filteredTopics.some(
    (topic) => (topic.resource_key ?? topic.name) === selectedTopicName,
  )
    ? selectedTopic
    : null
  const openTopicAlert = (alert) => {
    setIncludeAllTopics(true)
    setSearch('')
    setStatusFilter('all')
    setSelectedTopicName(alert.resource_key ?? alert.name)
    if (alert.code === 'topic_qos_incompatible') {
      focusQosDetails(alert.resource_key ?? alert.name, qosAlertChannel(alert))
    }
    focusMonitorRow(alert.resource_key ?? alert.name, setSelectedTopicName)
  }

  return (
    <main className={`topics-page${detailTopic ? ' detail-open' : ''}`}>
      <section className="main-panel">
        <div className="summary-grid">
          <SummaryCard label="전체 Topic" value={summary.total} />
          <SummaryCard label="주요 Topic" value={activeTopics.length} tone="good" />
          <SummaryCard label="감시 중 Topic" value={summary.deep} />
          <SummaryCard
            label="주의/오류"
            value={warningCount + errorCount}
            tone={warningCount + errorCount ? 'warn' : 'default'}
          />
          <SummaryCard
            label="미수신"
            tone={missedCount ? 'bad' : 'default'}
            value={missedCount}
          />
        </div>

        <AlertsPreview
          alerts={topicAlerts}
          emptyMessage="Topic 알림 없음"
          error={alerts.error}
          onAlertClick={openTopicAlert}
          title="Topic Alert"
        />

        <section className="topic-section">
          <div className="section-heading">
            <div>
              <h2>Topic 목록</h2>
              <p className="muted">
                기본 화면은 현재 활동 중이거나 최근 상태 변화가 관찰된 Topic만
                표시합니다.
              </p>
            </div>
            {topics.error && <span className="error-text">{topics.error}</span>}
            {health.error && (
              <span className="error-text">Backend connection lost.</span>
            )}
          </div>
          <FilterToolbar
            includeAllTopics={includeAllTopics}
            onIncludeAllTopicsChange={setIncludeAllTopics}
            onSearchChange={setSearch}
            onStatusFilterChange={setStatusFilter}
            search={search}
            statusFilter={statusFilter}
          />
          {priorityError && <p className="error-text">{priorityError}</p>}
          <TopicTable
            emptyMessage={
              includeAllTopics
                ? '표시할 Topic이 없습니다'
                : "현재 활동 중인 Topic이 없습니다. 숨김 Topic을 보려면 '숨김 Topic 포함'을 켜세요."
            }
            hzByTopic={topicHzByName}
            onSelectTopic={setSelectedTopicName}
            selectedTopicName={selectedTopicName}
            topics={filteredTopics}
            onTogglePriority={toggleUserPriority}
            isPriorityPending={isPriorityPending}
          />
        </section>
      </section>

      {detailTopic && (
        <TopicDetailPanel
          cameraPreview={cameraPreview}
          hz={hz}
          latest={latest}
          onClose={() => setSelectedTopicName('')}
          participants={topicParticipants[detailTopic.resource_key ?? detailTopic.name] ?? null}
          qosFocusRequest={qosFocusRequest}
          topic={detailTopic}
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

function isTopicMissingMessages(topic) {
  return topicEffectiveStatus(topic) === 'never_received'
}

function isWaitingTopic(topic) {
  return ['waiting_publisher', 'no_subscriber'].includes(
    String(topic.status || '').toLowerCase(),
  )
}
