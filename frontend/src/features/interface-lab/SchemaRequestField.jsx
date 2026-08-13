import { useState } from 'react'

import {
  defaultValue,
  isComplexType,
  isNumericType,
} from './model/schemaValues.js'

export function SchemaRequestField({ disabled = false, field, onChange, value }) {
  const [expanded, setExpanded] = useState(false)
  if (!field?.name) return null
  const type = field.type ?? ''

  if (type === 'bool' || type === 'boolean') {
    return (
      <label className="interface-service-field inline">
        <input checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <span>{field.name}</span>
      </label>
    )
  }

  if (isComplexType(type)) {
    return (
      <label className={`interface-service-field interface-json-field${expanded ? ' expanded' : ''}`}>
        <span className="interface-json-field-heading">
          <span>{field.name} <small>{type} · JSON</small></span>
          <button
            aria-expanded={expanded}
            className="interface-json-expand-button"
            onClick={(event) => {
              event.preventDefault()
              setExpanded((current) => !current)
            }}
            type="button"
          >
            {expanded ? '줄이기' : '크게 보기'}
          </button>
        </span>
        <textarea
          className="interface-json-input"
          disabled={disabled}
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value || 'null'))
            } catch {
              onChange(event.target.value)
            }
          }}
          spellCheck="false"
          value={typeof value === 'string' ? value : JSON.stringify(value ?? defaultValue(type), null, 2)}
          wrap="soft"
        />
      </label>
    )
  }

  return (
    <label className="interface-service-field">
      <span>{field.name} <small>{type}</small></span>
      <input disabled={disabled} onChange={(event) => onChange(event.target.value)} type={isNumericType(type) ? 'number' : 'text'} value={value ?? ''} />
    </label>
  )
}
