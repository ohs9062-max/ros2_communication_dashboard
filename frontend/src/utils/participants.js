export function buildParticipantMaps(nodes = [], { excludeInternal = false } = {}) {
  const topicParticipants = {}
  const serviceParticipants = {}
  const actionParticipants = {}

  for (const node of nodes) {
    if (
      node.graph_present === false ||
      (excludeInternal && node.is_internal === true)
    ) {
      continue
    }
    const nodeName = node.full_name || node.name
    const domainId = node.domain_id
    if (!nodeName) {
      continue
    }

    addParticipants(
      topicParticipants,
      node.topic_publishers,
      'publishers',
      nodeName,
      domainId,
    )
    addParticipants(
      topicParticipants,
      node.topic_subscribers,
      'subscribers',
      nodeName,
      domainId,
    )
    addParticipants(
      serviceParticipants,
      node.service_servers,
      'servers',
      nodeName,
      domainId,
    )
    addParticipants(
      serviceParticipants,
      node.service_clients,
      'clients',
      nodeName,
      domainId,
    )
    addParticipants(
      actionParticipants,
      node.action_servers,
      'servers',
      nodeName,
      domainId,
    )
    addParticipants(
      actionParticipants,
      node.action_clients,
      'clients',
      nodeName,
      domainId,
    )
  }

  return {
    actionParticipants: normalizeParticipantMap(actionParticipants),
    serviceParticipants: normalizeParticipantMap(serviceParticipants),
    topicParticipants: normalizeParticipantMap(topicParticipants),
  }
}

export function withExecutionNode(items = [], executionNode) {
  if (!executionNode?.name) return items
  if (items.some((item) => (typeof item === 'string' ? item : item?.name) === executionNode.name)) {
    return items
  }
  return [...items, executionNode]
}

function addParticipants(map, entities = [], role, nodeName, domainId) {
  for (const entity of entities ?? []) {
    const entityName = entityNameOf(entity)
    if (!entityName) {
      continue
    }

    const key = Number.isInteger(domainId) ? `${domainId}:${entityName}` : entityName
    map[key] ??= {}
    map[key][role] ??= new Set()
    map[key][role].add(nodeName)
  }
}

function entityNameOf(entity) {
  if (typeof entity === 'string') {
    return entity
  }
  return entity?.name
}

function normalizeParticipantMap(map) {
  const normalized = {}
  for (const [name, roles] of Object.entries(map)) {
    normalized[name] = Object.fromEntries(
      Object.entries(roles).map(([role, values]) => [
        role,
        [...values].sort((left, right) => left.localeCompare(right)),
      ]),
    )
  }
  return normalized
}
