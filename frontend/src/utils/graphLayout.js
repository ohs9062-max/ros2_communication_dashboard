const NODE_GAP_Y = 112
const COLUMN_WIDTH = 330

export function layoutNodes(nodes, connections) {
  const buckets = {
    action: [],
    node: [],
    service: [],
    topic: [],
  }

  for (const node of nodes) {
    buckets[node.data.kind]?.push(node)
  }

  return [
    ...positionBucket(buckets.node, 0, connections),
    ...positionBucket(buckets.topic, 1, connections),
    ...positionBucket(buckets.service, 2, connections),
    ...positionBucket(buckets.action, 3, connections),
  ]
}

export function layoutNodeView(nodes, selectedId) {
  const selected = nodes.find((node) => node.id === selectedId)
  const buckets = {
    action: [],
    pubTopic: [],
    service: [],
    subTopic: [],
  }

  for (const node of nodes) {
    if (node.id === selectedId) {
      continue
    }
    if (node.data.kind === 'topic') {
      const incomingToSelected = node.data.connections?.outgoing
        .some((connection) => connection.id === selectedId)
      buckets[incomingToSelected ? 'subTopic' : 'pubTopic'].push(node)
    } else if (node.data.kind === 'service') {
      buckets.service.push(node)
    } else if (node.data.kind === 'action') {
      buckets.action.push(node)
    }
  }

  return [
    ...positionNodeViewBucket(buckets.subTopic, 0, 0),
    selected && {
      ...selected,
      position: { x: 360, y: 170 },
    },
    ...positionNodeViewBucket(buckets.pubTopic, 720, 0),
    ...positionNodeViewBucket(buckets.service, 120, 390),
    ...positionNodeViewBucket(buckets.action, 600, 390),
  ].filter(Boolean)
}

function positionNodeViewBucket(nodes, x, y) {
  return nodes
    .sort((left, right) => String(left.data.label).localeCompare(right.data.label))
    .map((node, index) => ({
      ...node,
      position: {
        x,
        y: y + index * NODE_GAP_Y,
      },
    }))
}

function positionBucket(nodes, columnIndex, connections) {
  return nodes
    .sort((left, right) => scoreNode(right, connections) - scoreNode(left, connections))
    .map((node, index) => ({
      ...node,
      position: {
        x: columnIndex * COLUMN_WIDTH,
        y: index * NODE_GAP_Y,
      },
    }))
}

function scoreNode(node, connections) {
  const entry = connections.get(node.id)
  return (entry?.incoming.length ?? 0) + (entry?.outgoing.length ?? 0)
}

export function connectionCount(node) {
  return (
    (node.publisher_count ?? 0) +
    (node.subscriber_count ?? 0) +
    (node.service_server_count ?? 0) +
    (node.service_client_count ?? 0) +
    (node.action_server_count ?? 0) +
    (node.action_client_count ?? 0)
  )
}
