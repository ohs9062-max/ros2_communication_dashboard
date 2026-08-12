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
import { ExecutionQosSummary } from '../InterfaceExecutionShared.jsx'

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
  return (
    <>
      {value.qos && <ExecutionQosSummary qos={value.qos} />}
      <CollapsibleJson title={title} value={value} />
    </>
  )
}

export function HistoryList({ empty, items = [], onReset, onSelect, selected, type }) {
  return (
    <div className="interface-history-list">
      <SectionTitle title={type === 'service' ? '최근 호출 이력' : '최근 실행 이력'} />
      {!items.length && <p className="muted interface-history-empty">{empty}</p>}
      {items.slice(0, 3).map((item) => (
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
      {onReset && <HistoryManagement onReset={onReset} />}
    </div>
  )
}

function HistoryManagement({ onReset }) {
  return <details className="interface-history-management"><summary>History 관리</summary><div className="interface-history-management-actions"><button className="interface-history-reset-badge selected" onClick={() => window.confirm('현재 선택한 Interface의 이력을 초기화할까요?') && onReset('selected')} type="button">선택 이력 초기화</button><button className="interface-history-reset-badge all" onClick={() => window.confirm('이 Interface 종류의 전체 실행 이력을 초기화할까요?') && onReset('all')} type="button">전체 이력 초기화</button></div></details>
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
