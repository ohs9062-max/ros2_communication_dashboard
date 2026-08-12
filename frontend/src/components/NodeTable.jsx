import { useMemo, useState } from 'react'
import { formatRelativeTime } from '../utils/format.js'
import { nextSortState, sortRows } from '../utils/sort.js'
import { SortableHeader } from './SortableHeader.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { PriorityStarButton } from './PriorityStarButton.jsx'

const NODE_SORT_COLUMNS = {
  status: { value: (node) => node.status },
  full_name: { value: (node) => node.full_name },
  relationship_count: {
    defaultDirection: 'desc',
    value: (node) => relationshipCount(node),
  },
  last_seen_at: {
    defaultDirection: 'desc',
    value: (node) => node.last_seen_at,
  },
}

export function NodeTable({
  emptyMessage = '표시할 Node가 없습니다.',
  nodes,
  onSelectNode,
  selectedNodeName,
  onTogglePriority,
  isPriorityPending,
}) {
  const [sort, setSort] = useState({ key: 'full_name', direction: 'asc' })
  const sortedNodes = useMemo(
    () => sortRows(nodes, sort, NODE_SORT_COLUMNS),
    [nodes, sort],
  )
  const onSort = (key) => setSort((current) =>
    nextSortState(current, key, NODE_SORT_COLUMNS),
  )

  if (!nodes.length) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="table-wrap">
      <table className="topic-table node-table">
        <thead>
          <tr>
            <th className="priority-column">주요</th>
            <SortableHeader columnKey="status" label="상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="full_name" label="Node" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="relationship_count" label="연결 리소스" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_seen_at" label="마지막 확인" onSort={onSort} sort={sort} />
          </tr>
        </thead>
        <tbody>
          {sortedNodes.map((node) => {
            const selected = node.full_name === selectedNodeName
            return (
              <tr
                className={selected ? 'selected' : ''}
                data-monitor-name={node.full_name}
                key={node.full_name}
                onClick={() => onSelectNode(node.full_name)}
              >
                <td className="priority-cell">
                  <PriorityStarButton
                    item={node}
                    name={node.full_name}
                    onToggle={onTogglePriority}
                    pending={isPriorityPending(node.full_name)}
                  />
                </td>
                <td>
                  <NodeStatusBadge status={node.status} />
                </td>
                <td className="topic-name node-name ellipsis-cell" title={node.full_name}>{node.full_name}</td>
                <td className="node-relations-cell" title="Topic · Service · Action 연결 수">
                  Topic {resourceCount(node.publisher_count, node.subscriber_count)} · Service {resourceCount(node.service_server_count, node.service_client_count)} · Action {resourceCount(node.action_server_count, node.action_client_count)}
                </td>
                <td>{formatRelativeTime(node.last_seen_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function resourceCount(left, right) {
  return (left ?? 0) + (right ?? 0)
}

function relationshipCount(node) {
  return resourceCount(node.publisher_count, node.subscriber_count) +
    resourceCount(node.service_server_count, node.service_client_count) +
    resourceCount(node.action_server_count, node.action_client_count)
}

export function NodeStatusBadge({ status }) {
  return <StatusBadge label={nodeStatusLabel(status)} value={status} />
}

function nodeStatusLabel(status) {
  const labels = {
    active: '실행 중',
    stale: '종료 감지',
    disconnected: '종료 감지',
    inactive: '비활성',
    unknown: '알 수 없음',
  }

  return labels[String(status || 'unknown').toLowerCase()] ?? '알 수 없음'
}
