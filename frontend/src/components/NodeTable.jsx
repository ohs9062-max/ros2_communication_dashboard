import { useMemo, useState } from 'react'
import { formatRelativeTime } from '../utils/format.js'
import { nextSortState, sortRows } from '../utils/sort.js'
import { SortableHeader } from './SortableHeader.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { PriorityStarButton } from './PriorityStarButton.jsx'

const NODE_SORT_COLUMNS = {
  status: { value: (node) => node.status },
  full_name: { value: (node) => node.full_name },
  publisher_count: countColumn('publisher_count'),
  subscriber_count: countColumn('subscriber_count'),
  service_server_count: countColumn('service_server_count'),
  service_client_count: countColumn('service_client_count'),
  action_server_count: countColumn('action_server_count'),
  action_client_count: countColumn('action_client_count'),
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
            <SortableHeader columnKey="status" headerClassName="node-status-column" label="상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="full_name" label="Node 전체 이름" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="publisher_count" headerClassName="diagnostic-count-column" label={['Topic', 'Pub']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="subscriber_count" headerClassName="diagnostic-count-column" label={['Topic', 'Sub']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="service_server_count" headerClassName="diagnostic-count-column" label={['Service', 'Server']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="service_client_count" headerClassName="diagnostic-count-column" label={['Service', 'Client']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="action_server_count" headerClassName="diagnostic-count-column" label={['Action', 'Server']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="action_client_count" headerClassName="diagnostic-count-column" label={['Action', 'Client']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_seen_at" headerClassName="diagnostic-time-column" label="마지막 확인" onSort={onSort} sort={sort} />
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
                <td className="node-status-cell">
                  <NodeStatusBadge status={node.status} />
                </td>
                <td className="topic-name node-name ellipsis-cell" title={node.full_name}>{node.full_name ?? node.name ?? '-'}</td>
                <td className="diagnostic-count-cell">{node.publisher_count ?? 0}</td>
                <td className="diagnostic-count-cell">{node.subscriber_count ?? 0}</td>
                <td className="diagnostic-count-cell">{node.service_server_count ?? 0}</td>
                <td className="diagnostic-count-cell">{node.service_client_count ?? 0}</td>
                <td className="diagnostic-count-cell">{node.action_server_count ?? 0}</td>
                <td className="diagnostic-count-cell">{node.action_client_count ?? 0}</td>
                <td className="diagnostic-time-cell">{formatRelativeTime(node.last_seen_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function countColumn(field) {
  return { defaultDirection: 'desc', value: (node) => node[field] ?? 0 }
}

export function NodeStatusBadge({ status }) {
  return <StatusBadge label={nodeStatusLabel(status)} value={status} />
}

function nodeStatusLabel(status) {
  const labels = {
    active: '실행 중',
    stale: '종료 감지',
    disconnected: 'Graph 이탈',
    inactive: '비활성',
    unknown: '알 수 없음',
  }

  return labels[String(status || 'unknown').toLowerCase()] ?? '알 수 없음'
}
