import { connectionCount } from './graphLayout.js'
import {
  isRegisteredAction,
  isRegisteredService,
  isRegisteredTopic,
} from './primaryFilters.js'

const INTERNAL_TOPICS = new Set([
  '/clock',
  '/parameter_events',
  '/rosout',
  '/tf',
  '/tf_static',
])

export function shouldShowNode(node, filters) {
  if (!filters.includeHidden && isInternalNode(node)) return false
  if (!filters.activeOnly) return true
  return node.status === 'active' || connectionCount(node) > 0
}

export function shouldShowEntity(kind, entity, filters) {
  if (!filters.includeHidden && isHiddenEntity(kind, entity)) return false
  if (!filters.activeOnly) return true
  return isActiveEntity(kind, entity)
}

export function isInternalNode(node) {
  const name = String(node.name ?? '')
  const fullName = String(node.full_name ?? '')
  return (
    node.is_internal === true
    || name.includes('ros2cli_daemon')
    || fullName.includes('ros2cli_daemon')
  )
}

function isActiveEntity(kind, entity) {
  if (kind === 'topic') {
    return (
      isRegisteredTopic(entity)
      || entity.status === 'active'
      || (entity.publisher_count ?? 0) > 0
      || (entity.subscriber_count ?? 0) > 0
    )
  }

  return (
    (kind === 'service' && isRegisteredService(entity))
    || (kind === 'action' && isRegisteredAction(entity))
    || entity.status === 'active'
    || (entity.server_count ?? 0) > 0
    || (entity.client_count ?? 0) > 0
  )
}

function isHiddenEntity(kind, entity) {
  if (kind === 'topic') {
    return (
      INTERNAL_TOPICS.has(entity.name)
      || entity.name?.endsWith('/_action/status')
      || entity.name?.endsWith('/_action/feedback')
      || entity.name?.endsWith('/_service_event')
    )
  }

  return (
    entity.hidden_by_default === true
    || (entity.category && entity.category !== 'user')
    || entity.name?.includes('/_action/')
    || entity.name?.endsWith('/get_type_description')
    || entity.name?.endsWith('/describe_parameters')
    || entity.name?.endsWith('/get_parameter_types')
    || entity.name?.endsWith('/get_parameters')
    || entity.name?.endsWith('/list_parameters')
    || entity.name?.endsWith('/set_parameters')
    || entity.name?.endsWith('/set_parameters_atomically')
    || entity.name?.endsWith('/change_state')
    || entity.name?.endsWith('/get_state')
  )
}
