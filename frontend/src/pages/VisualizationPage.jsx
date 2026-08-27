import '@xyflow/react/dist/style.css'
import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useRef } from 'react'
import { SummaryCard } from '../components/SummaryCard.jsx'
import { CommunicationGraph } from '../components/visualization/CommunicationGraph.jsx'
import { VisualizationDetailPanel } from '../components/visualization/VisualizationDetailPanel.jsx'
import { VisualizationNodePicker } from '../components/visualization/VisualizationNodePicker.jsx'
import { VisualizationToolbar } from '../components/visualization/VisualizationToolbar.jsx'
import { useVisualizationGraph } from '../hooks/useVisualizationGraph.js'

export function VisualizationPage({ websocket }) {
  const dashboard = useVisualizationGraph()
  const fitViewRef = useRef(null)
  const resetLayoutRef = useRef(null)
  const {
    activeOnly,
    error,
    graph,
    includeHidden,
    loading,
    actions,
    nodes,
    nodeFilterMode,
    refresh,
    search,
    selectableNodes,
    selectedGraphNode,
    selectedGraphNodeId,
    selectedGraphNodeMissing,
    selectedNodeName,
    setActiveOnly,
    setIncludeHidden,
    setNodeFilterMode,
    setSearch,
    setSelectedGraphNodeId,
    setSelectedNodeName,
    setShowActions,
    setShowServices,
    setShowTopics,
    setViewMode,
    showActions,
    showServices,
    showTopics,
    services,
    topics,
    viewMode,
  } = dashboard

  const showEverything = () => {
    setActiveOnly(false)
    setIncludeHidden(true)
    setShowActions(true)
    setShowServices(true)
    setShowTopics(true)
    setViewMode('all')
    setNodeFilterMode('all')
    setSearch('')
  }
  const showGlobalView = () => {
    setNodeFilterMode('all')
    setSelectedNodeName('')
    setSelectedGraphNodeId('')
    setViewMode('nodes')
  }
  const selectNode = (nodeName) => {
    setSelectedNodeName(nodeName)
    setSelectedGraphNodeId(`node:${nodeName}`)
    setViewMode('connected')
  }
  const showConnectedView = () => {
    setNodeFilterMode('active')
    setSelectedNodeName('')
    setSelectedGraphNodeId('')
    setViewMode('nodes')
    setActiveOnly(true)
  }
  const setFitViewHandler = useCallback((fitView) => {
    fitViewRef.current = fitView
  }, [])
  const setResetLayoutHandler = useCallback((resetLayout) => {
    resetLayoutRef.current = resetLayout
  }, [])
  const emptyMessage = viewMode === 'connected' && !selectedNodeName
    ? 'Node를 선택하면 해당 Node와 직접 연결된 Topic, Service, Action 관계를 표시합니다.'
    : viewMode === 'connected'
      ? '선택한 Node와 직접 연결된 항목이 없습니다.'
      : '현재 조건에 맞는 연결이 없습니다. 전체 보기를 누르거나 검색/필터를 조정하세요.'
  const isNodeMode = viewMode === 'nodes'
  const isConnectedMode = viewMode === 'connected'
  const isAllMode = viewMode === 'all'
  const isActiveNodeFilter = nodeFilterMode === 'active'
  const isAllNodeFilter = nodeFilterMode === 'all'

  return (
    <main
      className={
        isNodeMode
          ? 'topics-page visualization-page node-list-mode'
          : 'topics-page visualization-page'
      }
    >
      <section className="main-panel">
        <section className="topic-section page-intro visualization-hero">
          <div className="section-heading">
            <div>
              <h2>통신 시각화</h2>
              <p className="muted">
                ROS2 Graph의 Node, Topic, Service, Action 연결 관계를
                운영 화면에서 바로 훑어봅니다.
              </p>
            </div>
          </div>
        </section>

        <div className="summary-grid visualization-summary-grid">
          {isNodeMode ? (
            <>
              <SummaryCard label="전체 Node" value={nodes.length} />
              <SummaryCard label="표시 Node" value={selectableNodes.length} />
              <SummaryCard label="전체 Topic" value={topics.length} />
              <SummaryCard label="전체 Service" value={services.length} />
              <SummaryCard label="전체 Action" value={actions.length} />
            </>
          ) : selectedNodeName && isConnectedMode ? (
            <>
              <SummaryCard label="구독 Topic" value={graph.summary.subscribeTopicCount ?? 0} />
              <SummaryCard label="발행 Topic" value={graph.summary.publishTopicCount ?? 0} />
              <SummaryCard label="응답 Service" value={graph.summary.serviceServerCount ?? 0} />
              <SummaryCard label="요청 Service" value={graph.summary.serviceClientCount ?? 0} />
              <SummaryCard label="Action" value={(graph.summary.actionServerCount ?? 0) + (graph.summary.actionClientCount ?? 0)} />
            </>
          ) : (
            <>
              <SummaryCard label="Node" value={graph.summary.nodeCount} />
              <SummaryCard label="Topic" value={graph.summary.topicCount} />
              <SummaryCard label="Service" value={graph.summary.serviceCount} />
              <SummaryCard label="Action" value={graph.summary.actionCount} />
              <SummaryCard
                label="연결"
                tone={graph.summary.edgeCount ? 'good' : 'default'}
                value={graph.summary.edgeCount}
              />
            </>
          )}
        </div>

        {isAllMode && (
          <section className="notice-text warning visualization-mode-warning">
            전체 중심은 ROS2 Graph 전체 관계를 표시하므로 항목이 많으면
            복잡하게 보일 수 있습니다. Node를 선택한 뒤 연결 중심 보기를
            권장합니다.
          </section>
        )}

        <VisualizationToolbar
          activeOnly={activeOnly}
          error={error}
          includeHidden={includeHidden}
          isActiveNodeFilter={isActiveNodeFilter}
          isAllNodeFilter={isAllNodeFilter}
          isNodeMode={isNodeMode}
          loading={loading}
          onActiveOnlyChange={setActiveOnly}
          onConnectedView={showConnectedView}
          onFitView={() => fitViewRef.current?.()}
          onGlobalView={showGlobalView}
          onIncludeHiddenChange={setIncludeHidden}
          onRefresh={refresh}
          onResetLayout={() => resetLayoutRef.current?.()}
          onSearchChange={setSearch}
          onShowActionsChange={setShowActions}
          onShowEverything={showEverything}
          onShowServicesChange={setShowServices}
          onShowTopicsChange={setShowTopics}
          search={search}
          showActions={showActions}
          showServices={showServices}
          showTopics={showTopics}
        />

        {isNodeMode && (
          <VisualizationNodePicker
            error={error}
            loading={loading}
            nodes={selectableNodes}
            onSelect={selectNode}
          />
        )}

        {graph.limited && !isNodeMode && (
          <section className="notice-text warning visualization-mode-warning">
            연결 항목이 많아 일부만 표시합니다. 검색 또는 내부 항목 필터를
            조정하세요.
          </section>
        )}

        {!isNodeMode && (
          <section className="topic-section visualization-canvas-section">
            <ReactFlowProvider>
              <div className="visualization-flow-wrap">
                <CommunicationGraph
                  edges={graph.edges}
                  layoutKey={`${viewMode}:${selectedNodeName}`}
                  nodes={graph.nodes}
                  onFitReady={setFitViewHandler}
                  onLayoutResetReady={setResetLayoutHandler}
                  onSelectNode={setSelectedGraphNodeId}
                  selectedNodeId={selectedGraphNodeId}
                  viewMode={viewMode}
                />
                {!graph.nodes.length && (
                  <div className="visualization-empty-overlay">
                    <div className="empty-state compact">{emptyMessage}</div>
                    <button
                      className="filter active"
                      onClick={showEverything}
                      type="button"
                    >
                      전체 보기
                    </button>
                  </div>
                )}
              </div>
            </ReactFlowProvider>
          </section>
        )}
      </section>

      {!isNodeMode && (
        <VisualizationDetailPanel
          graphNode={selectedGraphNode}
          missingNodeId={selectedGraphNodeMissing ? selectedGraphNodeId : ''}
        />
      )}
    </main>
  )
}
