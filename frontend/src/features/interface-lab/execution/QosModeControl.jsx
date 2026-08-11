export function ManualQosFields({ label, onChange, profile }) {
  const change = (key, value) => onChange({ ...profile, [key]: value })
  return (
    <fieldset className="interface-qos-profile">
      {label && <legend>{label}</legend>}
      <label className="interface-service-field">
        <span>Reliability</span>
        <select onChange={(event) => change('reliability', event.target.value)} value={profile.reliability}>
          <option value="reliable">RELIABLE</option>
          <option value="best_effort">BEST_EFFORT</option>
        </select>
      </label>
      <label className="interface-service-field">
        <span>Durability</span>
        <select onChange={(event) => change('durability', event.target.value)} value={profile.durability}>
          <option value="volatile">VOLATILE</option>
          <option value="transient_local">TRANSIENT_LOCAL</option>
        </select>
      </label>
      <label className="interface-service-field">
        <span>History</span>
        <select onChange={(event) => change('history', event.target.value)} value={profile.history}>
          <option value="keep_last">KEEP_LAST</option>
          <option value="keep_all">KEEP_ALL</option>
        </select>
      </label>
      <label className="interface-service-field">
        <span>Depth</span>
        <input
          disabled={profile.history !== 'keep_last'}
          min="1"
          onChange={(event) => change('depth', Number(event.target.value))}
          step="1"
          type="number"
          value={profile.depth}
        />
        {profile.history !== 'keep_last' && <small>KEEP_ALL에서는 적용하지 않습니다.</small>}
      </label>
      <details className="interface-qos-advanced">
        <summary>고급 설정</summary>
        <div className="interface-qos-advanced-body">
          <DurationField field="deadline" label="Deadline" onChange={change} profile={profile} />
          <DurationField field="lifespan" label="Lifespan" onChange={change} profile={profile} />
          <label className="interface-service-field">
            <span>Liveliness</span>
            <select onChange={(event) => change('liveliness', event.target.value)} value={profile.liveliness ?? 'system_default'}>
              <option value="system_default">SYSTEM_DEFAULT</option>
              <option value="automatic">AUTOMATIC</option>
              <option value="manual_by_topic">MANUAL_BY_TOPIC</option>
            </select>
          </label>
          <DurationField field="lease_duration" label="Lease Duration" onChange={change} profile={profile} />
        </div>
      </details>
    </fieldset>
  )
}

function DurationField({ field, label, onChange, profile }) {
  const duration = profile[field] ?? { value: '', unit: 'ms' }
  const changeDuration = (key, value) => onChange(field, { ...duration, [key]: value })
  return (
    <label className="interface-service-field interface-qos-duration-field">
      <span>{label}</span>
      <div className="interface-qos-duration-input">
        <input
          min="0"
          onChange={(event) => changeDuration('value', event.target.value)}
          placeholder="기본값"
          step="any"
          type="number"
          value={duration.value ?? ''}
        />
        <select onChange={(event) => changeDuration('unit', event.target.value)} value={duration.unit ?? 'ms'}>
          <option value="ns">ns</option>
          <option value="us">us</option>
          <option value="ms">ms</option>
          <option value="s">s</option>
        </select>
      </div>
    </label>
  )
}

export function QosModeControl({ groups, mode, modeLinked = false, onModeChange, onModeLinkChange }) {
  return (
    <div className="interface-qos-control">
      <div className="interface-qos-mode-row">
        <label className="interface-service-field">
          <span>QoS Mode</span>
          <select onChange={(event) => onModeChange(event.target.value)} value={mode}>
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
      {mode === 'manual' && groups.map((group) => (
        <ManualQosFields key={group.key} label={group.label} onChange={group.onChange} profile={group.profile} />
      ))}
    </div>
  )
}
