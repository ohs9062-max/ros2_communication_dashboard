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
  serviceEffectiveStatus,
  servicePresentation,
} from '../features/services/servicePresentation.js'

const SERVICE_SORT_COLUMNS = {
  status: { value: serviceEffectiveStatus },
  name: { value: (service) => service.name },
  type: { value: (service) => service.type },
  server_count: { value: (service) => servicePresentation(service).serverNodeCount, defaultDirection: 'desc' },
  client_count: { value: (service) => servicePresentation(service).clientNodeCount, defaultDirection: 'desc' },
  request: { value: (service) => compactDataPreview(servicePresentation(service).requestPreview) },
  response: { value: (service) => compactDataPreview(servicePresentation(service).responsePreview) },
  response_time: { value: (service) => servicePresentation(service).responseTimeMs, defaultDirection: 'desc' },
  last_call: { value: (service) => servicePresentation(service).lastCalledAt, defaultDirection: 'desc' },
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
            <SortableHeader columnKey="server_count" headerClassName="diagnostic-count-column" label="Server" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="client_count" headerClassName="diagnostic-count-column" label="Client" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="request" headerClassName="diagnostic-data-column" label="마지막 Request" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="response" headerClassName="diagnostic-data-column" label="마지막 Response" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="response_time" headerClassName="diagnostic-time-column" label="마지막 응답 시간" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="last_call" headerClassName="service-last-call-column" label="마지막 호출" onSort={onSort} sort={sort} />
          </tr>
        </thead>
        <tbody>
          {sortedServices.map((service) => {
            const presentation = servicePresentation(service)
            const selected = (service.resource_key ?? service.name) === selectedServiceName
            return (
              <tr
                className={selected ? 'selected' : ''}
                data-monitor-name={service.name}
                key={service.resource_key ?? service.name}
                onClick={() => onSelectService(service.resource_key ?? service.name)}
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
                      label={presentation.statusLabel}
                      value={presentation.effectiveStatus}
                    />
                    <QosStatusBadge qos={service} />
                  </div>
                </td>
                <td className="topic-name service-name service-name-cell ellipsis-cell" title={service.name}>{service.name} <span className="muted">· D{service.domain_id ?? 0}</span></td>
                <td className="topic-type service-type service-type-cell ellipsis-cell" title={service.type ?? '-'}>{service.type ?? '-'}</td>
                <td className="diagnostic-count-cell">{presentation.serverNodeCount}</td>
                <td className="diagnostic-count-cell">{presentation.clientNodeCount}</td>
                <td className="diagnostic-data-cell">
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: service.name,
                      title: '마지막 Request',
                      value: presentation.requestPreview,
                    })}
                    value={presentation.requestPreview}
                  />
                </td>
                <td className="diagnostic-data-cell">
                  <JsonPreviewButton
                    onOpen={() => setPreview({
                      name: service.name,
                      title: '마지막 Response',
                      value: presentation.responsePreview,
                    })}
                    value={presentation.responsePreview}
                  />
                </td>
                <td className="diagnostic-time-cell">{formatMs(presentation.responseTimeMs)}</td>
                <td className="service-last-call-cell">{formatRelativeTime(presentation.lastCalledAt)}</td>
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
