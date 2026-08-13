import { useCallback, useState } from 'react'
import { fetchActions, fetchServices, fetchTopics } from '../../../api/monitoring.js'
import {
  fetchInterfaceApplyStatus,
  fetchInterfacePackages,
  fetchInterfaceRegistry,
} from '../../../api/interfaceManagement.js'
import {
  fetchActionGoalHistory,
  fetchCallableActions,
  fetchCallableMessages,
  fetchCallableServices,
  fetchContinuousTopicPublishes,
  fetchReceiveTopicHistory,
  fetchReceiveTopics,
  fetchServiceCallHistory,
  fetchTopicPublishHistory,
} from '../../../api/interfaceExecution.js'

const EMPTY_REGISTRY = { messages: [], services: [], actions: [] }

const REQUESTS = [
  ['registry', fetchInterfaceRegistry],
  ['status', fetchInterfaceApplyStatus],
  ['callableMessages', fetchCallableMessages],
  ['callableServices', fetchCallableServices],
  ['callableActions', fetchCallableActions],
  ['packages', fetchInterfacePackages],
  ['serviceHistory', fetchServiceCallHistory],
  ['actionHistory', fetchActionGoalHistory],
  ['topicPublishHistory', fetchTopicPublishHistory],
  ['continuousTopicPublishes', fetchContinuousTopicPublishes],
  ['topicReceiveHistory', fetchReceiveTopicHistory],
  ['receiveTopics', fetchReceiveTopics],
  ['topics', fetchTopics],
  ['graphServices', () => fetchServices({ includeHidden: true })],
  ['graphActions', fetchActions],
]

export function useInterfaceLabSnapshot() {
  const [snapshot, setSnapshot] = useState({
    registry: EMPTY_REGISTRY,
    applyStatus: null,
    callableMessages: [],
    callableServices: [],
    callableActions: [],
    graphServices: [],
    graphActions: [],
    packages: [],
    serviceHistory: [],
    actionHistory: [],
    topicPublishHistory: [],
    continuousTopicPublishes: [],
    topicReceiveHistory: [],
    receiveTopics: [],
    topics: [],
  })
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)

  const refreshSnapshot = useCallback(async () => {
    setRefreshing(true)
    try {
      const results = await Promise.allSettled(REQUESTS.map(([, request]) => request()))
      const payloads = Object.fromEntries(
        results.flatMap((result, index) =>
          result.status === 'fulfilled' ? [[REQUESTS[index][0], result.value]] : []),
      )
      setSnapshot((current) => ({
        ...current,
        ...(payloads.registry && { registry: payloads.registry.data ?? EMPTY_REGISTRY }),
        ...(payloads.status && { applyStatus: payloads.status.data ?? null }),
        ...(payloads.callableMessages && { callableMessages: payloads.callableMessages.data ?? [] }),
        ...(payloads.callableServices && { callableServices: payloads.callableServices.data ?? [] }),
        ...(payloads.callableActions && { callableActions: payloads.callableActions.data ?? [] }),
        ...(payloads.packages && { packages: payloads.packages.data ?? [] }),
        ...(payloads.serviceHistory && { serviceHistory: payloads.serviceHistory.data ?? [] }),
        ...(payloads.actionHistory && { actionHistory: payloads.actionHistory.data ?? [] }),
        ...(payloads.topicPublishHistory && { topicPublishHistory: payloads.topicPublishHistory.data ?? [] }),
        ...(payloads.continuousTopicPublishes && { continuousTopicPublishes: payloads.continuousTopicPublishes.data ?? [] }),
        ...(payloads.topicReceiveHistory && { topicReceiveHistory: payloads.topicReceiveHistory.data ?? [] }),
        ...(payloads.receiveTopics && { receiveTopics: payloads.receiveTopics.data ?? [] }),
        ...(payloads.topics && { topics: payloads.topics.data?.topics ?? payloads.topics.data ?? [] }),
        ...(payloads.graphServices && { graphServices: payloads.graphServices.data?.services ?? payloads.graphServices.data ?? [] }),
        ...(payloads.graphActions && { graphActions: payloads.graphActions.data?.actions ?? payloads.graphActions.data ?? [] }),
      }))
      setLastRefreshedAt(new Date())
      const failures = results.filter((result) => result.status === 'rejected')
      return failures.length
        ? new Error(`Failed to load some status data (${failures.length}/${REQUESTS.length}). Available data was still applied. ${failures[0].reason?.message ?? ''}`)
        : null
    } finally {
      setRefreshing(false)
    }
  }, [])

  const updateSnapshotField = useCallback((field, value) => {
    setSnapshot((current) => ({
      ...current,
      [field]: typeof value === 'function' ? value(current[field]) : value,
    }))
  }, [])

  return { lastRefreshedAt, refreshSnapshot, refreshing, snapshot, updateSnapshotField }
}
