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
    nodeUsesRegisteredInterface(node, { actions, services, topics })
  )
}

function nodeUsesRegisteredInterface(node, resources) {
  return (
    relationsUseTypes(
      [...(node.topic_publishers ?? []), ...(node.topic_subscribers ?? [])],
      registeredTypes(resources.topics, isRegisteredTopic),
    ) ||
    relationsUseTypes(
      [...(node.service_servers ?? []), ...(node.service_clients ?? [])],
      registeredTypes(resources.services, isRegisteredService),
    ) ||
    relationsUseTypes(
      [...(node.action_servers ?? []), ...(node.action_clients ?? [])],
      registeredTypes(resources.actions, isRegisteredAction),
    )
  )
}

function registeredTypes(items, predicate) {
  return new Set(
    items
      .filter(predicate)
      .flatMap((item) => item.types ?? [item.type])
      .filter(Boolean),
  )
}

function relationsUseTypes(relations, types) {
  return types.size > 0 && relations.some((relation) =>
    (relation.types ?? [relation.type]).some((type) => types.has(type)),
  )
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
  isRegisteredAction,
  isRegisteredService,
  isRegisteredTopic,
} from './primaryFilters.js'
