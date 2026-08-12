import { useCallback, useMemo, useState } from 'react'
import { fetchActions, fetchAlerts, fetchNodes } from '../api/rosApi.js'
import { DASHBOARD_POLL_INTERVAL_MS } from '../config/polling.js'
import { buildParticipantMaps } from '../utils/participants.js'
import { usePolling } from './usePolling.js'
import { useUserPriority } from './useUserPriority.js'

const actionName = (action) => action.name

export function useActionDashboard({ enabled = true } = {}) {
  const [includeIdleActions, setIncludeIdleActions] = useState(false)
  const [selectedActionName, setSelectedActionName] = useState('')
  const [qosFocusRequest, setQosFocusRequest] = useState(null)
  const focusQosDetails = useCallback((name, channel = null) => {
    setQosFocusRequest({ channel, name, requestId: Date.now() })
  }, [])

  const actionsState = usePolling(fetchActions, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: { actions: [], meta: {} } },
  })
  const alertsState = usePolling(fetchAlerts, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: [], meta: {} },
  })
  const nodeState = usePolling(fetchNodes, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: { nodes: [], meta: {} } },
  })

  const rawActions = useMemo(
    () => actionsState.data?.data?.actions ?? [],
    [actionsState.data],
  )
  const priority = useUserPriority({
    items: rawActions,
    kind: 'actions',
    nameOf: actionName,
    refresh: actionsState.refresh,
  })
  const actions = priority.items
  const meta = actionsState.data?.data?.meta ?? {}
  const nodes = useMemo(
    () => nodeState.data?.data?.nodes ?? [],
    [nodeState.data],
  )
  const { actionParticipants } = useMemo(
    () => buildParticipantMaps(nodes, { excludeInternal: true }),
    [nodes],
  )
  const actionAlerts = useMemo(
    () =>
      (alertsState.data?.data ?? []).filter(
        (alert) => alert.source === 'action',
      ),
    [alertsState.data],
  )
  const selectedAction = useMemo(
    () =>
      actions.find((action) => action.name === selectedActionName) ??
      null,
    [selectedActionName, actions],
  )

  return {
    actionAlerts,
    actionParticipants,
    actions,
    alerts: alertsState,
    error: actionsState.error,
    focusQosDetails,
    includeIdleActions,
    loading: actionsState.loading,
    meta,
    refresh: actionsState.refresh,
    selectedAction,
    selectedActionName,
    qosFocusRequest,
    setIncludeIdleActions,
    setSelectedActionName,
    priorityError: priority.priorityError,
    toggleUserPriority: priority.toggleUserPriority,
    isPriorityPending: priority.isPriorityPending,
  }
}
