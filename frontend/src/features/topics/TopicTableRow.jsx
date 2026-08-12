import { JsonPreviewButton } from '../../components/JsonPreview.jsx'
import { PriorityStarButton } from '../../components/PriorityStarButton.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { QosStatusBadge } from '../../components/QosSummary.jsx'
import { formatRelativeTime } from '../../utils/format.js'
import {
  hzLabel,
  hzState,
  isMissingTopic,
  topicLastCheckedAt,
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
  const missing = isMissingTopic(topic, hz)
  return (
    <tr
      className={[selected ? 'selected' : '', missing ? 'message-missing' : ''].join(' ')}
      data-monitor-name={topic.name}
      onClick={() => onSelect(topic.name)}
    >
      <td className="priority-cell">
        <PriorityStarButton item={topic} name={topic.name} onToggle={onTogglePriority} pending={isPriorityPending(topic.name)} />
      </td>
      <td className="status-qos-cell">
        <div className="resource-status-stack">
          <StatusBadge value={topic.status} />
          <QosStatusBadge qos={topic} />
        </div>
      </td>
      <td className="topic-name ellipsis-cell" title={topic.name}>{topic.name}</td>
      <td className="topic-type ellipsis-cell" title={topic.types?.[0] ?? '-'}>{topic.types?.[0] ?? '-'}</td>
      <td className="metric-cell"><HzBadge hzData={hzData} topic={topic} /></td>
      <td><JsonPreviewButton onOpen={() => onPreview(topic)} value={topic.last_message_preview} /></td>
      <td>{formatRelativeTime(topicLastCheckedAt(topic, hzData))}</td>
    </tr>
  )
}

function HzBadge({ hzData, topic }) {
  const state = hzState(hzData, topic)
  return <span className={`hz-badge ${state}`}>{hzLabel(hzData, state)}</span>
}
