export function ExecutionPanelHeading({ expanded, onClose, onToggleExpanded, showExpand, title }) {
  return (
    <div className="interface-registry-heading interface-panel-heading">
      <strong>{title}</strong>
      <div className="interface-panel-heading-actions">
      {showExpand && (
        <button aria-pressed={expanded} className="interface-panel-expand-button" onClick={onToggleExpanded} type="button">
          {expanded ? '목록보기' : '크게보기'}
        </button>
      )}
      <button aria-label={`${title} 닫기`} className="interface-panel-close-button" onClick={onClose} type="button">닫기 ×</button>
      </div>
    </div>
  )
}
