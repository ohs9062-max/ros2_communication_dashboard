const NODE_WIDTH = 286
const NODE_HEIGHT = 156

export function mergeNodePositions(nodes, manualPositions, selectedNodeId) {
  return nodes.map((node) => ({
    ...node,
    position: manualPositions.get(node.id) ?? node.position,
    selected: node.id === selectedNodeId,
  }))
}

export function createGroupDragState(nodes, draggedNode) {
  return {
    initialPositions: new Map(
      nodes
        .filter((node) => node.data.kind === draggedNode.data.kind)
        .map((node) => [node.id, { ...node.position }]),
    ),
    kind: draggedNode.data.kind,
    origin: { ...draggedNode.position },
  }
}

export function moveNodeGroup(nodes, dragState, delta) {
  return nodes.map((node) => {
    const initialPosition = dragState.initialPositions.get(node.id)
    if (!initialPosition) return node
    return {
      ...node,
      position: {
        x: initialPosition.x + delta.x,
        y: initialPosition.y + delta.y,
      },
    }
  })
}

export function pruneManualPositions(manualPositions, nodes) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  for (const nodeId of manualPositions.keys()) {
    if (!nodeIds.has(nodeId)) manualPositions.delete(nodeId)
  }
}

export function graphViewportSignature(nodes, edges, layoutKey) {
  const nodeSignature = nodes.map(
    (node) => `${node.id}:${node.position.x}:${node.position.y}`,
  ).join('|')
  const edgeSignature = edges.map(
    (edge) => `${edge.id}:${edge.source}:${edge.target}`,
  ).join('|')
  return `${layoutKey}::${nodeSignature}::${edgeSignature}`
}

export function routeEdgesToNearestHandles(edges, nodes) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  return edges.map((edge) => {
    const source = nodesById.get(edge.source)
    const target = nodesById.get(edge.target)
    if (!source || !target) return edge

    const sourceCenter = nodeCenter(source)
    const targetCenter = nodeCenter(target)
    const deltaX = targetCenter.x - sourceCenter.x
    const deltaY = targetCenter.y - sourceCenter.y
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return deltaX >= 0
        ? withEdgeHandles(edge, 'right', 'left')
        : withEdgeHandles(edge, 'left', 'right')
    }
    return deltaY >= 0
      ? withEdgeHandles(edge, 'bottom', 'top')
      : withEdgeHandles(edge, 'top', 'bottom')
  })
}

function nodeCenter(node) {
  const width = node.measured?.width ?? NODE_WIDTH
  const height = node.measured?.height ?? NODE_HEIGHT
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  }
}

function withEdgeHandles(edge, sourceSide, targetSide) {
  return {
    ...edge,
    sourceHandle: `source-${sourceSide}`,
    targetHandle: `target-${targetSide}`,
  }
}

export function minimapColor(kind) {
  if (kind === 'node') return '#60a5fa'
  if (kind === 'topic') return '#34d399'
  if (kind === 'service') return '#fbbf24'
  return '#f87171'
}
