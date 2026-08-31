import { useMemo, useState } from 'react'
import { AlertsPreview } from '../components/AlertsPreview.jsx'
import { FilterToolbar } from '../components/FilterToolbar.jsx'
import { SummaryCard } from '../components/SummaryCard.jsx'
import { TopicDetailPanel } from '../components/TopicDetailPanel.jsx'
import { TopicTable } from '../components/TopicTable.jsx'
import {
  getTopicSummary,
  isRunningTopic,
  matchesStatusFilter,
  sortTopicsByHealth,
  topicEffectiveStatus,
} from '../utils/status.js'
import { isPrimaryTopic } from '../utils/primaryFilters.js'
import { matchesResourceSearch } from '../utils/resourceSearch.js'
import { matchesDomainFilter } from '../utils/domainFilter.js'
import { useDomainFilter } from '../hooks/useDomainFilter.js'

export function TopicsPage({ dashboard, domainIds, onNavigate }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('running')
  const { selectedDomainId, setSelectedDomainId } = useDomainFilter(domainIds)
  const {
    alerts,
    cameraPreview,
    cameraPreviewOpen,
    health,
    hz,
    latest,
    qosFocusRequest,
    selectedTopic,
    selectedTopicName,
    setCameraPreviewOpen,
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
    return sortTopicsByHealth(topicItems).filter((topic) => {
      const type = topic.types?.[0] ?? ''
      const matchesSearch = matchesResourceSearch(topic, normalizedSearch, [
        topic.name,
        type,
      ])
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'running'
            ? isRunningTopic(topic)
            : matchesStatusFilter(topic, statusFilter)
      return (
        matchesSearch &&
        matchesDomainFilter(topic, selectedDomainId) &&
        matchesStatus
      )
    })
  }, [search, selectedDomainId, statusFilter, topicItems])

  const detailTopic = filteredTopics.some(
    (topic) => (topic.resource_key ?? topic.name) === selectedTopicName,
  )
    ? selectedTopic
    : null
  const openTopicAlert = () => onNavigate('alerts')

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
          collapsible
          compactItems
          collapsedItems={3}
          emptyMessage="Topic 알림 없음"
          error={alerts.error}
          maxItems={Infinity}
          onAlertClick={openTopicAlert}
          showSource={false}
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
          onSearchChange={setSearch}
          domainIds={domainIds}
          onDomainChange={setSelectedDomainId}
          onStatusFilterChange={setStatusFilter}
          search={search}
          selectedDomainId={selectedDomainId}
            statusFilter={statusFilter}
          />
          {priorityError && <p className="error-text">{priorityError}</p>}
          <TopicTable
            emptyMessage={
              statusFilter === 'running'
                ? '현재 실행 중인 Topic이 없습니다'
                : '표시할 Topic이 없습니다'
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
          cameraPreviewOpen={cameraPreviewOpen}
          hz={hz}
          latest={latest}
          onClose={() => setSelectedTopicName('')}
          onCameraPreviewOpenChange={setCameraPreviewOpen}
          participants={topicParticipants[detailTopic.resource_key ?? detailTopic.name] ?? null}
          qosFocusRequest={qosFocusRequest}
          topic={detailTopic}
        />
      )}
    </main>
  )
}

function isTopicMissingMessages(topic) {
  return topicEffectiveStatus(topic) === 'never_received'
}
