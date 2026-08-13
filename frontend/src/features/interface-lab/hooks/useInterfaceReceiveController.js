import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchCallableActions,
  fetchCallableMessages,
  fetchCallableServices,
  fetchContinuousTopicPublishes,
  fetchReceiveActionHistory,
  fetchReceiveServiceHistory,
  fetchReceiveTopicHistory,
  fetchReceiveTopics,
  fetchTopicPublishHistory,
  resetReceiveActionHistory,
  resetReceiveServiceHistory,
} from '../../../api/interfaceExecution.js'
import { fetchTopics } from '../../../api/monitoring.js'
import { actionKey, serviceKey } from '../model/interfaceUploadModel.js'
import { runSingleFlight } from '../model/singleFlight.js'
import { useActionExecutionQos } from './useExecutionQos.js'
import { useResourceReceiveObserver } from './useResourceReceiveObserver.js'
import { useTopicReceiveController } from './useTopicReceiveController.js'

export function useInterfaceReceiveController({
  actions,
  availableTopics,
  replaceActions,
  replaceMessages,
  replaceServices,
  selectedMessage,
  selectedReceiveActionKey,
  selectedReceiveServiceKey,
  services,
  setAvailableTopics,
  setBusy,
  setFeedback,
  setSelectedReceiveActionKey,
  setSelectedReceiveServiceKey,
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('topic')
  const [topics, setTopics] = useState([])
  const [topicHistory, setTopicHistory] = useState([])
  const [serviceHistory, setServiceHistory] = useState([])
  const [actionHistory, setActionHistory] = useState([])
  const pollInFlightRef = useRef(false)
  const actionQos = useActionExecutionQos()

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setBusy(true)
    try {
      const [
        topicsPayload,
        receivingPayload,
        topicHistoryPayload,
        servicePayload,
        actionPayload,
        messagesPayload,
        publishHistoryPayload,
        continuousPublishPayload,
        servicesPayload,
        actionsPayload,
      ] = await Promise.all([
        fetchTopics(),
        fetchReceiveTopics(),
        fetchReceiveTopicHistory('', { limit: 500 }),
        fetchReceiveServiceHistory(),
        fetchReceiveActionHistory(),
        fetchCallableMessages(),
        fetchTopicPublishHistory({ limit: 100 }),
        fetchContinuousTopicPublishes(),
        fetchCallableServices(),
        fetchCallableActions(),
      ])
      const nextTopics = topicsPayload.data?.topics ?? topicsPayload.data ?? []
      const nextServices = servicesPayload.data ?? []
      const nextActions = actionsPayload.data ?? []
      const nextMessages = messagesPayload.data ?? []
      setAvailableTopics(nextTopics)
      setTopics(receivingPayload.data ?? [])
      setTopicHistory(topicHistoryPayload.data ?? [])
      setServiceHistory(servicePayload.data ?? [])
      setActionHistory(actionPayload.data ?? [])
      replaceMessages(
        nextMessages,
        publishHistoryPayload.data ?? [],
        continuousPublishPayload.data ?? [],
      )
      replaceServices(nextServices)
      replaceActions(nextActions)
      if (!selectedReceiveServiceKey && nextServices[0]) {
        setSelectedReceiveServiceKey(serviceKey(nextServices[0]))
      }
      if (!selectedReceiveActionKey && nextActions[0]) {
        setSelectedReceiveActionKey(actionKey(nextActions[0]))
      }
    } catch (error) {
      if (!silent) setFeedback({ tone: 'error', text: error.message })
    } finally {
      if (!silent) setBusy(false)
    }
  }, [
    replaceActions,
    replaceMessages,
    replaceServices,
    selectedReceiveActionKey,
    selectedReceiveServiceKey,
    setAvailableTopics,
    setBusy,
    setFeedback,
    setSelectedReceiveActionKey,
    setSelectedReceiveServiceKey,
    setTopicHistory,
    setTopics,
  ])

  const topicController = useTopicReceiveController({
    availableTopics,
    load,
    selectedMessage,
    setFeedback,
    setTopicHistory,
    setTopics,
    topicHistory,
    topics,
  })

  const serviceObserver = useResourceReceiveObserver({
    history: serviceHistory,
    itemKey: serviceKey,
    items: services,
    kind: 'Service',
    load,
    nameField: 'service_name',
    resetHistory: resetReceiveServiceHistory,
    selectedKey: selectedReceiveServiceKey,
    setFeedback,
    typeField: 'service_type',
  })
  const actionObserver = useResourceReceiveObserver({
    history: actionHistory,
    itemKey: actionKey,
    items: actions,
    kind: 'Action',
    load,
    nameField: 'action_name',
    resetHistory: resetReceiveActionHistory,
    selectedKey: selectedReceiveActionKey,
    setFeedback,
    typeField: 'action_type',
  })

  const pollReceiveState = useCallback(async () => {
    await runSingleFlight(pollInFlightRef, async () => {
      try {
        const [receivingPayload, topicPayload, servicePayload, actionPayload] = await Promise.all([
          fetchReceiveTopics(),
          fetchReceiveTopicHistory('', { limit: 500 }),
          fetchReceiveServiceHistory(),
          fetchReceiveActionHistory(),
        ])
        setTopics(receivingPayload.data ?? [])
        setTopicHistory(topicPayload.data ?? [])
        setServiceHistory(servicePayload.data ?? [])
        setActionHistory(actionPayload.data ?? [])
      } catch {
        // Background polling keeps the last successful state; explicit loads report errors.
      }
    })
  }, [])
  const {
    activeKey: activeServiceKey,
    filteredItems: filteredServices,
    reset: resetServices,
    search: serviceSearch,
    setSearch: setServiceSearch,
    start: startService,
    stop: stopService,
    visibleHistory: visibleServiceHistory,
  } = serviceObserver
  const {
    activeKey: activeActionKey,
    filteredItems: filteredActions,
    reset: resetActions,
    search: actionSearch,
    setSearch: setActionSearch,
    start: startAction,
    stop: stopAction,
    visibleHistory: visibleActionHistory,
  } = actionObserver

  useEffect(() => {
    if (!open || mode === 'mock') return undefined
    const timer = window.setInterval(pollReceiveState, 1000)
    return () => window.clearInterval(timer)
  }, [mode, open, pollReceiveState])

  return {
    actionSearch,
    actionQosControls: actionQos.qosControls,
    activeActionKey,
    activeServiceKey,
    filteredActions,
    filteredServices,
    load,
    mode,
    open,
    resetActions,
    resetServices,
    serviceSearch,
    setActionSearch,
    setMode,
    setOpen,
    setServiceSearch,
    startAction,
    startService,
    stopAction,
    stopService,
    visibleActionHistory,
    visibleServiceHistory,
    ...topicController,
  }
}
