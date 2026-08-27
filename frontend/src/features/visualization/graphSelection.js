import { isHiddenGraphNode, nodeConnectionCount } from '../../utils/graphTransform.js'
import { isInternalNode } from '../../utils/nodeFilters.js'

export function selectVisualizationNodes({
  includeHidden,
  nodeFilterMode,
  nodes,
  search,
}) {
  const normalizedSearch = search.trim().toLowerCase()
  return nodes
    .filter((node) => {
      if (nodeFilterMode === 'active') return node.status === 'active' && !isInternalNode(node)
      return includeHidden || !isHiddenGraphNode(node)
    })
    .filter((node) => {
      if (!normalizedSearch) return true
      return [node.full_name, node.name, node.namespace].some(
        (value) => String(value ?? '').toLowerCase().includes(normalizedSearch),
      )
    })
    .sort((left, right) => {
      const activeDelta = Number(right.status === 'active') - Number(left.status === 'active')
      return activeDelta || nodeConnectionCount(right) - nodeConnectionCount(left)
    })
}

export function participantsForGraphNode(graphNode, participantMaps) {
  const { kind, label } = graphNode.data ?? {}
  if (kind === 'topic') {
    return participantMaps.topicParticipants[label] ?? { publishers: [], subscribers: [] }
  }
  if (kind === 'service') {
    return participantMaps.serviceParticipants[label] ?? { clients: [], servers: [] }
  }
  if (kind === 'action') {
    return participantMaps.actionParticipants[label] ?? { clients: [], servers: [] }
  }
  return null
}
