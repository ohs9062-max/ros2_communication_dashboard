import { useCallback, useMemo, useState } from 'react'
import { fetchAlerts, fetchNodes, fetchServices } from '../api/rosApi.js'
import { DASHBOARD_POLL_INTERVAL_MS } from '../config/polling.js'
import { buildParticipantMaps } from '../utils/participants.js'
import { usePolling } from './usePolling.js'
import { useUserPriority } from './useUserPriority.js'

const serviceName = (service) => service.name

export function useServiceDashboard({ enabled = true } = {}) {
  const [includeHidden, setIncludeHidden] = useState(false)
  const [selectedServiceName, setSelectedServiceName] = useState('')
  const [qosFocusRequest, setQosFocusRequest] = useState(null)
  const focusQosDetails = useCallback((name, channel = null) => {
    setQosFocusRequest({ channel, name, requestId: Date.now() })
  }, [])

  const servicesFetcher = useCallback(
    () => fetchServices({ includeHidden }),
    [includeHidden],
  )
  const servicesState = usePolling(servicesFetcher, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: { services: [], meta: {} } },
    resetKey: includeHidden,
  })
  const alertsState = usePolling(fetchAlerts, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: [], meta: {} },
  })
  const nodeState = usePolling(fetchNodes, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: { nodes: [], meta: {} } },
  })

  const rawServices = useMemo(
    () => servicesState.data?.data?.services ?? [],
    [servicesState.data],
  )
  const priority = useUserPriority({
    items: rawServices,
    kind: 'services',
    nameOf: serviceName,
    refresh: servicesState.refresh,
  })
  const services = priority.items
  const meta = servicesState.data?.data?.meta ?? {}
  const nodes = useMemo(
    () => nodeState.data?.data?.nodes ?? [],
    [nodeState.data],
  )
  const { serviceParticipants } = useMemo(
    () => buildParticipantMaps(nodes, { excludeInternal: true }),
    [nodes],
  )
  const serviceAlerts = useMemo(
    () =>
      (alertsState.data?.data ?? []).filter(
        (alert) => alert.source === 'service',
      ),
    [alertsState.data],
  )
  const selectedService = useMemo(
    () =>
      services.find((service) => service.name === selectedServiceName) ??
      null,
    [selectedServiceName, services],
  )

  return {
    alerts: alertsState,
    error: servicesState.error,
    includeHidden,
    loading: servicesState.loading,
    focusQosDetails,
    meta,
    selectedService,
    selectedServiceName,
    qosFocusRequest,
    serviceAlerts,
    serviceParticipants,
    services,
    setIncludeHidden,
    setSelectedServiceName,
    priorityError: priority.priorityError,
    toggleUserPriority: priority.toggleUserPriority,
    isPriorityPending: priority.isPriorityPending,
  }
}
