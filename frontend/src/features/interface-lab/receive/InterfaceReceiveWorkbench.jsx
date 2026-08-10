export function InterfaceReceiveWorkbench({ children, expanded, mode, onModeChange, onToggleExpanded }) {
  return (
    <div className="interface-receive-panel">
      <div className="interface-registry-heading interface-panel-heading">
        <strong>수신</strong>
        {mode !== 'mock' && (
          <button aria-pressed={expanded} className="interface-panel-expand-button" onClick={onToggleExpanded} type="button">
            {expanded ? '목록보기' : '크게보기'}
          </button>
        )}
      </div>
      <div className="interface-manual-tabs">
        <ModeButton active={mode === 'topic'} label="Topic 수신" mode="topic" onSelect={onModeChange} />
        <ModeButton active={mode === 'service'} label="Service 수신" mode="service" onSelect={onModeChange} />
        <ModeButton active={mode === 'action'} label="Action 수신" mode="action" onSelect={onModeChange} />
        <ModeButton active={mode === 'mock'} label="Mock 준비중" mode="mock" onSelect={onModeChange} />
      </div>
      {children}
      {mode === 'mock' && (
        <p className="interface-package-help">
          Service Server / Action Server mock receive는 준비중입니다. 자동으로 장비 제어 동작을 수행하지 않습니다.
        </p>
      )}
    </div>
  )
}

function ModeButton({ active, label, mode, onSelect }) {
  return <button className={active ? 'active' : ''} onClick={() => onSelect(mode)} type="button">{label}</button>
}
