const topicKey = (topic) => topic.resource_key ?? topic.name

/**
 * Node 종료 Alert를 그 Node가 마지막으로 연결돼 있던 Topic에 투영합니다.
 * Topic Alert 자체를 새로 만들지 않고, Topic 탭에서만 원인을 따라갈 수 있게
 * presentation item을 만듭니다.
 */
export function mapNodeAlertsToTopics({ alerts = [], nodes = [], topics = [] } = {}) {
  const topicByDomainAndName = new Map(
    topics.map((topic) => [domainAndName(topic.domain_id, topic.name), topic]),
  )
  const nodesByKey = new Map(nodes.map((node) => [node.resource_key, node]))

  return alerts.flatMap((alert) => {
    if (alert.source !== 'node' && alert.code !== 'node_stale') return []

    const node = nodesByKey.get(alert.resource_key) ?? findNode(nodes, alert)
    if (!node) return []

    const relatedNames = new Set([
      ...entityNames(node.topic_publishers),
      ...entityNames(node.topic_subscribers),
    ])
    const domainId = Number.isInteger(node.domain_id) ? node.domain_id : alert.domain_id

    return [...relatedNames].flatMap((name) => {
      const topic = topicByDomainAndName.get(domainAndName(domainId, name))
      if (!topic) return []

      return [{
        ...alert,
        id: `${alert.id}:topic:${topicKey(topic)}`,
        mapped_topic_alert: true,
        name: topic.name,
        resource_key: topicKey(topic),
        domain_id: topic.domain_id,
      }]
    })
  })
}

function findNode(nodes, alert) {
  return nodes.find((node) =>
    node.full_name === alert.name
    || node.name === alert.name,
  )
}

function entityNames(entities = []) {
  return entities
    .map((entity) => typeof entity === 'string' ? entity : entity?.name)
    .filter(Boolean)
}

function domainAndName(domainId, name) {
  return `${Number.isInteger(domainId) ? domainId : ''}:${name ?? ''}`
}
