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
import { isInternalNode, shouldShowNode } from './graphFilters.js'
import { connectionCount, layoutNodes } from './graphLayout.js'
import { buildNodeGraph } from './graphNodeView.js'

export function buildCommunicationGraph({
  actions = [],
  filters = {},
  nodes = [],
  services = [],
  topics = [],
}) {
  if (filters.viewMode === 'connected') {
    return buildNodeGraph({ actions, filters, nodes, services, topics })
  }

  const entityMaps = createEntityMaps({ actions, services, topics })
  const graphNodes = new Map()
  const graphEdges = new Map()
  const connections = new Map()

  for (const node of nodes) {
    if (!shouldShowNode(node, filters)) continue
    const nodeId = entityId('node', node.full_name ?? node.name)
    ensureGraphNode(graphNodes, connections, {
      entity: node,
      id: nodeId,
      kind: 'node',
      label: node.full_name ?? node.name,
      status: node.status,
      type: node.namespace,
    })

    if (filters.showTopics !== false) {
      for (const topic of node.topic_publishers ?? []) {
        addEntityEdge({
          connections, direction: 'out', edgeLabel: 'pub',
          entity: enrichTopic(topic, entityMaps.topic), entityKind: 'topic', filters,
          fromId: nodeId, graphEdges, graphNodes, toId: entityId('topic', topic.name),
        })
      }
      for (const topic of node.topic_subscribers ?? []) {
        addEntityEdge({
          connections, direction: 'in', edgeLabel: 'sub',
          entity: enrichTopic(topic, entityMaps.topic), entityKind: 'topic', filters,
          fromId: entityId('topic', topic.name), graphEdges, graphNodes, toId: nodeId,
        })
      }
    }

    if (filters.showServices !== false) {
      for (const service of node.service_clients ?? []) {
        addEntityEdge({
          connections, direction: 'out', edgeLabel: 'client',
          entity: enrichEntity(service, entityMaps.service), entityKind: 'service', filters,
          fromId: nodeId, graphEdges, graphNodes, toId: entityId('service', service.name),
        })
      }
      for (const service of node.service_servers ?? []) {
        addEntityEdge({
          connections, direction: 'in', edgeLabel: 'server',
          entity: enrichEntity(service, entityMaps.service), entityKind: 'service', filters,
          fromId: entityId('service', service.name), graphEdges, graphNodes, toId: nodeId,
        })
      }
    }

    if (filters.showActions !== false) {
      for (const action of node.action_clients ?? []) {
        addEntityEdge({
          connections, direction: 'out', edgeLabel: 'client',
          entity: enrichEntity(action, entityMaps.action), entityKind: 'action', filters,
          fromId: nodeId, graphEdges, graphNodes, toId: entityId('action', action.name),
        })
      }
      for (const action of node.action_servers ?? []) {
        addEntityEdge({
          connections, direction: 'in', edgeLabel: 'server',
          entity: enrichEntity(action, entityMaps.action), entityKind: 'action', filters,
          fromId: entityId('action', action.name), graphEdges, graphNodes, toId: nodeId,
        })
      }
    }
  }

  const searchedNodes = applySearch(graphNodes, graphEdges, filters.search)
  const laidOutNodes = layoutNodes([...searchedNodes.values()], connections)
  const visibleIds = new Set(laidOutNodes.map((node) => node.id))
  const visibleEdges = [...graphEdges.values()].filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
  )

  return {
    edges: visibleEdges,
    limited: laidOutNodes.length > 120 || visibleEdges.length > 300,
    mode: 'all',
    nodes: laidOutNodes,
    summary: {
      actionCount: countKind(laidOutNodes, 'action'),
      edgeCount: visibleEdges.length,
      nodeCount: countKind(laidOutNodes, 'node'),
      serviceCount: countKind(laidOutNodes, 'service'),
      topicCount: countKind(laidOutNodes, 'topic'),
    },
  }
}

export function nodeConnectionCount(node) {
  return connectionCount(node)
}

export function isHiddenGraphNode(node) {
  return isInternalNode(node)
}
