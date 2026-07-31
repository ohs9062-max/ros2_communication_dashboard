import { useMemo, useState } from 'react'
import { formatRelativeTime } from '../utils/format.js'
import { nextSortState, sortRows } from '../utils/sort.js'
import { DashboardCommunicationBadges } from './DashboardCommunicationBadges.jsx'
import { JsonPreviewButton, JsonPreviewModal } from './JsonPreview.jsx'
import { SortableHeader } from './SortableHeader.jsx'
import { StatusBadge } from './StatusBadge.jsx'

const TOPIC_SORT_COLUMNS = {
  status: { value: (topic) => topic.status },
  name: { value: (topic) => topic.name },
  type: { value: (topic) => topic.types?.[0] },
  publisher_count: {
    defaultDirection: 'desc',
    value: (topic) => topic.publisher_node_count ?? topic.publisher_count,
  },
  subscriber_count: {
    defaultDirection: 'desc',
    value: (topic) => topic.subscriber_node_count ?? topic.subscriber_count,
  },
  hz: {
    defaultDirection: 'desc',
    value: (topic, context) => context.hzByTopic[topic.name]?.data?.hz,
  },
  dashboard_communication: {
    defaultDirection: 'desc',
    value: (topic) => dashboardCommunicationCount(topic.dashboard_communication),
  },
  observed: {
    defaultDirection: 'desc',
    value: (topic) => (topic.observed ? 1 : 0),
  },
  last_updated: {
    defaultDirection: 'desc',
    value: (topic, context) =>
      topicLastCheckedAt(topic, context.hzByTopic[topic.name]?.data),
  },
}

export function TopicTable({
  topics,
  emptyMessage = '표시할 Topic이 없습니다',
  selectedTopicName,
  onSelectTopic,
  hzByTopic = {},
}) {
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' })
  const [previewTopic, setPreviewTopic] = useState(null)
  const sortedTopics = useMemo(
    () =>
      sortRows(
        topics,
        sort,
        withSortContext(TOPIC_SORT_COLUMNS, { hzByTopic }),
      ),
    [hzByTopic, sort, topics],
  )
  const onSort = (key) => setSort((current) =>
    nextSortState(current, key, TOPIC_SORT_COLUMNS),
  )

  if (!topics.length) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="table-wrap">
      <table className="topic-table">
        <thead>
          <tr>
            <SortableHeader columnKey="status" label="상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="name" label="이름" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="type" label="타입" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="publisher_count" headerClassName="communication-count-column" label={['Publisher Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="subscriber_count" headerClassName="communication-count-column" label={['Subscriber Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="hz" headerClassName="metric-column" label="Hz" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="dashboard_communication" headerClassName="dashboard-communication-column" label={['Dashboard', '통신']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="observed" label="마지막 값" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_updated" label="마지막 확인" onSort={onSort} sort={sort} />
          </tr>
        </thead>
        <tbody>
          {sortedTopics.map((topic) => {
            const selected = topic.name === selectedTopicName
            const hz = hzByTopic[topic.name]
            const hzData = hz?.data
            const missing = isMissingTopic(topic, hz)
            return (
              <tr
                className={[
                  selected ? 'selected' : '',
                  missing ? 'message-missing' : '',
                ].join(' ')}
                data-monitor-name={topic.name}
                key={topic.name}
                onClick={() => onSelectTopic(topic.name)}
              >
                <td className="metric-cell">
                  <StatusBadge value={topic.status} />
                </td>
                <td className="topic-name">{topic.name}</td>
                <td className="topic-type">{topic.types?.[0] ?? '-'}</td>
                <td className="communication-count-cell">{topic.publisher_node_count ?? topic.publisher_count ?? 0}</td>
                <td className="communication-count-cell">{topic.subscriber_node_count ?? topic.subscriber_count ?? 0}</td>
                <td className="dashboard-communication-cell">
                  <HzBadge hzData={hzData} topic={topic} />
                </td>
                <td>
                  <DashboardCommunicationBadges
                    items={topicDashboardCommunicationItems(topic)}
                  />
                </td>
                <td>
                  <JsonPreviewButton
                    onOpen={() => setPreviewTopic(topic)}
                    value={topic.last_message_preview}
                  />
                </td>
                <td>
                  {formatRelativeTime(topicLastCheckedAt(topic, hzData))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {previewTopic && (
        <JsonPreviewModal
          name={previewTopic.name}
          onClose={() => setPreviewTopic(null)}
          title="마지막 값"
          value={previewTopic.last_message_preview}
        />
      )}
    </div>
  )
}

function HzBadge({ hzData, topic }) {
  const state = hzState(hzData, topic)
  const label = hzLabel(hzData, state)

  return <span className={`hz-badge ${state}`}>{label}</span>
}

function topicDashboardCommunicationItems(topic) {
  const state = topic.dashboard_communication ?? {}
  return [
    {
      active: state.auto_monitoring_active ?? topic.deep_monitoring,
      label: '자동 감시',
      tone: 'monitoring',
    },
    {
      active: state.interface_receive_active,
      label: 'Lab 수신',
      tone: 'receive',
    },
    {
      active: state.interface_publisher_created,
      label: 'Lab 발행',
      tone: 'publish',
    },
  ]
}

function dashboardCommunicationCount(state = {}) {
  return Object.values(state).filter((value) => value === true).length
}

function hzState(hzData, topic) {
  if (!topic.deep_monitoring) {
    return 'unsupported'
  }

  if (!hzData || hzData.status === 'never_received') {
    return 'never'
  }

  const hz = Number(hzData.hz ?? 0)
  if (!Number.isFinite(hz) || hz <= 0) {
    return 'zero'
  }

  if (hz < 10) {
    return 'low'
  }

  return 'normal'
}

function hzLabel(hzData, state) {
  if (state === 'unsupported') {
    return '미지원'
  }

  if (state === 'never') {
    return '아직 수신 없음'
  }

  const hz = Number(hzData?.hz ?? 0)
  return `${hz.toFixed(2)} Hz`
}

function topicLastCheckedAt(topic, hzData) {
  if (topic.deep_monitoring) {
    return hzData?.last_received_at ?? topic.last_received_at
  }

  return topic.last_updated
}

function isMissingTopic(topic, hzEntry) {
  return (
    topic.deep_monitoring === true &&
    (
      hzEntry?.data?.status === 'never_received' ||
      hzEntry?.data?.received === false
    )
  )
}

function withSortContext(columns, context) {
  return Object.fromEntries(
    Object.entries(columns).map(([key, column]) => [
      key,
      {
        ...column,
        value: (row) => column.value(row, context),
      },
    ]),
  )
}
