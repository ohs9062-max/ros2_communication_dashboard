import { PriorityStarButton } from '../../components/PriorityStarButton.jsx'
import { JsonPreviewButton } from '../../components/JsonPreview.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { QosStatusBadge } from '../../components/QosSummary.jsx'
import { formatRelativeTime } from '../../utils/format.js'
import {
  hzLabel,
  hzState,
  isMissingTopic,
  topicDisplayStatus,
  topicLastReceivedAt,
  topicCauseBadge,
} from './topicTablePresentation.js'

export function TopicTableRow({
  hz,
  isPriorityPending,
  onPreview,
  onSelect,
  onTogglePriority,
  selected,
  topic,
}) {
  const hzData = hz?.data
  const missing = isMissingTopic(topic)
  const displayStatus = topicDisplayStatus(topic)
  const causeBadge = topicCauseBadge(topic.reception_diagnosis)
  return (
    <tr
      className={[selected ? 'selected' : '', missing ? 'message-missing' : ''].join(' ')}
      data-monitor-name={topic.name}
      onClick={() => onSelect(topic.resource_key ?? topic.name)}
    >
      <td className="priority-cell">
        <PriorityStarButton item={topic} name={topic.name} onToggle={onTogglePriority} pending={isPriorityPending(topic.name)} />
      </td>
      <td className="status-qos-cell">
        <div className="resource-status-stack">
          <StatusBadge value={displayStatus} />
          {causeBadge
            ? <span className={`qos-list-badge ${causeBadge.tone}`}>{causeBadge.label}</span>
            : <QosStatusBadge qos={topic} />}
        </div>
      </td>
      <td className="topic-name ellipsis-cell" title={topic.name}>{topic.name} <span className="muted">· D{topic.domain_id ?? 0}</span></td>
      <td className="topic-type ellipsis-cell" title={topic.types?.[0] ?? '-'}>{topic.types?.[0] ?? '-'}</td>
      <td className="diagnostic-count-cell">{topic.publisher_node_count ?? topic.publisher_count ?? 0}</td>
      <td className="diagnostic-count-cell">{topic.subscriber_node_count ?? topic.subscriber_count ?? 0}</td>
      <td className="metric-cell"><HzBadge hzData={hzData} topic={topic} /></td>
      <td className="diagnostic-data-cell">
        <JsonPreviewButton onOpen={() => onPreview(topic)} value={topic.last_message_preview} />
      </td>
      <td className="diagnostic-time-cell">{formatRelativeTime(topicLastReceivedAt(topic, hzData))}</td>
    </tr>
  )
}

function HzBadge({ hzData, topic }) {
  const state = hzState(hzData, topic)
  return <span className={`hz-badge ${state}`}>{hzLabel(hzData, state)}</span>
}
