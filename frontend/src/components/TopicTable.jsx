import { useMemo, useState } from 'react'
import { nextSortState, sortRows } from '../utils/sort.js'
import { createTopicSortColumns } from '../features/topics/topicTablePresentation.js'
import { JsonPreviewModal } from './JsonPreview.jsx'
import { SortableHeader } from './SortableHeader.jsx'
import { TopicTableRow } from '../features/topics/TopicTableRow.jsx'

export function TopicTable({
  topics,
  emptyMessage = '표시할 Topic이 없습니다',
  selectedTopicName,
  onSelectTopic,
  hzByTopic = {},
  onTogglePriority,
  isPriorityPending,
}) {
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' })
  const [previewTopic, setPreviewTopic] = useState(null)
  const sortColumns = useMemo(() => createTopicSortColumns(hzByTopic), [hzByTopic])
  const sortedTopics = useMemo(
    () => sortRows(topics, sort, sortColumns),
    [sort, sortColumns, topics],
  )
  const onSort = (key) => setSort((current) => nextSortState(current, key, sortColumns))

  if (!topics.length) return <div className="empty-state">{emptyMessage}</div>

  return (
    <div className="table-wrap">
      <table className="topic-table">
        <thead>
          <tr>
            <th className="priority-column">주요</th>
            <SortableHeader columnKey="status" headerClassName="resource-status-column" label="상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="name" label="이름" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="type" label="타입" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="publisher_count" headerClassName="diagnostic-count-column" label={['Publisher Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="subscriber_count" headerClassName="diagnostic-count-column" label={['Subscriber Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="hz" headerClassName="metric-column" label="Hz" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="latest" headerClassName="diagnostic-data-column" label="마지막 값" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_updated" headerClassName="diagnostic-time-column" label="마지막 수신" onSort={onSort} sort={sort} />
          </tr>
        </thead>
        <tbody>
          {sortedTopics.map((topic) => (
            <TopicTableRow
              hz={hzByTopic[topic.resource_key ?? topic.name]}
              isPriorityPending={isPriorityPending}
              key={topic.resource_key ?? topic.name}
              onPreview={setPreviewTopic}
              onSelect={onSelectTopic}
              onTogglePriority={onTogglePriority}
              selected={(topic.resource_key ?? topic.name) === selectedTopicName}
              topic={topic}
            />
          ))}
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
