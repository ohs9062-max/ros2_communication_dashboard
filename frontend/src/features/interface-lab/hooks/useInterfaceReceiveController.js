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
import { fetchDomains, fetchTopics } from '../../../api/monitoring.js'
import { actionKey, messageKey, serviceKey } from '../model/interfaceUploadModel.js'
import { configuredServerDomainIds } from '../model/serverSelection.js'
import { runSingleFlight } from '../model/singleFlight.js'
import { useActionExecutionQos } from './useExecutionQos.js'
import { useResourceReceiveObserver } from './useResourceReceiveObserver.js'
import { useTopicReceiveController } from './useTopicReceiveController.js'

export function useInterfaceReceiveController({
  availableTopics,
  onActionDomainChange,
  onActionSelectionChange,
  onMessageDomainChange,
  onMessageSelectionChange,
  onServiceDomainChange,
  onServiceSelectionChange,
  onTopicSelectionChange,
  setAvailableTopics,
  setBusy,
  setFeedback,
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('topic')
  const [domainIds, setDomainIds] = useState([])
  const [topicDomainId, setTopicDomainId] = useState(null)
  const [serviceDomainId, setServiceDomainId] = useState(null)
  const [actionDomainId, setActionDomainId] = useState(null)
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

  const selectTopicDomain = useCallback((value, notify = true) => {
    const nextDomainId = value === '' ? null : Number(value)
    setTopicDomainId(nextDomainId)
    if (notify) onMessageDomainChange?.(nextDomainId)
  }, [onMessageDomainChange])

  const selectServiceDomain = useCallback((value, notify = true) => {
    const nextDomainId = value === '' ? null : Number(value)
    setServiceDomainId(nextDomainId)
    const domainServices = services.filter((item) => nextDomainId === null || item.domain_id === nextDomainId)
    const current = domainServices.find((item) => serviceKey(item) === selectedReceiveServiceKey)
    if (!current) {
      const nextKey = domainServices[0] ? serviceKey(domainServices[0]) : ''
      setSelectedReceiveServiceKey(nextKey)
      onServiceSelectionChange?.(nextKey)
    }
    if (notify) onServiceDomainChange?.(nextDomainId)
  }, [onServiceDomainChange, onServiceSelectionChange, selectedReceiveServiceKey, services])

  const selectActionDomain = useCallback((value, notify = true) => {
    const nextDomainId = value === '' ? null : Number(value)
    setActionDomainId(nextDomainId)
    const domainActions = actions.filter((item) => nextDomainId === null || item.domain_id === nextDomainId)
    const current = domainActions.find((item) => actionKey(item) === selectedReceiveActionKey)
    if (!current) {
      const nextKey = domainActions[0] ? actionKey(domainActions[0]) : ''
      setSelectedReceiveActionKey(nextKey)
      onActionSelectionChange?.(nextKey)
    }
    if (notify) onActionDomainChange?.(nextDomainId)
  }, [actions, onActionDomainChange, onActionSelectionChange, selectedReceiveActionKey])

  const load = useCallback(async ({ silent = false, mode: requestedMode = null } = {}) => {
    if (!silent) setBusy(true)
    try {
      const selectedMode = requestedMode ?? mode
      const domainsPayload = await fetchDomains()
      const nextDomains = configuredServerDomainIds(domainsPayload)
      setDomainIds(nextDomains)

      if (selectedMode === 'service') {
        const [historyPayload, servicesPayload] = await Promise.all([
          fetchReceiveServiceHistory(),
          fetchCallableServices(),
        ])
        const nextServices = servicesPayload.data ?? []
        setServiceHistory(historyPayload.data ?? [])
        setServices(nextServices)
        const domainServices = nextServices.filter((service) => serviceDomainId === null || service.domain_id === serviceDomainId)
        if (!domainServices.some((service) => serviceKey(service) === selectedReceiveServiceKey)) {
          setSelectedReceiveServiceKey(domainServices[0] ? serviceKey(domainServices[0]) : '')
        }
      } else if (selectedMode === 'action') {
        const [historyPayload, actionsPayload] = await Promise.all([
          fetchReceiveActionHistory(),
          fetchCallableActions(),
        ])
        const nextActions = actionsPayload.data ?? []
        setActionHistory(historyPayload.data ?? [])
        setActions(nextActions)
        const domainActions = nextActions.filter((action) => actionDomainId === null || action.domain_id === actionDomainId)
        if (!domainActions.some((action) => actionKey(action) === selectedReceiveActionKey)) {
          setSelectedReceiveActionKey(domainActions[0] ? actionKey(domainActions[0]) : '')
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
    actionDomainId,
    mode,
    selectedMessageKey,
    selectedReceiveActionKey,
    selectedReceiveServiceKey,
    serviceDomainId,
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
    domainId: topicDomainId,
    domainIds,
    load,
    onDomainChange: (id) => selectTopicDomain(id, true),
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
    domainId: serviceDomainId,
    domainIds,
    history: serviceHistory,
    itemKey: serviceKey,
    items: services,
    kind: 'Service',
    load,
    nameField: 'service_name',
    onDomainChange: (id) => selectServiceDomain(id, true),
    resetHistory: resetReceiveServiceHistory,
    selectedKey: selectedReceiveServiceKey,
    setFeedback,
    typeField: 'service_type',
  })
  const actionObserver = useResourceReceiveObserver({
    domainId: actionDomainId,
    domainIds,
    history: actionHistory,
    itemKey: actionKey,
    items: actions,
    kind: 'Action',
    load,
    nameField: 'action_name',
    onDomainChange: (id) => selectActionDomain(id, true),
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
    actionDomainId,
    actionQosControls: actionQos.qosControls,
    activeActionKey,
    activeServiceKey,
    domainIds,
    filteredActions,
    filteredServices,
    load,
    mode,
    messages,
    open,
    resetActions,
    resetServices,
    serviceDomainId,
    serviceSearch,
    services,
    setActionDomainId: selectActionDomain,
    setActionSearch,
    setMode,
    setMessageImportableOnly,
    setOpen,
    setServiceDomainId: selectServiceDomain,
    setServiceSearch,
    setSelectedMessageKey: selectReceiveMessage,
    setSelectedReceiveActionKey: selectReceiveAction,
    setSelectedReceiveServiceKey: selectReceiveService,
    setTopicDomainId: selectTopicDomain,
    selectActionDomain,
    selectActionDomainFromExecution: (id) => selectActionDomain(id, false),
    selectActionFromExecution: setSelectedReceiveActionKey,
    selectMessageFromExecution: setSelectedMessageKey,
    selectServiceDomain,
    selectServiceDomainFromExecution: (id) => selectServiceDomain(id, false),
    selectServiceFromExecution: setSelectedReceiveServiceKey,
    selectTopicDomain,
    selectTopicDomainFromExecution: (id) => selectTopicDomain(id, false),
    startAction,
    startService,
    stopAction,
    stopService,
    selectedMessage,
    selectedMessageKey,
    selectedReceiveActionKey,
    selectedReceiveServiceKey,
    topicDomainId,
    visibleActionHistory,
    visibleMessages,
    visibleServiceHistory,
    ...topicController,
  }
}
