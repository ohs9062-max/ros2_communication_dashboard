export function isInternalNode(node) {
  const name = String(node.name ?? '')
  const fullName = String(node.full_name ?? '')
  return (
    node.is_internal === true ||
    name.includes('ros2cli_daemon') ||
    fullName.includes('ros2cli_daemon')
  )
}

export function isPrimaryNode(
  node,
  { actions = [], services = [], topics = [] } = {},
) {
  const fullName = normalizeNodeName(node.full_name ?? node.name)

  if (isHiddenFromPrimary(node, fullName)) {
    return false
  }

  return (
    node.status === 'disconnected' ||
    node.primary === true ||
    nodeUsesPrimaryCommunication(node, { actions, services, topics })
  )
}

function nodeUsesPrimaryCommunication(node, resources) {
  return (
    relationsUseResources(
      [...(node.topic_publishers ?? []), ...(node.topic_subscribers ?? [])],
      primaryResources(resources.topics, isPrimaryTopic),
    ) ||
    relationsUseResources(
      [...(node.service_servers ?? []), ...(node.service_clients ?? [])],
      primaryResources(resources.services, isPrimaryService),
    ) ||
    relationsUseResources(
      [...(node.action_servers ?? []), ...(node.action_clients ?? [])],
      primaryResources(resources.actions, isPrimaryAction),
    )
  )
}

function primaryResources(items, predicate) {
  return new Set(
    items
      .filter(predicate)
      .flatMap((item) =>
        (item.types ?? [item.type]).map((type) => resourceKey(item.name, type)),
      )
      .filter(Boolean),
  )
}

function relationsUseResources(relations, resources) {
  return resources.size > 0 && relations.some((relation) =>
    (relation?.types ?? [relation?.type]).some((type) =>
      resources.has(resourceKey(relation?.name, type)),
    ),
  )
}

function resourceKey(name, type) {
  return name && type ? `${name}\n${type}` : ''
}

function isHiddenFromPrimary(node, fullName) {
  return (
    fullName.startsWith('/transform_listener_impl_') ||
    fullName.startsWith('/launch_ros_') ||
    fullName.includes('_rclcpp_node') ||
    fullName.includes('_action_client') ||
    isInternalNode(node)
  )
}

function normalizeNodeName(name) {
  const value = String(name ?? '')
  return value.startsWith('/') ? value : `/${value}`
}

import {
  isPrimaryAction,
  isPrimaryService,
  isPrimaryTopic,
} from './primaryFilters.js'
