import { useEffect, useMemo, useState } from 'react'
import { fetchAlerts, fetchNodes } from '../api/rosApi.js'
import { DASHBOARD_POLL_INTERVAL_MS } from '../config/polling.js'
import { usePolling } from './usePolling.js'

export function useNodeDashboard({ enabled = true } = {}) {
  const [selectedNodeName, setSelectedNodeName] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('primary')
  const [includeInternalNodes, setIncludeInternalNodes] = useState(false)

  const nodesState = usePolling(fetchNodes, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: { nodes: [], meta: {} } },
  })
  const alertsState = usePolling(fetchAlerts, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: [], meta: {} },
  })

  const nodes = useMemo(
    () => nodesState.data?.data?.nodes ?? [],
    [nodesState.data],
  )
  const meta = nodesState.data?.data?.meta ?? {}
  const nodeAlerts = useMemo(
    () =>
      (alertsState.data?.data ?? []).filter(
        (alert) => alert.source === 'node' || alert.code === 'node_stale',
      ),
    [alertsState.data],
  )
  const selectedNode = useMemo(
    () =>
      nodes.find((node) => node.full_name === selectedNodeName) ?? null,
    [nodes, selectedNodeName],
  )

  useEffect(() => {
    if (selectedNodeName && selectedNode) {
      return
    }

    setSelectedNodeName(nodes[0]?.full_name ?? '')
  }, [nodes, selectedNode, selectedNodeName])

  return {
    alerts: alertsState,
    error: nodesState.error,
    includeInternalNodes,
    loading: nodesState.loading,
    meta,
    nodeAlerts,
    nodes,
    refresh: nodesState.refresh,
    search,
    setSelectedNode: setSelectedNodeName,
    selectedNode,
    selectedNodeName,
    setIncludeInternalNodes,
    setSearch,
    setSelectedNodeName,
    setStatusFilter,
    statusFilter,
  }
}
