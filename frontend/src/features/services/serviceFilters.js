import { isPrimaryService } from '../../utils/primaryFilters.js'
import { matchesResourceSearch } from '../../utils/resourceSearch.js'
import { matchesDomainFilter } from '../../utils/domainFilter.js'
import {
  isIssueService,
  isRunningService,
  matchesServicePresentationFilter,
  servicePresentation,
  serviceSearchValues,
} from './servicePresentation.js'

const LIFECYCLE_SERVICE_SUFFIXES = [
  '/change_state',
  '/get_available_states',
  '/get_available_transitions',
  '/get_state',
  '/get_transition_graph',
]
const COSTMAP_MANAGEMENT_MARKERS = [
  '/clear_around_',
  '/clear_except_',
  '/clear_entirely_',
  '/get_costmap',
  '/get_cost_',
  '/get_obstacle_layer',
  '/get_static_layer',
  '/get_voxel_layer',
]
const MANAGEMENT_SERVICE_MARKERS = ['/load_node', '/unload_node', '/load_map', '/reload_database']

export function filterServices({ primaryServices, search, services, statusFilter, selectedDomainId = null }) {
  const normalizedSearch = search.trim().toLowerCase()
  const baseServices = statusFilter === 'primary' ? primaryServices : services

  return baseServices.filter((service) => {
    const matchesSearch = matchesResourceSearch(
      service,
      normalizedSearch,
      serviceSearchValues(service),
    )
    return matchesSearch && matchesServiceFilter(service, statusFilter) && matchesDomainFilter(service, selectedDomainId)
  })
}

export function getPrimaryServices(services) {
  return services.filter((service) => (
    service.user_primary === true || !isInternalOrManagementService(service)
  ) && isPrimaryService(service))
}

export function getServiceUiSummary(services, primaryServices, meta) {
  const total = meta.count ?? ((meta.visible_count ?? services.length) + (meta.hidden_count ?? 0))
  const hiddenNotFetched = services.length < total ? (meta.hidden_count ?? 0) : 0
  return {
    activeCount: services.filter((service) => servicePresentation(service).effectiveStatus === 'active').length,
    internalManagementCount: services.filter(isInternalOrManagementService).length + hiddenNotFetched,
    issueCount: services.filter(isIssueService).length,
    primaryCount: primaryServices.length,
    waitingCount: services.filter((service) => servicePresentation(service).isWaiting).length,
    total,
  }
}

function matchesServiceFilter(service, filter) {
  if (filter === 'primary') return isPrimaryService(service)
  if (filter === 'all') return true
  if (filter === 'running') {
    return (
      isRunningService(service) &&
      !isInternalOrManagementService(service) &&
      (
        isPrimaryService(service) ||
        servicePresentation(service).hasCallHistory
      )
    )
  }
  if (filter === 'waiting') return servicePresentation(service).isWaiting
  if (filter === 'active') return servicePresentation(service).effectiveStatus === 'active'
  if (filter === 'issues') return isIssueService(service)
  return matchesServicePresentationFilter(service, filter)
}

export function isInternalOrManagementService(service) {
  const category = String(service.category ?? '')
  const name = String(service.name ?? '')
  const type = String(service.type ?? '')
  return (
    service.hidden_by_default === true ||
    category === 'parameter' || category === 'ros_internal' || category === 'action_internal' ||
    type.startsWith('lifecycle_msgs/srv/') || type.startsWith('composition_interfaces/srv/') ||
    LIFECYCLE_SERVICE_SUFFIXES.some((suffix) => name.endsWith(suffix)) ||
    name.includes('/_action/send_goal') || name.includes('/_action/get_result') ||
    name.includes('/_action/cancel_goal') || name.includes('/_container/') ||
    COSTMAP_MANAGEMENT_MARKERS.some((marker) => name.includes(marker)) ||
    name.includes('/lifecycle_manager_') || name.endsWith('/manage_nodes') ||
    MANAGEMENT_SERVICE_MARKERS.some((marker) => name.includes(marker))
  )
}
