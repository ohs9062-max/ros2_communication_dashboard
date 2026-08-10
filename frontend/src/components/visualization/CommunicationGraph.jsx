import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react'
import { useEffect, useMemo, useRef } from 'react'
import { GraphNodeCard } from './GraphNodeCard.jsx'
import {
  createGroupDragState,
  graphViewportSignature,
  mergeNodePositions,
  minimapColor,
  moveNodeGroup,
  pruneManualPositions,
  routeEdgesToNearestHandles,
} from './graphInteraction.js'

const NODE_TYPES = {
  communicationNode: GraphNodeCard,
}

export function CommunicationGraph({
  edges,
  layoutKey,
  nodes,
  onFitReady,
  onLayoutResetReady,
  onSelectNode,
  selectedNodeId,
  viewMode,
}) {
  const { fitView } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const dragging = useRef(false)
  const edgeUpdateFrame = useRef(0)
  const fittedGraphSignature = useRef('')
  const groupDrag = useRef(null)
  const manualPositions = useRef(new Map())
  const previousLayoutKey = useRef(layoutKey)
  const [displayedNodes, setDisplayedNodes, onNodesChange] = useNodesState([])
  const displayedEdges = useMemo(
    () => routeEdgesToNearestHandles(edges, displayedNodes),
    [displayedNodes, edges],
  )
  const viewportSignature = useMemo(
    () => graphViewportSignature(nodes, edges, layoutKey),
    [edges, layoutKey, nodes],
  )
  const fitOptions = useMemo(
    () => viewMode === 'connected'
      ? { maxZoom: 1.45, minZoom: 0.55, padding: 0.06 }
      : { maxZoom: 0.95, minZoom: 0.2, padding: 0.14 },
    [viewMode],
  )
  const refreshConnectedEdges = (nodeIds) => {
    window.cancelAnimationFrame(edgeUpdateFrame.current)
    edgeUpdateFrame.current = window.requestAnimationFrame(() => {
      updateNodeInternals(nodeIds)
    })
  }

  useEffect(() => () => {
    window.cancelAnimationFrame(edgeUpdateFrame.current)
  }, [])

  useEffect(() => {
    if (previousLayoutKey.current !== layoutKey) {
      previousLayoutKey.current = layoutKey
      manualPositions.current.clear()
    }
    if (dragging.current) {
      return
    }

    pruneManualPositions(manualPositions.current, nodes)
    setDisplayedNodes(mergeNodePositions(
      nodes,
      manualPositions.current,
      selectedNodeId,
    ))
  }, [layoutKey, nodes, selectedNodeId, setDisplayedNodes])

  useEffect(() => {
    onFitReady(() => fitView({ ...fitOptions, duration: 250 }))
  }, [fitOptions, fitView, onFitReady])

  useEffect(() => {
    onLayoutResetReady(() => {
      manualPositions.current.clear()
      fittedGraphSignature.current = viewportSignature
      setDisplayedNodes(mergeNodePositions(nodes, new Map(), selectedNodeId))
    })
  }, [
    nodes,
    onLayoutResetReady,
    selectedNodeId,
    setDisplayedNodes,
    viewportSignature,
  ])

  useEffect(() => {
    if (
      !nodes.length ||
      manualPositions.current.size > 0 ||
      fittedGraphSignature.current === viewportSignature
    ) {
      return
    }

    let fitFrame = 0
    const renderFrame = window.requestAnimationFrame(() => {
      fitFrame = window.requestAnimationFrame(() => {
        fittedGraphSignature.current = viewportSignature
        fitView(fitOptions)
      })
    })

    return () => {
      window.cancelAnimationFrame(renderFrame)
      window.cancelAnimationFrame(fitFrame)
    }
  }, [fitOptions, fitView, nodes.length, viewportSignature])

  return (
    <ReactFlow
      edges={displayedEdges}
      maxZoom={1.6}
      minZoom={0.2}
      nodeTypes={NODE_TYPES}
      nodes={displayedNodes}
      nodesDraggable
      onNodeClick={(_, node) => onSelectNode(node.id)}
      onNodeDrag={(_, node) => {
        const dragState = groupDrag.current
        if (!dragState) {
          refreshConnectedEdges([node.id])
          return
        }

        const delta = {
          x: node.position.x - dragState.origin.x,
          y: node.position.y - dragState.origin.y,
        }
        setDisplayedNodes((currentNodes) => moveNodeGroup(
          currentNodes,
          dragState,
          delta,
        ))
        refreshConnectedEdges([...dragState.initialPositions.keys()])
      }}
      onNodeDragStart={(event, node) => {
        dragging.current = true
        if (event.shiftKey) {
          groupDrag.current = createGroupDragState(displayedNodes, node)
        }
      }}
      onNodeDragStop={(_, node) => {
        dragging.current = false
        const dragState = groupDrag.current
        if (!dragState) {
          manualPositions.current.set(node.id, { ...node.position })
          refreshConnectedEdges([node.id])
          return
        }

        const delta = {
          x: node.position.x - dragState.origin.x,
          y: node.position.y - dragState.origin.y,
        }
        const movedNodes = moveNodeGroup(displayedNodes, dragState, delta)
        setDisplayedNodes(movedNodes)
        for (const movedNode of movedNodes) {
          if (movedNode.data.kind === dragState.kind) {
            manualPositions.current.set(
              movedNode.id,
              { ...movedNode.position },
            )
          }
        }
        refreshConnectedEdges([...dragState.initialPositions.keys()])
        groupDrag.current = null
      }}
      onNodesChange={onNodesChange}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#263244" gap={22} size={1} />
      <MiniMap
        maskColor="rgba(4, 8, 13, 0.72)"
        nodeColor={(node) => minimapColor(node.data.kind)}
        pannable
        zoomable
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
