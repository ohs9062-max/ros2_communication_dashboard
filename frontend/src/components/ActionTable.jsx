import { useMemo, useState } from 'react'
import { nextSortState, sortRows } from '../utils/sort.js'
import { JsonPreviewButton, JsonPreviewModal } from './JsonPreview.jsx'
import { SortableHeader } from './SortableHeader.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { QosStatusBadge } from './QosSummary.jsx'
import { PriorityStarButton } from './PriorityStarButton.jsx'
import {
  actionFeedbackPreview,
  actionResultPreview,
} from '../features/actions/actionPresentation.js'

const ACTION_SORT_COLUMNS = {
  status: { value: (action) => action.status },
  name: { value: (action) => action.name },
  type: { value: (action) => action.type },
  last_goal_status: { value: (action) => action.runtime?.last_goal_status },
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
            <SortableHeader columnKey="name" label="이름" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="type" label="타입" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_goal_status" label="Goal 상태" onSort={onSort} sort={sort} />
            <th>마지막 Feedback</th>
            <th>마지막 Result</th>
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
                <td>
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
                <td>
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: action.name,
                      title: '마지막 Feedback',
                      value: actionFeedbackPreview(action),
                    })}
                    previewMode="first-entry"
                    value={actionFeedbackPreview(action)}
                  />
                </td>
                <td>
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: action.name,
                      title: '마지막 Result',
                      value: actionResultPreview(action),
                    })}
                    previewMode="first-entry"
                    value={actionResultPreview(action)}
                  />
                </td>
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
