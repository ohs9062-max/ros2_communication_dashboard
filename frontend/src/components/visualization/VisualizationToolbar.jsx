export function VisualizationToolbar({
  activeOnly,
  error,
  includeHidden,
  isActiveNodeFilter,
  isAllNodeFilter,
  isNodeMode,
  isPrimaryNodeFilter,
  loading,
  onActiveOnlyChange,
  onFitView,
  onGlobalView,
  onIncludeHiddenChange,
  onNodeView,
  onRefresh,
  onResetLayout,
  onSearchChange,
  onShowActionsChange,
  onShowEverything,
  onShowServicesChange,
  onShowTopicsChange,
  onConnectedView,
  search,
  showActions,
  showServices,
  showTopics,
}) {
  return (
    <section className="topic-section visualization-toolbar">
      <div className="filter-toolbar">
        <div aria-label="시각화 모드" className="visualization-mode-tabs" role="group">
          <ToggleButton active={isPrimaryNodeFilter} label="주요 노드" onClick={onNodeView} />
          <ToggleButton active={isActiveNodeFilter} label="실행 노드" onClick={onConnectedView} />
          <ToggleButton active={isAllNodeFilter} label="전체 노드" onClick={onGlobalView} />
        </div>
        <input
          aria-label="통신 그래프 검색"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={isNodeMode ? 'Node 이름 또는 namespace 검색' : '연결된 Topic, Service, Action 검색'}
          type="search"
          value={search}
        />
        {!isNodeMode && (
          <div className="service-filter-actions">
            <ToggleButton active={activeOnly} label="주요 항목" onClick={() => onActiveOnlyChange(!activeOnly)} />
            <ToggleButton active={showTopics} label="Topic" onClick={() => onShowTopicsChange(!showTopics)} />
            <ToggleButton active={showServices} label="Service" onClick={() => onShowServicesChange(!showServices)} />
            <ToggleButton active={showActions} label="Action" onClick={() => onShowActionsChange(!showActions)} />
            <ToggleButton active={includeHidden} label="숨김 포함" onClick={() => onIncludeHiddenChange(!includeHidden)} />
          </div>
        )}
      </div>
      {!isNodeMode && (
        <div className="visualization-actions">
          {loading && <span className="muted">갱신 중</span>}
          {error && <span className="error-text">Failed to connect to the Graph API.</span>}
          <span className="muted">Shift + 드래그: 같은 종류 묶음 이동</span>
          <button className="filter" onClick={onFitView} type="button">화면 맞춤</button>
          <button className="filter" onClick={onResetLayout} type="button">배치 초기화</button>
          <button className="filter" onClick={onShowEverything} type="button">전체 Graph</button>
          <button className="filter active" onClick={onRefresh} type="button">새로고침</button>
        </div>
      )}
    </section>
  )
}

function ToggleButton({ active, label, onClick }) {
  return (
    <button className={active ? 'filter active' : 'filter'} onClick={onClick} type="button">
      {label}
    </button>
  )
}
