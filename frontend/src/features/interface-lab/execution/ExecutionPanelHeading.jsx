export function ExecutionPanelHeading({ expanded, onToggleExpanded, showExpand, title }) {
  return (
    <div className="interface-registry-heading interface-panel-heading">
      <strong>{title}</strong>
      {showExpand && (
        <button aria-pressed={expanded} className="interface-panel-expand-button" onClick={onToggleExpanded} type="button">
          {expanded ? '목록보기' : '크게보기'}
        </button>
      )}
    </div>
  )
}
