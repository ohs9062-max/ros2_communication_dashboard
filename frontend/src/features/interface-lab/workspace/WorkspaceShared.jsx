import {
  defaultValue,
  isArrayType,
  isComplexType,
  isNumericType,
} from '../model/schemaValues.js'
import {
  historyKey,
  historyLabel,
} from '../model/executionHistory.js'

export function SectionTitle({ title }) {
  return <h4 className="interface-detail-section-title">{title}</h4>
}

export function ConnectionList({ empty, items = [], render }) {
  if (!items.length) return <p className="muted">{empty}</p>
  return (
    <ul className="interface-connection-list">
      {items.map((item, index) => (
        <li key={`${index}-${render(item)}`}>{render(item)}</li>
      ))}
    </ul>
  )
}

export function LastResultBlock({ fallback, result, title }) {
  const value = result ?? fallback
  if (!value) return <CollapsibleJson title={title} value={{ status: '아직 결과 없음' }} />
  return <CollapsibleJson title={title} value={value} />
}

export function HistoryList({ empty, items = [], onSelect, selected, type }) {
  if (!items.length) return <p className="muted">{empty}</p>
  return (
    <div className="interface-history-list">
      <SectionTitle title={type === 'service' ? '최근 호출 이력' : '최근 실행 이력'} />
      {items.slice(0, 20).map((item) => (
        <button
          className={selected === item ? 'selected' : ''}
          key={historyKey(item, type)}
          onClick={() => onSelect(selected === item ? null : item)}
          type="button"
        >
          {historyLabel(item, type)}
        </button>
      ))}
      {selected && <CollapsibleJson title="선택한 이력 전체 JSON" value={selected} />}
    </div>
  )
}

export function Badge({ label, tone = 'neutral' }) {
  return <span className={`interface-badge ${tone}`}>{label}</span>
}

export function CollapsibleJson({ title, value }) {
  return (
    <details className="interface-detail-block">
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  )
}

export function CollapsibleText({ title, value }) {
  return (
    <details className="interface-detail-block">
      <summary>{title}</summary>
      <pre>{value}</pre>
    </details>
  )
}

export function RequestField({ field, onChange, value }) {
  if (!field?.name) return null
  const type = field.type ?? ''
  if (type === 'bool' || type === 'boolean') {
    return (
      <label className="interface-service-field inline">
        <input
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>{field.name}</span>
      </label>
    )
  }
  if (isComplexType(type)) {
    return (
      <label className="interface-service-field">
        <span>{field.name} <small>{type} · JSON</small></span>
        <textarea
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value || 'null'))
            } catch {
              onChange(event.target.value)
            }
          }}
          rows={isArrayType(type) ? 4 : 3}
          value={typeof value === 'string' ? value : JSON.stringify(value ?? defaultValue(type), null, 2)}
        />
      </label>
    )
  }
  const numeric = isNumericType(type)
  return (
    <label className="interface-service-field">
      <span>{field.name} <small>{type}</small></span>
      <input
        onChange={(event) => onChange(event.target.value)}
        type={numeric ? 'number' : 'text'}
        value={value ?? ''}
      />
    </label>
  )
}
