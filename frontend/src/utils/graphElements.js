import { shouldShowEntity } from './graphFilters.js'

export function createEntityMaps({ actions, services, topics }) {
  return {
    action: new Map(actions.map((action) => [action.name, action])),
    service: new Map(services.map((service) => [service.name, service])),
    topic: new Map(topics.map((topic) => [topic.name, topic])),
  }
}

export function addEntityEdge({
  connections,
  direction,
  edgeLabel,
  entity,
  entityKind,
  filters,
  fromId,
  graphEdges,
  graphNodes,
  toId,
}) {
  if (!entity?.name || !shouldShowEntity(entityKind, entity, filters)) return

  ensureGraphNode(graphNodes, connections, {
    entity,
    id: entityId(entityKind, entity.name),
    kind: entityKind,
    label: entity.name,
    status: entity.status,
    type: entity.type ?? entity.types?.[0],
  })
  addConnection(connections, fromId, toId, edgeLabel, direction)
  const edgeId = `${edgeLabel}:${fromId}->${toId}`
  graphEdges.set(edgeId, {
    animated: edgeLabel === 'pub' || edgeLabel === 'client',
    className: `comm-edge edge-${edgeLabel}`,
    id: edgeId,
    label: edgeLabel,
    source: fromId,
    target: toId,
    type: 'smoothstep',
  })
}

export function ensureGraphNode(graphNodes, connections, item) {
  if (!item.id || graphNodes.has(item.id)) return
  connections.set(item.id, { incoming: [], outgoing: [] })
  graphNodes.set(item.id, {
    data: { ...item, connections: connections.get(item.id) },
    id: item.id,
    position: { x: 0, y: 0 },
    type: 'communicationNode',
  })
}

export function applySearch(graphNodes, graphEdges, search) {
  const normalized = String(search ?? '').trim().toLowerCase()
  if (!normalized) return graphNodes

  const matchedIds = new Set()
  for (const [id, node] of graphNodes) {
    if (nodeMatches(node, normalized)) matchedIds.add(id)
  }
  for (const edge of graphEdges.values()) {
    if (matchedIds.has(edge.source) || matchedIds.has(edge.target)) {
      matchedIds.add(edge.source)
      matchedIds.add(edge.target)
    }
  }
  return new Map([...graphNodes].filter(([id]) => matchedIds.has(id)))
}

export function enrichTopic(topic, topicMap) {
  return {
    ...topic,
    ...topicMap.get(topic.name),
    name: topic.name,
    type: topic.type ?? topic.types?.[0] ?? topicMap.get(topic.name)?.types?.[0],
  }
}

export function enrichEntity(entity, entityMap) {
  return {
    ...entity,
    ...entityMap.get(entity.name),
    name: entity.name,
    type: entity.type ?? entityMap.get(entity.name)?.type,
  }
}

export function entityId(kind, name) {
  return `${kind}:${name}`
}

export function countKind(nodes, kind) {
  return nodes.filter((node) => node.data.kind === kind).length
}

function addConnection(connections, fromId, toId, label, direction) {
  const from = connections.get(fromId)
  const to = connections.get(toId)
  if (!from || !to) return
  from.outgoing.push({ id: toId, label, relation: direction })
  to.incoming.push({ id: fromId, label, relation: direction })
}

function nodeMatches(node, search) {
  const data = node.data
  return [data.label, data.type, data.status, data.kind]
    .some((value) => String(value ?? '').toLowerCase().includes(search))
}
