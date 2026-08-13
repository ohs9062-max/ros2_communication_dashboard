import { useMemo, useState } from 'react'
import { formatMs, formatRelativeTime } from '../utils/format.js'
import { nextSortState, sortRows } from '../utils/sort.js'
import { SortableHeader } from './SortableHeader.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { QosStatusBadge } from './QosSummary.jsx'
import { PriorityStarButton } from './PriorityStarButton.jsx'
import { JsonPreviewButton, JsonPreviewModal } from './JsonPreview.jsx'
import { compactDataPreview } from '../utils/dataPreview.js'
import {
  actionFeedbackPreview,
  actionResultPreview,
} from '../features/actions/actionPresentation.js'

const ACTION_SORT_COLUMNS = {
  status: { value: (action) => action.status },
  name: { value: (action) => action.name },
  type: { value: (action) => action.type },
  last_goal_status: { value: (action) => action.last_goal_summary?.last_goal_status ?? action.runtime?.last_goal_status },
  server_count: { value: (action) => action.server_node_count ?? action.server_count ?? 0, defaultDirection: 'desc' },
  client_count: { value: (action) => action.client_node_count ?? action.client_count ?? 0, defaultDirection: 'desc' },
  feedback: { value: (action) => compactDataPreview(actionFeedbackPreview(action)) },
  result: { value: (action) => compactDataPreview(actionResultPreview(action)) },
  execution_time: { value: actionExecutionTime, defaultDirection: 'desc' },
  last_goal: { value: actionLastGoalAt, defaultDirection: 'desc' },
}

export function ActionTable({
  actions,
  emptyMessage = '표시할 Action이 없습니다',
  onSelectAction,
  selectedActionName,
  onTogglePriority,
  isPriorityPending,
}) {
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' })
  const [preview, setPreview] = useState(null)
  const sortedActions = useMemo(
    () => sortRows(actions, sort, ACTION_SORT_COLUMNS),
    [actions, sort],
  )
  const onSort = (key) => setSort((current) =>
    nextSortState(current, key, ACTION_SORT_COLUMNS),
  )

  if (!actions.length) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="table-wrap">
      <table className="topic-table action-table">
        <thead>
          <tr>
            <th className="priority-column">주요</th>
            <SortableHeader columnKey="status" headerClassName="resource-status-column" label="상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="name" headerClassName="action-name-column" label="이름" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="type" headerClassName="action-type-column" label="타입" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="server_count" headerClassName="diagnostic-count-column" label={['Server Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="client_count" headerClassName="diagnostic-count-column" label={['Client Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_goal_status" label="마지막 Goal 상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="feedback" headerClassName="diagnostic-data-column" label="마지막 Feedback" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="result" headerClassName="diagnostic-data-column" label="마지막 Result" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="execution_time" headerClassName="diagnostic-time-column" label="마지막 실행 시간" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_goal" headerClassName="diagnostic-time-column" label="마지막 Goal 시각" onSort={onSort} sort={sort} />
          </tr>
        </thead>
        <tbody>
          {sortedActions.map((action) => {
            const runtime = action.runtime ?? {}
            const summary = action.last_goal_summary
            const selected = action.name === selectedActionName
            return (
              <tr
                className={selected ? 'selected' : ''}
                data-monitor-name={action.name}
                key={action.name}
                onClick={() => onSelectAction(action.name)}
              >
                <td className="priority-cell">
                  <PriorityStarButton
                    item={action}
                    name={action.name}
                    onToggle={onTogglePriority}
                    pending={isPriorityPending(action.name)}
                  />
                </td>
                <td className="status-qos-cell">
                  <div className="resource-status-stack">
                    <StatusBadge value={action.status} />
                    <QosStatusBadge qos={action.qos} />
                  </div>
                </td>
                <td className="topic-name action-name ellipsis-cell" title={action.name}>{action.name}</td>
                <td className="topic-type action-type ellipsis-cell" title={action.type ?? '-'}>{action.type ?? '-'}</td>
                <td className="diagnostic-count-cell">{action.server_node_count ?? action.server_count ?? 0}</td>
                <td className="diagnostic-count-cell">{action.client_node_count ?? action.client_count ?? 0}</td>
                <td className="diagnostic-state-cell">
                  <StatusBadge
                    value={
                      summary?.last_goal_status
                        ? summary.last_goal_status
                        : runtime.last_goal_status === 'unknown'
                        ? 'goal_unobserved'
                        : runtime.last_goal_status ?? 'goal_unobserved'
                    }
                  />
                </td>
                <td className="diagnostic-data-cell">
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: action.name,
                      title: '마지막 Feedback',
                      value: actionFeedbackPreview(action),
                    })}
                    value={actionFeedbackPreview(action)}
                  />
                </td>
                <td className="diagnostic-data-cell">
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: action.name,
                      title: '마지막 Result',
                      value: actionResultPreview(action),
                    })}
                    value={actionResultPreview(action)}
                  />
                </td>
                <td className="diagnostic-time-cell">{formatMs(actionExecutionTime(action))}</td>
                <td className="diagnostic-time-cell">{formatRelativeTime(actionLastGoalAt(action))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {preview && (
        <JsonPreviewModal
          name={preview.name}
          onClose={() => setPreview(null)}
          title={preview.title}
          value={preview.value}
        />
      )}
    </div>
  )
}

function actionExecutionTime(action) {
  return action.last_goal_summary?.execution_time_ms ?? action.runtime?.elapsed_time_ms
}

function actionLastGoalAt(action) {
  return action.last_goal_summary?.last_goal_sent_at ?? action.runtime?.last_status_at
}
