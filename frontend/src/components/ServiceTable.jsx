import { useMemo, useState } from 'react'
import { formatMs, formatRelativeTime } from '../utils/format.js'
import { nextSortState, sortRows } from '../utils/sort.js'
import { DashboardCommunicationBadges } from './DashboardCommunicationBadges.jsx'
import { JsonPreviewButton, JsonPreviewModal } from './JsonPreview.jsx'
import { SortableHeader } from './SortableHeader.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { PriorityStarButton } from './PriorityStarButton.jsx'

const SERVICE_SORT_COLUMNS = {
  status: { value: (service) => service.status },
  name: { value: (service) => service.name },
  type: { value: (service) => service.type },
  category: { value: (service) => service.category },
  server_count: {
    defaultDirection: 'desc',
    value: (service) => service.server_node_count ?? service.server_count,
  },
  client_count: {
    defaultDirection: 'desc',
    value: (service) => service.client_node_count ?? service.client_count,
  },
  dashboard_communication: {
    defaultDirection: 'desc',
    value: (service) =>
      service.dashboard_communication?.interface_client_created ? 1 : 0,
  },
  callable: { value: (service) => (service.callable ? 1 : 0), defaultDirection: 'desc' },
  last_call: { value: (service) => service.last_call_summary?.last_called_at, defaultDirection: 'desc' },
  response_time: {
    defaultDirection: 'desc',
    value: (service) => service.last_call_summary?.last_response_time_ms,
  },
  hidden: {
    defaultDirection: 'desc',
    value: (service) => (service.hidden_by_default ? 1 : 0),
  },
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
        <colgroup>
          <col className="priority-column" />
          <col className="service-col-status" />
          <col className="service-col-name" />
          <col className="service-col-type" />
          <col className="service-col-category" />
          <col className="service-col-node" />
          <col className="service-col-node" />
          <col className="service-col-dashboard" />
          <col className="service-col-callable" />
          <col className="service-col-last-call" />
          <col className="service-col-preview" />
          <col className="service-col-preview" />
          <col className="service-col-response-time" />
          <col className="service-col-hidden" />
        </colgroup>
        <thead>
          <tr>
            <th className="priority-column">주요</th>
            <SortableHeader columnKey="status" headerClassName="service-status-column" label="상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="name" headerClassName="service-name-column" label="이름" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="type" headerClassName="service-type-column" label="타입" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="category" headerClassName="service-category-column" label="분류" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="server_count" headerClassName="communication-count-column" label={['Server Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="client_count" headerClassName="communication-count-column" label={['Client Node 수', '(Dashboard 제외)']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="dashboard_communication" headerClassName="dashboard-communication-column" label={['Dashboard', '통신']} onSort={onSort} sort={sort} />
            <SortableHeader columnKey="callable" headerClassName="service-callable-column" label="호출 가능" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_call" headerClassName="service-last-call-column" label="마지막 호출" onSort={onSort} sort={sort} />
            <th className="service-preview-column">마지막 요청</th>
            <th className="service-preview-column">마지막 응답</th>
            <SortableHeader columnKey="response_time" headerClassName="service-response-time-column" label="호출 응답 시간" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="hidden" headerClassName="service-hidden-column" label="숨김" onSort={onSort} sort={sort} />
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
                  <StatusBadge
                    label={serviceStatusLabel(service)}
                    value={service.effective_status ?? service.status}
                  />
                </td>
                <td className="topic-name service-name service-name-cell">{service.name}</td>
                <td className="topic-type service-type service-type-cell">{service.type ?? '-'}</td>
                <td className="service-category-cell">
                  <StatusBadge value={service.category} />
                </td>
                <td className="communication-count-cell">{service.server_node_count ?? service.server_count ?? 0}</td>
                <td className="communication-count-cell">{service.client_node_count ?? service.client_count ?? 0}</td>
                <td className="dashboard-communication-cell">
                  <DashboardCommunicationBadges
                    items={[
                      {
                        active: service.dashboard_communication?.interface_client_created,
                        label: 'Lab Client',
                        tone: 'client',
                      },
                    ]}
                  />
                </td>
                <td className="service-callable-cell">{service.callable ? '예' : service.allowlisted ? '등록됨' : '아니오'}</td>
                <td className="service-last-call-cell">{formatRelativeTime(summary?.last_called_at)}</td>
                <td className="service-preview-cell">
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: service.name,
                      title: '마지막 요청',
                      value: summary?.last_request_preview,
                    })}
                    previewMode="first-entry"
                    value={summary?.last_request_preview}
                  />
                </td>
                <td className="service-preview-cell">
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: service.name,
                      title: '마지막 응답',
                      value: summary?.last_response_preview ?? summary?.last_error,
                    })}
                    previewMode="first-entry"
                    value={summary?.last_response_preview ?? summary?.last_error}
                  />
                </td>
                <td className="service-response-time-cell">{formatMs(summary?.last_response_time_ms)}</td>
                <td className="service-hidden-cell">{service.hidden_by_default ? '예' : '아니오'}</td>
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
