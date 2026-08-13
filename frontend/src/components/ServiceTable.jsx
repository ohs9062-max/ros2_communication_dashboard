import { useMemo, useState } from 'react'
import { formatMs, formatRelativeTime } from '../utils/format.js'
import { nextSortState, sortRows } from '../utils/sort.js'
import { SortableHeader } from './SortableHeader.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { QosStatusBadge } from './QosSummary.jsx'
import { PriorityStarButton } from './PriorityStarButton.jsx'
import { JsonPreviewButton, JsonPreviewModal } from './JsonPreview.jsx'
import { compactDataPreview } from '../utils/dataPreview.js'

const SERVICE_SORT_COLUMNS = {
  status: { value: (service) => service.status },
  name: { value: (service) => service.name },
  type: { value: (service) => service.type },
  server_count: { value: (service) => service.server_node_count ?? service.server_count ?? 0, defaultDirection: 'desc' },
  client_count: { value: (service) => service.client_node_count ?? service.client_count ?? 0, defaultDirection: 'desc' },
  request: { value: (service) => compactDataPreview(service.last_call_summary?.last_request_preview) },
  response: { value: (service) => compactDataPreview(service.last_call_summary?.last_response_preview) },
  response_time: { value: (service) => service.last_call_summary?.last_response_time_ms, defaultDirection: 'desc' },
  last_call: { value: (service) => service.last_call_summary?.last_called_at, defaultDirection: 'desc' },
}

export function ServiceTable({
  emptyMessage = '표시할 Service가 없습니다',
  onSelectService,
  selectedServiceName,
  services,
  onTogglePriority,
  isPriorityPending,
}) {
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' })
  const [preview, setPreview] = useState(null)
  const sortedServices = useMemo(
    () => sortRows(services, sort, SERVICE_SORT_COLUMNS),
    [services, sort],
  )
  const onSort = (key) => setSort((current) =>
    nextSortState(current, key, SERVICE_SORT_COLUMNS),
  )

  if (!services.length) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="table-wrap">
      <table className="topic-table service-table">
        <thead>
          <tr>
            <th className="priority-column">주요</th>
            <SortableHeader columnKey="status" headerClassName="resource-status-column" label="상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="name" headerClassName="service-name-column" label="이름" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="type" headerClassName="service-type-column" label="타입" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="server_count" headerClassName="diagnostic-count-column" label={['Server Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="client_count" headerClassName="diagnostic-count-column" label={['Client Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="request" headerClassName="diagnostic-data-column" label="마지막 Request" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="response" headerClassName="diagnostic-data-column" label="마지막 Response" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="response_time" headerClassName="diagnostic-time-column" label="마지막 응답 시간" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_call" headerClassName="service-last-call-column" label="마지막 호출" onSort={onSort} sort={sort} />
          </tr>
        </thead>
        <tbody>
          {sortedServices.map((service) => {
            const summary = service.last_call_summary
            const selected = service.name === selectedServiceName
            return (
              <tr
                className={selected ? 'selected' : ''}
                data-monitor-name={service.name}
                key={service.name}
                onClick={() => onSelectService(service.name)}
              >
                <td className="priority-cell">
                  <PriorityStarButton
                    item={service}
                    name={service.name}
                    onToggle={onTogglePriority}
                    pending={isPriorityPending(service.name)}
                  />
                </td>
                <td className="service-status-cell">
                  <div className="resource-status-stack">
                    <StatusBadge
                      label={serviceStatusLabel(service)}
                      value={service.effective_status ?? service.status}
                    />
                    <QosStatusBadge qos={service} />
                  </div>
                </td>
                <td className="topic-name service-name service-name-cell ellipsis-cell" title={service.name}>{service.name}</td>
                <td className="topic-type service-type service-type-cell ellipsis-cell" title={service.type ?? '-'}>{service.type ?? '-'}</td>
                <td className="diagnostic-count-cell">{service.server_node_count ?? service.server_count ?? 0}</td>
                <td className="diagnostic-count-cell">{service.client_node_count ?? service.client_count ?? 0}</td>
                <td className="diagnostic-data-cell">
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: service.name,
                      title: '마지막 Request',
                      value: summary?.last_request_preview,
                    })}
                    value={summary?.last_request_preview}
                  />
                </td>
                <td className="diagnostic-data-cell">
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: service.name,
                      title: '마지막 Response',
                      value: summary?.last_response_preview,
                    })}
                    value={summary?.last_response_preview}
                  />
                </td>
                <td className="diagnostic-time-cell">{formatMs(summary?.last_response_time_ms)}</td>
                <td className="service-last-call-cell">{formatRelativeTime(summary?.last_called_at)}</td>
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

function serviceStatusLabel(service) {
  const effectiveStatus = service.effective_status ?? service.status
  if (effectiveStatus === 'timeout') return 'Timeout'
  if (effectiveStatus === 'failed') return '호출 실패'
  if (effectiveStatus === 'active' && service.call_status === 'not_called') {
    return '서버 있음'
  }
  if (effectiveStatus === 'active') return '정상'
  return undefined
}
