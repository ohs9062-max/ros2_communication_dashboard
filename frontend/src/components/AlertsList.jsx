import { useMemo, useState } from 'react'
import { formatTime } from '../utils/format.js'
import { displayText } from '../utils/displayText.js'
import { nextSortState, sortRows } from '../utils/sort.js'
import { SortableHeader } from './SortableHeader.jsx'
import { StatusBadge } from './StatusBadge.jsx'

const ALERT_SORT_COLUMNS = {
  status: { value: (alert) => alert.alert_state },
  level: { value: (alert) => alert.level },
  source: { value: (alert) => alert.source },
  name: { value: (alert) => alert.name },
  message: { value: (alert) => alert.message },
  code: { value: (alert) => alert.code },
  detected_at: {
    defaultDirection: 'desc',
    value: detectedAt,
  },
  resolved_at: {
    defaultDirection: 'desc',
    value: (alert) => alert.resolved_at,
  },
}

const LEVEL_LABELS = {
  warning: '경고',
  error: '오류',
  critical: '치명적',
}

export function AlertsList({
  alerts,
  emptyMessage = '현재 Alert가 없습니다',
  onAlertClick,
  variant = 'current',
}) {
  const previous = variant === 'previous'
  const [sort, setSort] = useState({
    key: previous ? 'resolved_at' : 'detected_at',
    direction: 'desc',
  })
  const sortedAlerts = useMemo(
    () => sortRows(alerts, sort, ALERT_SORT_COLUMNS),
    [alerts, sort],
  )
  const onSort = (key) => setSort((current) =>
    nextSortState(current, key, ALERT_SORT_COLUMNS),
  )

  if (!alerts.length) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="table-wrap">
      <table className="topic-table">
        <thead>
          <tr>
            <SortableHeader columnKey="status" label="상태" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="level" label="레벨" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="source" label="출처" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="name" label="이름" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="message" label="메시지" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="code" label="코드" onSort={onSort} sort={sort} />
            <SortableHeader columnKey="detected_at" label="감지 시각" onSort={onSort} sort={sort} />
            {previous && (
              <SortableHeader columnKey="resolved_at" label="해결 시각" onSort={onSort} sort={sort} />
            )}
          </tr>
        </thead>
        <tbody>
          {sortedAlerts.map((alert) => (
            <tr
              key={previous ? `${alert.id}:${alert.resolved_at}` : alert.id}
              onClick={() => onAlertClick?.(alert)}
            >
              <td>
                <StatusBadge
                  label={previous ? '해결됨' : '발생 중'}
                  value={previous ? 'resolved' : activeAlertTone(alert.level)}
                />
              </td>
              <td>
                <StatusBadge
                  label={LEVEL_LABELS[String(alert.level || '').toLowerCase()] ?? alert.level}
                  value={alert.level}
                />
              </td>
              <td>{displayText(alert.source)}</td>
              <td className="topic-name">{alert.name}</td>
              <td>{displayText(alert.message)}</td>
              <td>{alert.code}</td>
              <td>{formatTime(detectedAt(alert))}</td>
              {previous && <td>{formatTime(alert.resolved_at)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function detectedAt(alert) {
  return alert.first_detected_at ?? alert.detected_at
}

function activeAlertTone(level) {
  return String(level || '').toLowerCase() === 'warning' ? 'warning' : 'error'
}
