import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchActions,
  fetchNodes,
  fetchServices,
  fetchTopics,
} from '../api/rosApi.js'
import { VISUALIZATION_POLL_INTERVAL_MS } from '../config/polling.js'
import { buildCommunicationGraph } from '../utils/graphTransform.js'
import { buildParticipantMaps } from '../utils/participants.js'
import { participantsForGraphNode, selectVisualizationNodes } from '../features/visualization/graphSelection.js'
import { useStableGraph } from '../features/visualization/useStableGraph.js'
import { usePolling } from './usePolling.js'

export function useVisualizationGraph() {
  const [activeOnly, setActiveOnly] = useState(true)
  const [includeHidden, setIncludeHidden] = useState(false)
  const [nodeFilterMode, setNodeFilterMode] = useState('primary')
  const [search, setSearch] = useState('')
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState('')
  const [selectedNodeName, setSelectedNodeName] = useState('')
  const [showActions, setShowActions] = useState(true)
  const [showServices, setShowServices] = useState(true)
  const [showTopics, setShowTopics] = useState(true)
  const [viewMode, setViewMode] = useState('nodes')

  const nodeState = usePolling(fetchNodes, VISUALIZATION_POLL_INTERVAL_MS, {
    initialData: { data: { nodes: [], meta: {} } },
  })
  const topicState = usePolling(fetchTopics, VISUALIZATION_POLL_INTERVAL_MS, {
    initialData: { data: [], meta: {} },
  })
  const serviceFetcher = useCallback(
    () => fetchServices({ includeHidden }),
    [includeHidden],
  )
  const serviceState = usePolling(serviceFetcher, VISUALIZATION_POLL_INTERVAL_MS, {
    initialData: { data: { services: [], meta: {} } },
  })
  const actionState = usePolling(fetchActions, VISUALIZATION_POLL_INTERVAL_MS, {
    initialData: { data: { actions: [], meta: {} } },
  })

  const nodes = useMemo(
    () => nodeState.data?.data?.nodes ?? [],
    [nodeState.data],
  )
  const topics = useMemo(
    () => topicState.data?.data ?? [],
    [topicState.data],
  )
  const services = useMemo(
    () => serviceState.data?.data?.services ?? [],
    [serviceState.data],
  )
  const actions = useMemo(
    () => actionState.data?.data?.actions ?? [],
    [actionState.data],
  )
  const participantMaps = useMemo(
    () => buildParticipantMaps(nodes),
    [nodes],
  )
  const filters = useMemo(
    () => ({
      activeOnly,
      includeHidden,
      search,
      selectedNodeName,
      showActions,
      showServices,
      showTopics,
      viewMode,
    }),
    [
      activeOnly,
      includeHidden,
      search,
      selectedNodeName,
      showActions,
      showServices,
      showTopics,
      viewMode,
    ],
  )
  const nextGraph = useMemo(
    () =>
      buildCommunicationGraph({
        actions,
        filters,
        nodes,
        services,
        topics,
      }),
    [actions, filters, nodes, services, topics],
  )
  const graph = useStableGraph(nextGraph)
  const selectedGraphNode = useMemo(() => {
    const graphNode =
      graph.nodes.find((node) => node.id === selectedGraphNodeId) ?? null
    if (!graphNode) {
      return null
    }

    return {
      ...graphNode,
      data: {
        ...graphNode.data,
        participants: participantsForGraphNode(graphNode, participantMaps),
      },
    }
  }, [graph.nodes, participantMaps, selectedGraphNodeId])

  useEffect(() => {
    if (
      selectedGraphNodeId ||
      !graph.nodes.length ||
      viewMode !== 'all'
    ) {
      return
    }

    setSelectedGraphNodeId(graph.nodes[0].id)
  }, [graph.nodes, selectedGraphNodeId, viewMode])

  const selectableNodes = useMemo(() => {
    return selectVisualizationNodes({ actions, includeHidden, nodeFilterMode, nodes, search, services, topics })
  }, [actions, includeHidden, nodeFilterMode, nodes, search, services, topics])

  const refresh = () => {
    nodeState.refresh()
    topicState.refresh()
    serviceState.refresh()
    actionState.refresh()
  }

  return {
    activeOnly,
    actions,
    error:
      nodeState.error ||
      topicState.error ||
      serviceState.error ||
      actionState.error,
    graph,
    includeHidden,
    loading:
      nodeState.loading ||
      topicState.loading ||
      serviceState.loading ||
      actionState.loading,
    nodes,
    nodeFilterMode,
    refresh,
    search,
    selectableNodes,
    selectedGraphNode,
    selectedGraphNodeId,
    selectedGraphNodeMissing:
      Boolean(selectedGraphNodeId) && !selectedGraphNode,
    selectedNodeName,
    services,
    setActiveOnly,
    setIncludeHidden,
    setNodeFilterMode,
    setSearch,
    setSelectedGraphNodeId,
    setSelectedNodeName,
    setShowActions,
    setShowServices,
    setShowTopics,
    setViewMode,
    showActions,
    showServices,
    showTopics,
    topics,
    viewMode,
  }
}
