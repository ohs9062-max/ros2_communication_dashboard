import {
  addEntityEdge,
  applySearch,
  countKind,
  createEntityMaps,
  enrichEntity,
  enrichTopic,
  ensureGraphNode,
  entityId,
} from './graphElements.js'
import { shouldShowEntity } from './graphFilters.js'
import { layoutNodeView } from './graphLayout.js'

const NODE_VIEW_LIMITS = { action: 20, edge: 80, service: 20, topic: 30 }

export function buildNodeGraph({ actions = [], filters = {}, nodes = [], services = [], topics = [] }) {
  const selectedNode = nodes.find(
    (node) => (node.full_name ?? node.name) === filters.selectedNodeName,
  )
  if (!selectedNode) return emptyGraph('select_node')

  const entityMaps = createEntityMaps({ actions, services, topics })
  const graphNodes = new Map()
  const graphEdges = new Map()
  const connections = new Map()
  const limitState = { action: 0, edge: 0, hidden: false, service: 0, topic: 0 }
  const selectedId = entityId('node', selectedNode.full_name ?? selectedNode.name)

  ensureGraphNode(graphNodes, connections, {
    entity: selectedNode,
    id: selectedId,
    kind: 'node',
    label: selectedNode.full_name ?? selectedNode.name,
    status: selectedNode.status,
    type: selectedNode.namespace,
  })

  if (filters.showTopics !== false) {
    for (const topic of selectedNode.topic_subscribers ?? []) {
      addLimitedNodeEdge({
        bucket: 'topic', connections, edgeLabel: 'sub',
        entity: enrichTopic(topic, entityMaps.topic), entityKind: 'topic', filters,
        fromId: entityId('topic', topic.name), graphEdges, graphNodes, limitState, toId: selectedId,
      })
    }
    for (const topic of selectedNode.topic_publishers ?? []) {
      addLimitedNodeEdge({
        bucket: 'topic', connections, edgeLabel: 'pub',
        entity: enrichTopic(topic, entityMaps.topic), entityKind: 'topic', filters,
        fromId: selectedId, graphEdges, graphNodes, limitState, toId: entityId('topic', topic.name),
      })
    }
  }

  if (filters.showServices !== false) {
    for (const service of selectedNode.service_servers ?? []) {
      addLimitedNodeEdge({
        bucket: 'service', connections, edgeLabel: 'server',
        entity: enrichEntity(service, entityMaps.service), entityKind: 'service', filters,
        fromId: entityId('service', service.name), graphEdges, graphNodes, limitState, toId: selectedId,
      })
    }
    for (const service of selectedNode.service_clients ?? []) {
      addLimitedNodeEdge({
        bucket: 'service', connections, edgeLabel: 'client',
        entity: enrichEntity(service, entityMaps.service), entityKind: 'service', filters,
        fromId: selectedId, graphEdges, graphNodes, limitState, toId: entityId('service', service.name),
      })
    }
  }

  if (filters.showActions !== false) {
    for (const action of selectedNode.action_servers ?? []) {
      addLimitedNodeEdge({
        bucket: 'action', connections, edgeLabel: 'server',
        entity: enrichEntity(action, entityMaps.action), entityKind: 'action', filters,
        fromId: entityId('action', action.name), graphEdges, graphNodes, limitState, toId: selectedId,
      })
    }
    for (const action of selectedNode.action_clients ?? []) {
      addLimitedNodeEdge({
        bucket: 'action', connections, edgeLabel: 'client',
        entity: enrichEntity(action, entityMaps.action), entityKind: 'action', filters,
        fromId: selectedId, graphEdges, graphNodes, limitState, toId: entityId('action', action.name),
      })
    }
  }

  const searchedNodes = applySearch(graphNodes, graphEdges, filters.search)
  const laidOutNodes = layoutNodeView([...searchedNodes.values()], selectedId)
  const visibleIds = new Set(laidOutNodes.map((node) => node.id))
  const visibleEdges = [...graphEdges.values()].filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
  )

  return {
    edges: visibleEdges,
    limited: limitState.hidden,
    mode: 'connected',
    nodes: laidOutNodes,
    selectedNode,
    summary: {
      actionClientCount: selectedNode.action_client_count ?? 0,
      actionCount: countKind(laidOutNodes, 'action'),
      actionServerCount: selectedNode.action_server_count ?? 0,
      edgeCount: visibleEdges.length,
      nodeCount: countKind(laidOutNodes, 'node'),
      publishTopicCount: selectedNode.topic_publishers?.length ?? 0,
      serviceClientCount: selectedNode.service_client_count ?? 0,
      serviceCount: countKind(laidOutNodes, 'service'),
      serviceServerCount: selectedNode.service_server_count ?? 0,
      subscribeTopicCount: selectedNode.topic_subscribers?.length ?? 0,
      topicCount: countKind(laidOutNodes, 'topic'),
    },
  }
}

function addLimitedNodeEdge(options) {
  const { bucket, graphEdges, limitState } = options
  if (limitState.edge >= NODE_VIEW_LIMITS.edge || limitState[bucket] >= NODE_VIEW_LIMITS[bucket]) {
    limitState.hidden = true
    return
  }
  if (!options.entity?.name || !shouldShowEntity(options.entityKind, options.entity, options.filters)) return

  const before = graphEdges.size
  addEntityEdge(options)
  if (graphEdges.size > before) {
    limitState[bucket] += 1
    limitState.edge += 1
  }
}

function emptyGraph(reason) {
  return {
    edges: [],
    emptyReason: reason,
    limited: false,
    mode: 'connected',
    nodes: [],
    summary: { actionCount: 0, edgeCount: 0, nodeCount: 0, serviceCount: 0, topicCount: 0 },
  }
}
