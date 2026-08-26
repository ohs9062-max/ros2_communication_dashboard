import { useState } from 'react'

import { StatusBadge } from './StatusBadge.jsx'
import { displayText } from '../utils/displayText.js'

export function AlertsPreview({
  alerts,
  collapsedItems = 3,
  collapsible = false,
  compactItems = false,
  emptyMessage = '현재 Alert가 없습니다',
  error,
  maxItems = 5,
  onAlertClick,
  showSource = true,
  title = '최근 Alert',
}) {
  const [expanded, setExpanded] = useState(false)
  const recentItems = (alerts ?? []).slice(0, maxItems)
  const items =
    collapsible && !expanded
      ? recentItems.slice(0, collapsedItems)
      : recentItems
  const tone = alertTone(recentItems)

  if (!recentItems.length && !error) {
    return (
      <section className="alerts-preview compact-empty-alert empty">
        <span>{emptyMessage}</span>
      </section>
    )
  }

  return (
    <section
      className={[
        'alerts-preview',
        tone,
        compactItems ? 'compact-items' : '',
        collapsible ? 'collapsible' : '',
        expanded ? 'expanded' : 'collapsed',
      ].filter(Boolean).join(' ')}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        <div className="alerts-preview-heading-actions">
          {error && <span className="error-text">{error}</span>}
          {collapsible && recentItems.length > collapsedItems && (
            <button
              aria-expanded={expanded}
              className="alerts-preview-toggle"
              onClick={() => setExpanded((current) => !current)}
              type="button"
            >
              {expanded ? '접기' : `펼치기 (${recentItems.length})`}
            </button>
          )}
        </div>
      </div>
      {!items.length ? (
        <div className="empty-state compact">{emptyMessage}</div>
      ) : (
        <div className="alert-list">
          {items.map((alert) => (
            <AlertItem
              alert={alert}
              key={alert.id}
              onClick={onAlertClick}
              showSource={showSource}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function AlertItem({ alert, onClick, showSource }) {
  const domainId = alertDomainId(alert)
  const resourceLabel = domainId === null
    ? alert.name
    : `${alert.name} · D${domainId}`

  return (
    <button
      className="alert-item"
      onClick={() => onClick?.(alert)}
      type="button"
    >
      <StatusBadge
        value={
          alert.alert_state === 'resolved'
            ? 'resolved'
            : alert.level
        }
      />
      <div className="alert-item-content">
        <strong title={resourceLabel}>{resourceLabel}</strong>
        <p>{displayText(alert.message)}</p>
        {showSource && <span className="muted">{displayText(alert.source)}</span>}
      </div>
    </button>
  )
}

function alertDomainId(alert) {
  const direct = Number(alert?.domain_id)
  if (Number.isInteger(direct) && direct >= 0 && direct <= 232) {
    return direct
  }

  const domainText = String(alert?.resource_key ?? '').split(':', 1)[0]
  return /^\d+$/.test(domainText) ? Number(domainText) : null
}

function alertTone(alerts) {
  const activeAlerts = alerts.filter(
    (alert) => alert.alert_state !== 'resolved',
  )
  if (!activeAlerts.length) {
    return 'empty'
  }

  if (
    activeAlerts.some((alert) =>
      ['error', 'critical'].includes(String(alert.level || '').toLowerCase()),
    )
  ) {
    return 'has-error'
  }

  return 'has-warning'
}
