import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchCallableActions,
  fetchCallableMessages,
  fetchCallableServices,
  fetchReceiveActionHistory,
  fetchReceiveServiceHistory,
  fetchReceiveTopicHistory,
  fetchReceiveTopics,
  resetReceiveActionHistory,
  resetReceiveServiceHistory,
} from '../../../api/interfaceExecution.js'
import { fetchTopics } from '../../../api/monitoring.js'
import { actionKey, messageKey, serviceKey } from '../model/interfaceUploadModel.js'
import { runSingleFlight } from '../model/singleFlight.js'
import { useActionExecutionQos } from './useExecutionQos.js'
import { useResourceReceiveObserver } from './useResourceReceiveObserver.js'
import { useTopicReceiveController } from './useTopicReceiveController.js'

export function useInterfaceReceiveController({
  availableTopics,
  onActionSelectionChange,
  onMessageSelectionChange,
  onServiceSelectionChange,
  onTopicSelectionChange,
  setAvailableTopics,
  setBusy,
  setFeedback,
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('topic')
  const [topics, setTopics] = useState([])
  const [topicHistory, setTopicHistory] = useState([])
  const [serviceHistory, setServiceHistory] = useState([])
  const [actionHistory, setActionHistory] = useState([])
  const [messages, setMessages] = useState([])
  const [services, setServices] = useState([])
  const [actions, setActions] = useState([])
  const [messageImportableOnly, setMessageImportableOnly] = useState(false)
  const [selectedMessageKey, setSelectedMessageKey] = useState('')
  const [selectedReceiveServiceKey, setSelectedReceiveServiceKey] = useState('')
  const [selectedReceiveActionKey, setSelectedReceiveActionKey] = useState('')
  const pollInFlightRef = useRef(false)
  const actionQos = useActionExecutionQos()

  const selectReceiveMessage = useCallback((key) => {
    setSelectedMessageKey(key)
    onMessageSelectionChange?.(key)
  }, [onMessageSelectionChange])
  const selectReceiveService = useCallback((key) => {
    setSelectedReceiveServiceKey(key)
    onServiceSelectionChange?.(key)
  }, [onServiceSelectionChange])
  const selectReceiveAction = useCallback((key) => {
    setSelectedReceiveActionKey(key)
    onActionSelectionChange?.(key)
  }, [onActionSelectionChange])

  const load = useCallback(async ({ silent = false, mode: requestedMode = null } = {}) => {
    if (!silent) setBusy(true)
    try {
      const selectedMode = requestedMode ?? mode
      if (selectedMode === 'service') {
        const [historyPayload, servicesPayload] = await Promise.all([
          fetchReceiveServiceHistory(),
          fetchCallableServices(),
        ])
        const nextServices = servicesPayload.data ?? []
        setServiceHistory(historyPayload.data ?? [])
        setServices(nextServices)
        if (!nextServices.some((service) => serviceKey(service) === selectedReceiveServiceKey)) {
          setSelectedReceiveServiceKey(nextServices[0] ? serviceKey(nextServices[0]) : '')
        }
      } else if (selectedMode === 'action') {
        const [historyPayload, actionsPayload] = await Promise.all([
          fetchReceiveActionHistory(),
          fetchCallableActions(),
        ])
        const nextActions = actionsPayload.data ?? []
        setActionHistory(historyPayload.data ?? [])
        setActions(nextActions)
        if (!nextActions.some((action) => actionKey(action) === selectedReceiveActionKey)) {
          setSelectedReceiveActionKey(nextActions[0] ? actionKey(nextActions[0]) : '')
        }
      } else {
        const [topicsPayload, receivingPayload, historyPayload, messagesPayload] = await Promise.all([
          fetchTopics(),
          fetchReceiveTopics(),
          fetchReceiveTopicHistory('', { limit: 500 }),
          fetchCallableMessages(),
        ])
        const nextTopics = topicsPayload.data?.topics ?? topicsPayload.data ?? []
        const nextMessages = messagesPayload.data ?? []
        setAvailableTopics(nextTopics)
        setTopics(receivingPayload.data ?? [])
        setTopicHistory(historyPayload.data ?? [])
        setMessages(nextMessages)
        if (!nextMessages.some((message) => messageKey(message) === selectedMessageKey)) {
          setSelectedMessageKey(nextMessages[0] ? messageKey(nextMessages[0]) : '')
        }
      }
    } catch (error) {
      if (!silent) setFeedback({ tone: 'error', text: error.message })
    } finally {
      if (!silent) setBusy(false)
    }
  }, [
    mode,
    selectedMessageKey,
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

  const selectedMessage = messages.find((message) => messageKey(message) === selectedMessageKey)
  const visibleMessages = messageImportableOnly
    ? messages.filter((message) => message.import_available)
    : messages

  const topicController = useTopicReceiveController({
    availableTopics,
    load,
    onTopicSelectionChange,
    messageImportableOnly,
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
    actions,
    actionSearch,
    actionQosControls: actionQos.qosControls,
    activeActionKey,
    activeServiceKey,
    filteredActions,
    filteredServices,
    load,
    mode,
    messages,
    open,
    resetActions,
    resetServices,
    serviceSearch,
    services,
    setActionSearch,
    setMode,
    setMessageImportableOnly,
    setOpen,
    setServiceSearch,
    setSelectedMessageKey: selectReceiveMessage,
    setSelectedReceiveActionKey: selectReceiveAction,
    setSelectedReceiveServiceKey: selectReceiveService,
    selectMessageFromExecution: setSelectedMessageKey,
    selectServiceFromExecution: setSelectedReceiveServiceKey,
    selectActionFromExecution: setSelectedReceiveActionKey,
    startAction,
    startService,
    stopAction,
    stopService,
    selectedMessage,
    selectedMessageKey,
    selectedReceiveActionKey,
    selectedReceiveServiceKey,
    visibleActionHistory,
    visibleMessages,
    visibleServiceHistory,
    ...topicController,
  }
}
