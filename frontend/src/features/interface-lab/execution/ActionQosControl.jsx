import { ManualQosFields } from './QosModeControl.jsx'

const GROUPS = [
  { key: 'service', label: 'Service QoS' },
  { key: 'topic', label: 'Topic QoS' },
]

export function ActionQosControl({ controls = [], modeLinked = false, onModeLinkChange }) {
  const mode = controls[0]?.mode ?? 'auto'
  const onModeChange = controls[0]?.onModeChange
  return (
    <div className="interface-qos-control interface-action-qos-control">
      <div className="interface-qos-mode-row">
        <label className="interface-service-field">
          <span>QoS Mode</span>
          <select onChange={(event) => onModeChange?.(event.target.value)} value={mode}>
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        {onModeLinkChange && (
          <label className="interface-qos-mode-link">
            <input checked={modeLinked} onChange={(event) => onModeLinkChange(event.target.checked)} type="checkbox" />
            <span>실행/수신 연동</span>
          </label>
        )}
      </div>
      {mode === 'manual' && GROUPS.map((group) => (
        <fieldset className="interface-action-qos-group" key={group.key}>
          <legend>{group.label}</legend>
          {controls.filter((control) => control.group === group.key).map((control) => (
            <details className="interface-action-qos-channel" key={control.key}>
              <summary>{control.label}</summary>
              <ManualQosFields onChange={control.onProfileChange} profile={control.profile} />
            </details>
          ))}
        </fieldset>
      ))}
    </div>
  )
}
