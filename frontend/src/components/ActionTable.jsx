import { useMemo, useState } from 'react'
import { formatMs, formatRelativeTime } from '../utils/format.js'
import { nextSortState, sortRows } from '../utils/sort.js'
import { DashboardCommunicationBadges } from './DashboardCommunicationBadges.jsx'
import { JsonPreviewButton, JsonPreviewModal } from './JsonPreview.jsx'
import { SortableHeader } from './SortableHeader.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { PriorityStarButton } from './PriorityStarButton.jsx'
import {
  actionFeedbackPreview,
  actionResultPreview,
  feedbackDisplay,
  resultDisplay,
} from '../features/actions/actionPresentation.js'

const ACTION_SORT_COLUMNS = {
  status: { value: (action) => action.status },
  name: { value: (action) => action.name },
  type: { value: (action) => action.type },
  server_count: {
    defaultDirection: 'desc',
    value: (action) => action.server_node_count ?? action.server_count,
  },
  client_count: {
    defaultDirection: 'desc',
    value: (action) => action.client_node_count ?? action.client_count,
  },
  dashboard_communication: {
    defaultDirection: 'desc',
    value: (action) =>
      action.dashboard_communication?.interface_client_created ? 1 : 0,
  },
  last_goal_status: { value: (action) => action.runtime?.last_goal_status },
  callable: { value: (action) => (action.callable ? 1 : 0), defaultDirection: 'desc' },
  last_goal_sent: { value: (action) => action.last_goal_summary?.last_goal_sent_at, defaultDirection: 'desc' },
  feedback_supported: {
    defaultDirection: 'desc',
    value: (action) => feedbackDisplay(action).sortValue,
  },
  result_supported: {
    defaultDirection: 'desc',
    value: (action) => resultDisplay(action).sortValue,
  },
  elapsed_time_ms: {
    defaultDirection: 'desc',
    value: (action) => action.runtime?.elapsed_time_ms,
  },
  observed_goal_count: {
    defaultDirection: 'desc',
    value: (action) => action.runtime?.observed_goal_count,
  },
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
        <colgroup>
          <col className="priority-column" />
          <col className="action-col-status" />
          <col className="action-col-name" />
          <col className="action-col-type" />
          <col className="action-col-node" />
          <col className="action-col-node" />
          <col className="action-col-dashboard" />
          <col className="action-col-last-goal-status" />
          <col className="action-col-callable" />
          <col className="action-col-goal-sent" />
          <col className="action-col-feedback-preview" />
          <col className="action-col-result-preview" />
          <col className="action-col-feedback" />
          <col className="action-col-result" />
          <col className="action-col-elapsed" />
          <col className="action-col-observed" />
        </colgroup>
        <thead>
          <tr>
            <th className="priority-column">주요</th>
            <SortableHeader columnKey="status" label="서버 상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="name" label="이름" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="type" label="타입" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="server_count" headerClassName="communication-count-column" label={['Server Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="client_count" headerClassName="communication-count-column" label={['Client Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="dashboard_communication" headerClassName="dashboard-communication-column" label={['Dashboard', '통신']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_goal_status" label="Goal 상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="callable" headerClassName="compact-action-column" label={['실행', '가능']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_goal_sent" headerClassName="compact-action-column" label={['Goal', '전송']} onSort={onSort} sort={sort} />
            <th>마지막 Feedback</th>
            <th>Result 값</th>
            <SortableHeader columnKey="feedback_supported" label="피드백" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="result_supported" label="결과" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="elapsed_time_ms" label="실행 시간" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="observed_goal_count" label="관찰 Goal" onSort={onSort} sort={sort} />
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
                <td>
                  <StatusBadge value={action.status} />
                </td>
                <td className="topic-name action-name">{action.name}</td>
                <td className="topic-type action-type">{action.type ?? '-'}</td>
                <td className="communication-count-cell">{action.server_node_count ?? action.server_count ?? 0}</td>
                <td className="communication-count-cell">{action.client_node_count ?? action.client_count ?? 0}</td>
                <td className="dashboard-communication-cell">
                  <DashboardCommunicationBadges
                    items={[
                      {
                        active: action.dashboard_communication?.interface_client_created,
                        label: 'Lab Client',
                        tone: 'client',
                      },
                    ]}
                  />
                </td>
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
                <td className="compact-action-cell">
                  {action.callable ? '예' : action.allowlisted ? '등록됨' : '아니오'}
                </td>
                <td className="compact-action-cell">
                  {formatRelativeTime(summary?.last_goal_sent_at)}
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
                <td>
                  <FeedbackBadge action={action} />
                </td>
                <td>
                  <ResultBadge action={action} />
                </td>
                <td>{formatMs(runtime.elapsed_time_ms)}</td>
                <td>{runtime.observed_goal_count ?? 0}</td>
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

function FeedbackBadge({ action }) {
  const display = feedbackDisplay(action)
  return <StatusBadge label={display.label} value={display.value} />
}

function ResultBadge({ action }) {
  const display = resultDisplay(action)
  return <StatusBadge label={display.label} value={display.value} />
}
