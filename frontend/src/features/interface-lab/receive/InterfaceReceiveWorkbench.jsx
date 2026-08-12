export function InterfaceReceiveWorkbench({ children, expanded, mode, onClose, onModeChange, onToggleExpanded }) {
  return (
    <div className="interface-receive-panel">
      <div className="interface-registry-heading interface-panel-heading">
        <strong>수신</strong>
        <div className="interface-panel-heading-actions">
        {mode !== 'mock' && (
          <button aria-pressed={expanded} className="interface-panel-expand-button" onClick={onToggleExpanded} type="button">
            {expanded ? '목록보기' : '크게보기'}
          </button>
        )}
        <button aria-label="수신 패널 닫기" className="interface-panel-close-button" onClick={onClose} type="button">닫기 ×</button>
        </div>
      </div>
      <div className="interface-manual-tabs">
        <ModeButton active={mode === 'topic'} label="Topic 수신" mode="topic" onSelect={onModeChange} />
        <ModeButton active={mode === 'service'} label="Service 수신" mode="service" onSelect={onModeChange} />
        <ModeButton active={mode === 'action'} label="Action 수신" mode="action" onSelect={onModeChange} />
      </div>
      {children}
    </div>
  )
}

function ModeButton({ active, label, mode, onSelect }) {
  return <button className={active ? 'active' : ''} onClick={() => onSelect(mode)} type="button">{label}</button>
}
