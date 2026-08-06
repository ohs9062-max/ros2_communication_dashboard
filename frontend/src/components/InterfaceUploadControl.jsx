import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ManualInterfacePanel,
  InterfaceUploadToolbar,
  actionKey,
  defaultRequestValues,
  messageKey,
  normalizeNumericValues,
  serviceKey,
} from '../features/interface-lab/InterfaceUploadParts.jsx'
import {
  ActionExecutionPanel,
  ServiceExecutionPanel,
  TopicExecutionPanel,
} from '../features/interface-lab/InterfaceExecutionPanels.jsx'
import {
  BuildFailurePanel,
  RegisteredInterfacesPanel,
  UploadedPackagesPanel,
} from '../features/interface-lab/InterfaceManagementPanels.jsx'
import {
  ActionReceivePanel,
  InterfaceReceiveWorkbench,
  ServiceReceivePanel,
  TopicReceivePanel,
} from '../features/interface-lab/InterfaceReceivePanels.jsx'
import { useInterfaceManagementController } from '../features/interface-lab/hooks/useInterfaceManagementController.js'
import {
  graphPublishTopicCandidates,
  topicHasType,
  topicNameTypeWarning,
} from '../utils/interfaceTopics.js'
import { fetchInterfaceApplyStatus, fetchInterfacePackages, fetchInterfaceRegistry } from '../api/interfaceManagement.js'
import { fetchTopics } from '../api/monitoring.js'
import {
  callRegisteredService,
  fetchActionGoalHistory,
  fetchCallableActions,
  fetchCallableMessages,
  fetchCallableServices,
  fetchContinuousTopicPublishes,
  fetchReceiveActionHistory,
  fetchReceiveServiceHistory,
  fetchReceiveTopicHistory,
  fetchReceiveTopics,
  fetchServiceCallHistory,
  fetchTopicPublishHistory,
  publishTopicMessage,
  resetReceiveActionHistory,
  resetReceiveServiceHistory,
  resetReceiveTopicHistory,
  resetTopicPublishHistory,
  sendActionGoal,
  startReceiveTopic,
  startContinuousTopicPublish,
  stopContinuousTopicPublish,
  stopReceiveTopic,
} from '../api/interfaceExecution.js'

export function InterfaceUploadControl({
  onStateChanged,
  onTopicWorkspaceExpandedChange,
  refreshSignal = 0,
  websocket,
}) {
  const inputRef = useRef(null)
  const packageFolderInputRef = useRef(null)
  const packageInputRef = useRef(null)
  const lastRefreshSignalRef = useRef(refreshSignal)
  const [showCallableTopics, setShowCallableTopics] = useState(false)
  const [showCallableServices, setShowCallableServices] = useState(false)
  const [showCallableActions, setShowCallableActions] = useState(false)
  const closeExecutionPanels = useCallback(() => {
    setShowCallableTopics(false)
    setShowCallableServices(false)
    setShowCallableActions(false)
  }, [])
  const {
    applyStatus, applyUploadedInterfaces, applying, buildLogTail, busy,
    editingManualDefinition, feedback,
    handleFile, handlePackageFile, handlePackageFolder, loadApplyStatus, loadPackages,
    loadRegistry, regenerateUploadedInterfacesCmake, removeManualDefinition,
    removePackage, removeRegistryEntry, runImportCheck,
    manualDefinition, manualKind, manualMode, manualType, manualTypeName,
    packages, recentDeletedRegistry, registry, reloadPhase, replacePackage,
    setApplyStatus, setBuildLogTail, setBusy, setEditingManualDefinition,
    setFeedback, setManualDefinition, setManualKind, setManualMode, setManualType,
    setManualTypeName, setPackages, setRegistry,
    setReloadPhase, setReplacePackage, setShowBuildLog, setShowManualInput,
    setShowPackages, setShowRegistry, showBuildLog, showManualInput, showPackages,
    showRegistry, startEditingManualDefinition, submitManualDefinition,
    submitManualType, validateCurrentManualDefinition,
  } = useInterfaceManagementController({
    onCloseExecutionPanels: closeExecutionPanels,
    onStateChanged,
  })
  const [callableServices, setCallableServices] = useState([])
  const [selectedServiceKey, setSelectedServiceKey] = useState('')
  const [requestValues, setRequestValues] = useState({})
  const [timeoutSec, setTimeoutSec] = useState(2)
  const [serviceCallBusy, setServiceCallBusy] = useState(false)
  const [serviceCallResult, setServiceCallResult] = useState(null)
  const [serviceCallHistory, setServiceCallHistory] = useState([])
  const [callableActions, setCallableActions] = useState([])
  const [selectedActionKey, setSelectedActionKey] = useState('')
  const [goalValues, setGoalValues] = useState({})
  const [goalTimeoutSec, setGoalTimeoutSec] = useState(10)
  const [actionGoalBusy, setActionGoalBusy] = useState(false)
  const [actionGoalResult, setActionGoalResult] = useState(null)
  const [actionGoalHistory, setActionGoalHistory] = useState([])
  const [showReceivePanel, setShowReceivePanel] = useState(false)
  const [receiveMode, setReceiveMode] = useState('topic')
  const [availableTopics, setAvailableTopics] = useState([])
  const [receiveTopics, setReceiveTopics] = useState([])
  const [selectedReceiveTopic, setSelectedReceiveTopic] = useState('')
  const selectedReceiveTopicSourceRef = useRef('empty')
  const [receiveTopicSearch, setReceiveTopicSearch] = useState('')
  const [callableMessages, setCallableMessages] = useState([])
  const [topicImportableOnly, setTopicImportableOnly] = useState(false)
  const [selectedMessageKey, setSelectedMessageKey] = useState('')
  const [topicPublishName, setTopicPublishName] = useState('')
  const [topicPublishHz, setTopicPublishHz] = useState(10)
  const topicPublishNameSourceRef = useRef('empty')
  const [topicMessageValues, setTopicMessageValues] = useState({})
  const [topicPublishBusy, setTopicPublishBusy] = useState(false)
  const [topicPublishResult, setTopicPublishResult] = useState(null)
  const [topicPublishHistory, setTopicPublishHistory] = useState([])
  const [continuousTopicPublishes, setContinuousTopicPublishes] = useState([])
  const [selectedReceiveServiceKey, setSelectedReceiveServiceKey] = useState('')
  const [activeReceiveServiceKey, setActiveReceiveServiceKey] = useState('')
  const [receiveServiceSearch, setReceiveServiceSearch] = useState('')
  const [serviceImportableOnly, setServiceImportableOnly] = useState(false)
  const [selectedReceiveActionKey, setSelectedReceiveActionKey] = useState('')
  const [activeReceiveActionKey, setActiveReceiveActionKey] = useState('')
  const [receiveActionSearch, setReceiveActionSearch] = useState('')
  const [actionImportableOnly, setActionImportableOnly] = useState(false)
  const [receiveTopicHistory, setReceiveTopicHistory] = useState([])
  const [receiveServiceHistory, setReceiveServiceHistory] = useState([])
  const [receiveActionHistory, setReceiveActionHistory] = useState([])
  const [topicWorkspaceExpanded, setTopicWorkspaceExpanded] = useState(false)

  const toggleBuildLog = () => {
    setShowBuildLog((value) => !value)
    setShowRegistry(false)
    setShowPackages(false)
    setShowCallableTopics(false)
    setShowCallableServices(false)
    setShowCallableActions(false)
  }
  const disabled = busy || applying || serviceCallBusy || actionGoalBusy || topicPublishBusy
  const topicExpandedActive = topicWorkspaceExpanded
    && (
      showPackages
      || (
        showReceivePanel
        && (
          (showCallableTopics && receiveMode === 'topic')
          || (showCallableServices && receiveMode === 'service')
          || (showCallableActions && receiveMode === 'action')
          || (!showCallableTopics && !showCallableServices && !showCallableActions && receiveMode !== 'mock')
        )
      )
    )
  const selectedService = callableServices.find(
    (service) => serviceKey(service) === selectedServiceKey,
  )
  const selectedAction = callableActions.find(
    (action) => actionKey(action) === selectedActionKey,
  )
  const selectedMessage = callableMessages.find(
    (message) => messageKey(message) === selectedMessageKey,
  )
  const publishGraphTopics = useMemo(
    () => graphPublishTopicCandidates(availableTopics, selectedMessage?.message_type),
    [availableTopics, selectedMessage?.message_type],
  )
  const topicPublishWarning = topicNameTypeWarning(
    availableTopics,
    topicPublishName,
    selectedMessage?.message_type,
  )
  const activeContinuousPublish = continuousTopicPublishes.find((item) =>
    item.active
    && item.topic_name === topicPublishName.trim()
    && item.topic_type === selectedMessage?.message_type)
  const activeContinuousPublishKey = activeContinuousPublish
    ? `${activeContinuousPublish.topic_name}\u0000${activeContinuousPublish.topic_type}`
    : ''
  const visibleCallableMessages = topicImportableOnly
    ? callableMessages.filter((message) => message.import_available)
    : callableMessages
  const visibleCallableServices = serviceImportableOnly
    ? callableServices.filter((service) => service.import_available)
    : callableServices
  const visibleCallableActions = actionImportableOnly
    ? callableActions.filter((action) => action.import_available)
    : callableActions
  const filteredReceiveTopics = useMemo(() => {
    const keyword = receiveTopicSearch.trim().toLowerCase()
    const selectedType = selectedMessage?.message_type
    return availableTopics.filter((topic) => {
      const topicType = topic.type ?? topic.types?.[0] ?? ''
      if (selectedType && !topicHasType(topic, selectedType)) return false
      if (!keyword) return true
      return `${topic.name} ${topicType}`.toLowerCase().includes(keyword)
    })
  }, [availableTopics, receiveTopicSearch, selectedMessage?.message_type])
  const selectedTopicReceiving = receiveTopics.some((topic) =>
    topic.topic_name === selectedReceiveTopic
    && (!selectedMessage?.message_type || topic.topic_type === selectedMessage.message_type)
    && topic.receiving !== false,
  )
  const visibleReceiveTopicHistory = receiveTopicHistory.filter((event) =>
    (!selectedReceiveTopic || event.topic_name === selectedReceiveTopic)
    && (!selectedMessage?.message_type || event.topic_type === selectedMessage.message_type),
  )
  const visiblePublishHistory = topicPublishHistory.filter((event) =>
    (!topicPublishName || event.topic_name === topicPublishName)
    && (!selectedMessage?.message_type || event.topic_type === selectedMessage.message_type),
  )

  useEffect(() => {
    if (!selectedMessage?.message_type) return
    const currentName = topicPublishName.trim()
    const currentIsCandidate = publishGraphTopics.some((topic) => topic.name === currentName)
    const source = topicPublishNameSourceRef.current

    if (source === 'user') {
      if (currentName) return
    } else if (source === 'graph') {
      if (currentIsCandidate) return
      topicPublishNameSourceRef.current = 'empty'
      setTopicPublishName('')
      return
    } else if (source === 'auto' && publishGraphTopics.length !== 1) {
      topicPublishNameSourceRef.current = 'empty'
      setTopicPublishName('')
      return
    }

    if (publishGraphTopics.length === 1) {
      const nextName = publishGraphTopics[0].name
      if (source === 'auto' && currentName === nextName) return
      topicPublishNameSourceRef.current = 'auto'
      setTopicPublishName(nextName)
    }
  }, [publishGraphTopics, selectedMessage?.message_type, topicPublishName])

  useEffect(() => {
    if (!selectedMessage?.message_type) return
    const currentIsCandidate = filteredReceiveTopics.some(
      (topic) => topic.name === selectedReceiveTopic,
    )
    const source = selectedReceiveTopicSourceRef.current
    if (source === 'user' && selectedReceiveTopic.trim()) return
    if ((source === 'auto' || source === 'graph') && currentIsCandidate) return

    const nextTopicName = filteredReceiveTopics[0]?.name ?? ''
    selectedReceiveTopicSourceRef.current = nextTopicName ? 'auto' : 'empty'
    setSelectedReceiveTopic(nextTopicName)
  }, [filteredReceiveTopics, selectedMessage?.message_type, selectedReceiveTopic])
  const filteredReceiveServices = callableServices.filter((service) => {
    const keyword = receiveServiceSearch.trim().toLowerCase()
    if (!keyword) return true
    return `${service.service_name ?? service.file_name ?? ''} ${service.service_type ?? ''}`.toLowerCase().includes(keyword)
  })
  const filteredReceiveActions = callableActions.filter((action) => {
    const keyword = receiveActionSearch.trim().toLowerCase()
    if (!keyword) return true
    return `${action.action_name ?? action.file_name ?? ''} ${action.action_type ?? ''}`.toLowerCase().includes(keyword)
  })
  const selectedReceiveService = callableServices.find(
    (service) => serviceKey(service) === selectedReceiveServiceKey,
  )
  const selectedReceiveAction = callableActions.find(
    (action) => actionKey(action) === selectedReceiveActionKey,
  )
  const visibleReceiveServiceHistory = selectedReceiveService && activeReceiveServiceKey === selectedReceiveServiceKey
    ? receiveServiceHistory.filter((event) =>
      event.service_name === selectedReceiveService.service_name
      && event.service_type === selectedReceiveService.service_type)
    : []
  const visibleReceiveActionHistory = selectedReceiveAction && activeReceiveActionKey === selectedReceiveActionKey
    ? receiveActionHistory.filter((event) =>
      event.action_name === selectedReceiveAction.action_name
      && event.action_type === selectedReceiveAction.action_type)
    : []

  useEffect(() => {
    if (!visibleCallableMessages.length) {
      if (selectedMessageKey) setSelectedMessageKey('')
      return
    }
    if (visibleCallableMessages.some((message) => messageKey(message) === selectedMessageKey)) {
      return
    }
    const nextMessage = visibleCallableMessages[0]
    setSelectedMessageKey(messageKey(nextMessage))
    setTopicMessageValues(defaultRequestValues(nextMessage.message_schema ?? []))
    setTopicPublishResult(null)
  }, [selectedMessageKey, visibleCallableMessages])

  useEffect(() => {
    if (!visibleCallableServices.length) {
      if (selectedServiceKey) {
        setSelectedServiceKey('')
        setSelectedReceiveServiceKey('')
      }
      return
    }
    if (visibleCallableServices.some((service) => serviceKey(service) === selectedServiceKey)) {
      return
    }
    const nextService = visibleCallableServices[0]
    const nextKey = serviceKey(nextService)
    setSelectedServiceKey(nextKey)
    setSelectedReceiveServiceKey(nextKey)
    setRequestValues(defaultRequestValues(nextService.request_schema ?? []))
    setServiceCallResult(null)
  }, [selectedServiceKey, visibleCallableServices])

  useEffect(() => {
    if (!visibleCallableActions.length) {
      if (selectedActionKey) {
        setSelectedActionKey('')
        setSelectedReceiveActionKey('')
      }
      return
    }
    if (visibleCallableActions.some((action) => actionKey(action) === selectedActionKey)) {
      return
    }
    const nextAction = visibleCallableActions[0]
    const nextKey = actionKey(nextAction)
    setSelectedActionKey(nextKey)
    setSelectedReceiveActionKey(nextKey)
    setGoalValues(defaultRequestValues(nextAction.goal_schema ?? []))
    setActionGoalResult(null)
  }, [selectedActionKey, visibleCallableActions])

  const startEditManualDefinition = (item) => {
    startEditingManualDefinition(item)
  }

  const loadReceiveState = useCallback(async ({ silent = false } = {}) => {
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
        callableServicesPayload,
        callableActionsPayload,
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
      const topics = topicsPayload.data?.topics ?? topicsPayload.data ?? []
      const services = callableServicesPayload.data ?? []
      const actions = callableActionsPayload.data ?? []
      const messages = messagesPayload.data ?? []
      setAvailableTopics(topics)
      setReceiveTopics(receivingPayload.data ?? [])
      setReceiveTopicHistory(topicHistoryPayload.data ?? [])
      setReceiveServiceHistory(servicePayload.data ?? [])
      setReceiveActionHistory(actionPayload.data ?? [])
      setCallableMessages(messages)
      setTopicPublishHistory(publishHistoryPayload.data ?? [])
      setContinuousTopicPublishes(continuousPublishPayload.data ?? [])
      setCallableServices(services)
      setCallableActions(actions)
      if (!selectedMessageKey && messages[0]) {
        const nextKey = messageKey(messages[0])
        setSelectedMessageKey(nextKey)
        setTopicMessageValues(defaultRequestValues(messages[0].message_schema ?? []))
      }
      if (!selectedReceiveServiceKey && services[0]) {
        setSelectedReceiveServiceKey(serviceKey(services[0]))
      }
      if (!selectedReceiveActionKey && actions[0]) {
        setSelectedReceiveActionKey(actionKey(actions[0]))
      }
    } catch (error) {
      if (!silent) setFeedback({ tone: 'error', text: error.message })
    } finally {
      if (!silent) setBusy(false)
    }
  }, [selectedMessageKey, selectedReceiveActionKey, selectedReceiveServiceKey, setBusy, setFeedback])

  const startSelectedTopicReceive = async () => {
    if (!selectedReceiveTopic.trim()) {
      setFeedback({ tone: 'error', text: '수신할 Topic 이름을 입력하세요.' })
      return
    }
    const topicType = selectedMessage?.message_type
    if (!topicType) {
      setFeedback({ tone: 'error', text: '수신할 Message full_type을 선택하세요.' })
      return
    }
    try {
      await startReceiveTopic({
        topic_name: selectedReceiveTopic.trim(),
        topic_type: topicType,
        history_limit: 500,
      })
      await loadReceiveState()
      setFeedback({ tone: 'success', text: `${selectedReceiveTopic.trim()} · ${topicType} 수신을 시작했습니다.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const stopSelectedTopicReceive = async () => {
    try {
      await stopReceiveTopic({
        topic_name: selectedReceiveTopic,
        topic_type: selectedMessage?.message_type,
      })
      await loadReceiveState()
      setFeedback({ tone: 'warning', text: `${selectedReceiveTopic} 수신을 중지했습니다.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const resetSelectedTopicReceiveHistory = async () => {
    if (!selectedReceiveTopic) {
      setFeedback({ tone: 'error', text: '리셋할 Topic을 선택하세요.' })
      return
    }
    try {
      const selectedType = selectedMessage?.message_type
      const payload = await resetReceiveTopicHistory(selectedReceiveTopic, selectedType)
      setReceiveTopics(payload.data?.topics ?? [])
      setReceiveTopicHistory((items) => items.filter((event) =>
        event.topic_name !== selectedReceiveTopic
        || (selectedType && event.topic_type !== selectedType)))
      await loadReceiveState()
      setFeedback({
        tone: 'success',
        text: `${selectedReceiveTopic} 수신 항목 ${payload.data?.removed ?? 0}개와 이력 ${payload.data?.cleared ?? 0}개를 삭제했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const publishSelectedTopicMessage = async () => {
    if (!topicPublishName.trim()) {
      setTopicPublishResult({ success: false, error: 'Publish할 Topic 이름을 입력하세요.' })
      return
    }
    if (!selectedMessage?.message_type) {
      setTopicPublishResult({ success: false, error: 'Publish할 Message full_type을 선택하세요.' })
      return
    }
    setTopicPublishBusy(true)
    setTopicPublishResult(null)
    try {
      const payload = await publishTopicMessage({
        topic_name: topicPublishName.trim(),
        topic_type: selectedMessage.message_type,
        full_type: selectedMessage.message_type,
        message: normalizeNumericValues(topicMessageValues, selectedMessage.message_schema),
      })
      setTopicPublishResult(payload)
      const historyPayload = await fetchTopicPublishHistory({ limit: 100 })
      setTopicPublishHistory(historyPayload.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setTopicPublishResult({ success: false, error: error.message })
    } finally {
      setTopicPublishBusy(false)
    }
  }

  const startSelectedContinuousTopicPublish = async () => {
    if (!topicPublishName.trim() || !selectedMessage?.message_type) {
      setTopicPublishResult({ success: false, error: 'Publish Topic 이름과 Message full_type을 선택하세요.' })
      return
    }
    setTopicPublishBusy(true)
    setTopicPublishResult(null)
    try {
      const result = await startContinuousTopicPublish({
        topic_name: topicPublishName.trim(),
        topic_type: selectedMessage.message_type,
        full_type: selectedMessage.message_type,
        message: normalizeNumericValues(topicMessageValues, selectedMessage.message_schema),
        hz: Number(topicPublishHz),
      })
      setTopicPublishResult(result)
      const state = await fetchContinuousTopicPublishes()
      setContinuousTopicPublishes(state.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setTopicPublishResult({ success: false, error: error.message })
    } finally {
      setTopicPublishBusy(false)
    }
  }

  const stopSelectedContinuousTopicPublish = async () => {
    if (!topicPublishName.trim() || !selectedMessage?.message_type) return
    setTopicPublishBusy(true)
    try {
      const result = await stopContinuousTopicPublish({
        topic_name: topicPublishName.trim(),
        topic_type: selectedMessage.message_type,
      })
      setTopicPublishResult(result)
      const state = await fetchContinuousTopicPublishes()
      setContinuousTopicPublishes(state.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setTopicPublishResult({ success: false, error: error.message })
    } finally {
      setTopicPublishBusy(false)
    }
  }

  const resetSelectedTopicPublishHistory = async () => {
    try {
      const payload = await resetTopicPublishHistory({
        topic_name: topicPublishName,
        topic_type: selectedMessage?.message_type,
      })
      const historyPayload = await fetchTopicPublishHistory({ limit: 100 })
      setTopicPublishHistory(historyPayload.data ?? [])
      setFeedback({
        tone: 'success',
        text: `Topic Publish 이력 ${payload.data?.cleared ?? 0}개를 리셋했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const resetAllTopicReceiveHistory = async () => {
    try {
      const payload = await resetReceiveTopicHistory()
      setReceiveTopics(payload.data?.topics ?? [])
      setReceiveTopicHistory([])
      await loadReceiveState()
      setFeedback({
        tone: 'success',
        text: `수신 중 Topic ${payload.data?.removed ?? 0}개와 이력 ${payload.data?.cleared ?? 0}개를 전체 삭제했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const startSelectedServiceReceive = async () => {
    if (!selectedReceiveService) {
      setFeedback({ tone: 'error', text: '수신할 Service를 선택하세요.' })
      return
    }
    try {
      await resetReceiveServiceHistory({
        service_name: selectedReceiveService.service_name,
        service_type: selectedReceiveService.service_type,
      })
      setActiveReceiveServiceKey(selectedReceiveServiceKey)
      await loadReceiveState()
      setFeedback({
        tone: 'success',
        text: `${selectedReceiveService.service_name} Service 수신 관찰을 시작했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const stopSelectedServiceReceive = async () => {
    if (!activeReceiveServiceKey) {
      setFeedback({ tone: 'warning', text: '수신 중인 Service 관찰 항목이 없습니다.' })
      return
    }
    setActiveReceiveServiceKey('')
    setFeedback({ tone: 'warning', text: 'Service 수신 관찰을 중지했습니다.' })
  }

  const resetServiceReceiveHistory = async () => {
    try {
      const payload = await resetReceiveServiceHistory()
      await loadReceiveState()
      setFeedback({
        tone: 'success',
        text: `Service 수신 이력 ${payload.data?.cleared ?? 0}개를 전체 리셋했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const resetSelectedServiceReceiveHistory = async () => {
    if (!selectedReceiveService) {
      setFeedback({ tone: 'error', text: '리셋할 Service를 선택하세요.' })
      return
    }
    try {
      const payload = await resetReceiveServiceHistory({
        service_name: selectedReceiveService.service_name,
        service_type: selectedReceiveService.service_type,
      })
      await loadReceiveState()
      setFeedback({
        tone: 'success',
        text: `${selectedReceiveService.service_name} 수신 이력 ${payload.data?.cleared ?? 0}개를 리셋했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const startSelectedActionReceive = async () => {
    if (!selectedReceiveAction) {
      setFeedback({ tone: 'error', text: '수신할 Action을 선택하세요.' })
      return
    }
    try {
      await resetReceiveActionHistory({
        action_name: selectedReceiveAction.action_name,
        action_type: selectedReceiveAction.action_type,
      })
      setActiveReceiveActionKey(selectedReceiveActionKey)
      await loadReceiveState()
      setFeedback({
        tone: 'success',
        text: `${selectedReceiveAction.action_name} Action 수신 관찰을 시작했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const stopSelectedActionReceive = async () => {
    if (!activeReceiveActionKey) {
      setFeedback({ tone: 'warning', text: '수신 중인 Action 관찰 항목이 없습니다.' })
      return
    }
    setActiveReceiveActionKey('')
    setFeedback({ tone: 'warning', text: 'Action 수신 관찰을 중지했습니다.' })
  }

  const resetActionReceiveHistory = async () => {
    try {
      const payload = await resetReceiveActionHistory()
      await loadReceiveState()
      setFeedback({
        tone: 'success',
        text: `Action 수신 이력 ${payload.data?.cleared ?? 0}개를 전체 리셋했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const resetSelectedActionReceiveHistory = async () => {
    if (!selectedReceiveAction) {
      setFeedback({ tone: 'error', text: '리셋할 Action을 선택하세요.' })
      return
    }
    try {
      const payload = await resetReceiveActionHistory({
        action_name: selectedReceiveAction.action_name,
        action_type: selectedReceiveAction.action_type,
      })
      await loadReceiveState()
      setFeedback({
        tone: 'success',
        text: `${selectedReceiveAction.action_name} 수신 이력 ${payload.data?.cleared ?? 0}개를 리셋했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const loadCallableTopics = async (keepOpen = false) => {
    setBusy(true)
    try {
      const [messagesPayload, publishHistoryPayload] = await Promise.all([
        fetchCallableMessages(),
        fetchTopicPublishHistory({ limit: 100 }),
      ])
      const messages = messagesPayload.data ?? []
      setCallableMessages(messages)
      setTopicPublishHistory(publishHistoryPayload.data ?? [])
      setShowCallableTopics(true)
      if (!keepOpen) {
        setShowRegistry(false)
        setShowPackages(false)
        setShowCallableServices(false)
        setShowCallableActions(false)
        setShowBuildLog(false)
      }
      const selectableMessages = topicImportableOnly
        ? messages.filter((message) => message.import_available)
        : messages
      const selectedStillExists = selectableMessages.some(
        (message) => messageKey(message) === selectedMessageKey,
      )
      const nextSelected = selectedStillExists
        ? selectedMessageKey
        : selectableMessages[0] ? messageKey(selectableMessages[0]) : ''
      setSelectedMessageKey(nextSelected)
      const nextMessage = selectableMessages.find(
        (message) => messageKey(message) === nextSelected,
      )
      if (nextMessage) {
        setTopicMessageValues(defaultRequestValues(nextMessage.message_schema ?? []))
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const refreshExecutionCandidatesAfterDelete = async () => {
    const [messagesPayload, servicesPayload, actionsPayload] = await Promise.all([
      fetchCallableMessages(),
      fetchCallableServices(),
      fetchCallableActions(),
    ])
    setCallableMessages(messagesPayload.data ?? [])
    setCallableServices(servicesPayload.data ?? [])
    setCallableActions(actionsPayload.data ?? [])
  }

  const handleRemoveManualDefinition = (item) =>
    removeManualDefinition(item, refreshExecutionCandidatesAfterDelete)

  const handleRemovePackage = (packageName) =>
    removePackage(packageName, refreshExecutionCandidatesAfterDelete)

  const handleRemoveRegistryEntry = (item) =>
    removeRegistryEntry(item, refreshExecutionCandidatesAfterDelete)

  const loadCallableServices = async (keepOpen = false) => {
    setBusy(true)
    try {
      const [servicesPayload, historyPayload] = await Promise.all([
        fetchCallableServices(),
        fetchServiceCallHistory(),
      ])
      const services = servicesPayload.data ?? []
      setCallableServices(services)
      setServiceCallHistory(historyPayload.data ?? [])
      setShowCallableServices(true)
      if (!keepOpen) {
        setShowRegistry(false)
        setShowPackages(false)
        setShowCallableTopics(false)
        setShowCallableActions(false)
        setShowBuildLog(false)
      }
      const selectableServices = serviceImportableOnly
        ? services.filter((service) => service.import_available)
        : services
      const selectedStillExists = selectableServices.some(
        (service) => serviceKey(service) === selectedServiceKey,
      )
      const nextSelected = selectedStillExists
        ? selectedServiceKey
        : selectableServices[0] ? serviceKey(selectableServices[0]) : ''
      setSelectedServiceKey(nextSelected)
      setSelectedReceiveServiceKey(nextSelected)
      const nextService = selectableServices.find(
        (service) => serviceKey(service) === nextSelected,
      )
      if (nextService) {
        setRequestValues(defaultRequestValues(nextService.request_schema))
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const loadCallableActions = async (keepOpen = false) => {
    setBusy(true)
    try {
      const [actionsPayload, historyPayload] = await Promise.all([
        fetchCallableActions(),
        fetchActionGoalHistory(),
      ])
      const actions = actionsPayload.data ?? []
      setCallableActions(actions)
      setActionGoalHistory(historyPayload.data ?? [])
      setShowCallableActions(true)
      if (!keepOpen) {
        setShowRegistry(false)
        setShowPackages(false)
        setShowCallableTopics(false)
        setShowCallableServices(false)
        setShowBuildLog(false)
      }
      const selectableActions = actionImportableOnly
        ? actions.filter((action) => action.import_available)
        : actions
      const selectedStillExists = selectableActions.some(
        (action) => actionKey(action) === selectedActionKey,
      )
      const nextSelected = selectedStillExists
        ? selectedActionKey
        : selectableActions[0] ? actionKey(selectableActions[0]) : ''
      setSelectedActionKey(nextSelected)
      setSelectedReceiveActionKey(nextSelected)
      const nextAction = selectableActions.find(
        (action) => actionKey(action) === nextSelected,
      )
      if (nextAction) {
        setGoalValues(defaultRequestValues(nextAction.goal_schema))
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const executeServiceCall = async () => {
    if (!selectedService || !selectedService.callable) {
      setServiceCallResult({ success: false, error: '호출 가능한 Service가 없습니다.' })
      return
    }
    setServiceCallBusy(true)
    setServiceCallResult(null)
    try {
      const payload = await callRegisteredService({
        service_name: selectedService.service_name,
        service_type: selectedService.service_type,
        request: normalizeNumericValues(requestValues, selectedService.request_schema),
        timeout_sec: timeoutSec,
      })
      setServiceCallResult(payload)
      const historyPayload = await fetchServiceCallHistory()
      setServiceCallHistory(historyPayload.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setServiceCallResult({ success: false, error: error.message })
    } finally {
      setServiceCallBusy(false)
    }
  }

  const executeActionGoal = async () => {
    if (!selectedAction || !selectedAction.callable) {
      setActionGoalResult({ success: false, error: '실행 가능한 Action이 없습니다.' })
      return
    }
    setActionGoalBusy(true)
    setActionGoalResult(null)
    try {
      const payload = await sendActionGoal({
        action_name: selectedAction.action_name,
        action_type: selectedAction.action_type,
        full_type: selectedAction.full_type ?? selectedAction.selected_import_type ?? selectedAction.action_type,
        goal: normalizeNumericValues(goalValues, selectedAction.goal_schema),
        timeout_sec: goalTimeoutSec,
      })
      setActionGoalResult(payload)
      const historyPayload = await fetchActionGoalHistory()
      setActionGoalHistory(historyPayload.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setActionGoalResult({ success: false, accepted: false, error: error.message })
    } finally {
      setActionGoalBusy(false)
    }
  }

  useEffect(() => {
    loadApplyStatus().catch((error) => {
      setFeedback({ tone: 'warning', text: `적용 상태를 읽을 수 없습니다: ${error.message}` })
    })
  }, [loadApplyStatus, setFeedback])

  useEffect(() => {
    if (lastRefreshSignalRef.current === refreshSignal) return
    lastRefreshSignalRef.current = refreshSignal

    const refreshOpenState = async () => {
      try {
        const statusPayload = await fetchInterfaceApplyStatus()
        setApplyStatus(statusPayload.data)
        setBuildLogTail(statusPayload.data?.log_tail ?? '')
        if (showRegistry) {
          const registryPayload = await fetchInterfaceRegistry()
          setRegistry(registryPayload.data)
          setShowRegistry(true)
        }
        if (showPackages) {
          const packagesPayload = await fetchInterfacePackages()
          setPackages(packagesPayload.data ?? [])
          setShowPackages(true)
        }
        if (showCallableTopics) {
          const [messagesPayload, publishHistoryPayload] = await Promise.all([
            fetchCallableMessages(),
            fetchTopicPublishHistory({ limit: 100 }),
          ])
          const messages = messagesPayload.data ?? []
          setCallableMessages(messages)
          setTopicPublishHistory(publishHistoryPayload.data ?? [])
          setShowCallableTopics(true)
          const selectableMessages = topicImportableOnly
            ? messages.filter((message) => message.import_available)
            : messages
          const selectedStillExists = selectableMessages.some(
            (message) => messageKey(message) === selectedMessageKey,
          )
          const nextSelected = selectedStillExists
            ? selectedMessageKey
            : selectableMessages[0] ? messageKey(selectableMessages[0]) : ''
          setSelectedMessageKey(nextSelected)
          const nextMessage = selectableMessages.find(
            (message) => messageKey(message) === nextSelected,
          )
          if (nextMessage) {
            setTopicMessageValues(defaultRequestValues(nextMessage.message_schema ?? []))
          }
        }
        if (showCallableServices) {
          const [servicesPayload, historyPayload] = await Promise.all([
            fetchCallableServices(),
            fetchServiceCallHistory(),
          ])
          const services = servicesPayload.data ?? []
          setCallableServices(services)
          setServiceCallHistory(historyPayload.data ?? [])
          setShowCallableServices(true)
          const selectedStillExists = services.some(
            (service) => serviceKey(service) === selectedServiceKey,
          )
          const nextSelected = selectedStillExists
            ? selectedServiceKey
            : services[0] ? serviceKey(services[0]) : ''
          setSelectedServiceKey(nextSelected)
          const nextService = services.find(
            (service) => serviceKey(service) === nextSelected,
          )
          if (nextService) {
            setRequestValues(defaultRequestValues(nextService.request_schema))
          }
        }
        if (showCallableActions) {
          const [actionsPayload, historyPayload] = await Promise.all([
            fetchCallableActions(),
            fetchActionGoalHistory(),
          ])
          const actions = actionsPayload.data ?? []
          setCallableActions(actions)
          setActionGoalHistory(historyPayload.data ?? [])
          setShowCallableActions(true)
          const selectedStillExists = actions.some(
            (action) => actionKey(action) === selectedActionKey,
          )
          const nextSelected = selectedStillExists
            ? selectedActionKey
            : actions[0] ? actionKey(actions[0]) : ''
          setSelectedActionKey(nextSelected)
          const nextAction = actions.find(
            (action) => actionKey(action) === nextSelected,
          )
          if (nextAction) {
            setGoalValues(defaultRequestValues(nextAction.goal_schema))
          }
        }
      } catch (error) {
        setFeedback({ tone: 'warning', text: `상태 새로고침에 실패했습니다: ${error.message}` })
      }
    }

    refreshOpenState()
  }, [
    refreshSignal,
    selectedActionKey,
    selectedMessageKey,
    selectedServiceKey,
    showCallableActions,
    showCallableTopics,
    showCallableServices,
    showPackages,
    showRegistry,
    setApplyStatus,
    setBuildLogTail,
    setFeedback,
    setPackages,
    setRegistry,
    setShowPackages,
    setShowRegistry,
    topicImportableOnly,
  ])

  useEffect(() => {
    if (reloadPhase === 'scheduled' && websocket?.status !== 'connected') {
      setReloadPhase('reconnecting')
    }
    if (reloadPhase === 'reconnecting' && websocket?.status === 'connected') {
      runImportCheck()
    }
  }, [reloadPhase, runImportCheck, setReloadPhase, websocket?.status])

  useEffect(() => {
    if (reloadPhase !== 'scheduled') return undefined
    const timer = window.setTimeout(() => {
      runImportCheck()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [reloadPhase, runImportCheck])

  useEffect(() => {
    if (!showReceivePanel || receiveMode === 'mock') return undefined
    const timer = window.setInterval(() => {
      loadReceiveState({ silent: true })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [
    activeReceiveActionKey,
    activeReceiveServiceKey,
    loadReceiveState,
    receiveMode,
    showReceivePanel,
  ])

  useEffect(() => {
    if (!activeContinuousPublishKey) return undefined
    const timer = window.setInterval(async () => {
      try {
        const payload = await fetchContinuousTopicPublishes()
        setContinuousTopicPublishes(payload.data ?? [])
      } catch {
        // The regular page refresh and explicit stop action will surface API errors.
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeContinuousPublishKey])

  useEffect(() => {
    onTopicWorkspaceExpandedChange?.(topicExpandedActive)
    return () => onTopicWorkspaceExpandedChange?.(false)
  }, [onTopicWorkspaceExpandedChange, topicExpandedActive])

  const openExecutionPanel = async (mode, loader) => {
    setShowReceivePanel(true)
    setReceiveMode(mode)
    await loader()
    await loadReceiveState({ silent: true })
  }

  const openReceivePanel = () => {
    setShowReceivePanel(true)
    setShowCallableTopics(false)
    setShowCallableServices(false)
    setShowCallableActions(false)
    setShowManualInput(false)
    setShowRegistry(false)
    setShowPackages(false)
    setShowBuildLog(false)
    loadReceiveState()
  }

  const selectReceiveMode = async (mode) => {
    setReceiveMode(mode)
    if (mode === 'mock') {
      setShowCallableTopics(false)
      setShowCallableServices(false)
      setShowCallableActions(false)
      return
    }
    const loaders = {
      action: loadCallableActions,
      service: loadCallableServices,
      topic: loadCallableTopics,
    }
    await loaders[mode]?.()
    await loadReceiveState({ silent: true })
  }

  return (
    <div className={topicExpandedActive ? 'interface-upload-control topic-workbench-expanded' : 'interface-upload-control'}>
      <InterfaceUploadToolbar
        applying={applying}
        busy={busy}
        disabled={disabled}
        feedback={feedback}
        inputRef={inputRef}
        onApply={applyUploadedInterfaces}
        onFile={handleFile}
        onOpenAction={() => openExecutionPanel('action', loadCallableActions)}
        onOpenPackages={loadPackages}
        onOpenReceive={openReceivePanel}
        onOpenRegistry={loadRegistry}
        onOpenService={() => openExecutionPanel('service', loadCallableServices)}
        onOpenTopic={() => openExecutionPanel('topic', loadCallableTopics)}
        onPackageFile={handlePackageFile}
        onPackageFolder={handlePackageFolder}
        onReplaceChange={setReplacePackage}
        onToggleManual={() => setShowManualInput((value) => !value)}
        packageFolderInputRef={packageFolderInputRef}
        packageInputRef={packageInputRef}
        reloadPhase={reloadPhase}
        replacePackage={replacePackage}
        websocketStatus={websocket?.status}
      />
      {showManualInput && (
        <ManualInterfacePanel
          disabled={disabled}
          editingManualDefinition={editingManualDefinition}
          manualDefinition={manualDefinition}
          manualKind={manualKind}
          manualMode={manualMode}
          manualType={manualType}
          manualTypeName={manualTypeName}
          onCancelEdit={() => setEditingManualDefinition(null)}
          onDefinitionChange={setManualDefinition}
          onKindChange={setManualKind}
          onModeChange={setManualMode}
          onSubmitDefinition={submitManualDefinition}
          onSubmitType={submitManualType}
          onTypeChange={setManualType}
          onTypeNameChange={setManualTypeName}
          onValidateDefinition={validateCurrentManualDefinition}
        />
      )}
      {showReceivePanel && (
        <InterfaceReceiveWorkbench
          expanded={topicExpandedActive}
          mode={receiveMode}
          onModeChange={selectReceiveMode}
          onToggleExpanded={() => setTopicWorkspaceExpanded((value) => !value)}
        >
          {receiveMode === 'topic' && (
            <TopicReceivePanel
              allMessages={callableMessages}
              allTopics={availableTopics}
              filteredTopics={filteredReceiveTopics}
              importableOnly={topicImportableOnly}
              onImportableOnlyChange={setTopicImportableOnly}
              onMessageSelect={(key) => {
                const message = callableMessages.find((item) => messageKey(item) === key)
                setSelectedMessageKey(key)
                setTopicMessageValues(defaultRequestValues(message?.message_schema ?? []))
                setTopicPublishResult(null)
              }}
              onRefresh={loadReceiveState}
              onResetAll={resetAllTopicReceiveHistory}
              onResetSelected={resetSelectedTopicReceiveHistory}
              onSearchChange={setReceiveTopicSearch}
              onStart={startSelectedTopicReceive}
              onStop={stopSelectedTopicReceive}
              onTopicNameChange={(value, source) => {
                selectedReceiveTopicSourceRef.current = value ? source : 'empty'
                setSelectedReceiveTopic(value)
              }}
              receiveHistory={visibleReceiveTopicHistory}
              receiving={selectedTopicReceiving}
              receivingTopics={receiveTopics}
              search={receiveTopicSearch}
              selectedMessage={selectedMessage}
              selectedMessageKey={selectedMessageKey}
              selectedTopic={selectedReceiveTopic}
              visibleMessages={visibleCallableMessages}
            />
          )}
          {receiveMode === 'service' && (
            <ServiceReceivePanel
              activeKey={activeReceiveServiceKey}
              history={visibleReceiveServiceHistory}
              items={callableServices}
              onRefresh={loadReceiveState}
              onResetAll={resetServiceReceiveHistory}
              onResetSelected={resetSelectedServiceReceiveHistory}
              onSearchChange={setReceiveServiceSearch}
              onSelect={(key) => {
                const service = callableServices.find((item) => serviceKey(item) === key)
                setSelectedReceiveServiceKey(key)
                setSelectedServiceKey(key)
                setRequestValues(defaultRequestValues(service?.request_schema ?? []))
                setServiceCallResult(null)
              }}
              onStart={startSelectedServiceReceive}
              onStop={stopSelectedServiceReceive}
              search={receiveServiceSearch}
              selectedKey={selectedReceiveServiceKey}
              visibleItems={filteredReceiveServices}
            />
          )}
          {receiveMode === 'action' && (
            <ActionReceivePanel
              activeKey={activeReceiveActionKey}
              history={visibleReceiveActionHistory}
              items={callableActions}
              onRefresh={loadReceiveState}
              onResetAll={resetActionReceiveHistory}
              onResetSelected={resetSelectedActionReceiveHistory}
              onSearchChange={setReceiveActionSearch}
              onSelect={(key) => {
                const action = callableActions.find((item) => actionKey(item) === key)
                setSelectedReceiveActionKey(key)
                setSelectedActionKey(key)
                setGoalValues(defaultRequestValues(action?.goal_schema ?? []))
                setActionGoalResult(null)
              }}
              onStart={startSelectedActionReceive}
              onStop={stopSelectedActionReceive}
              search={receiveActionSearch}
              selectedKey={selectedReceiveActionKey}
              visibleItems={filteredReceiveActions}
            />
          )}
        </InterfaceReceiveWorkbench>
      )}
      {applyStatus?.build_status === 'failed' && (
        <BuildFailurePanel
          applying={applying}
          buildLogTail={buildLogTail}
          busy={busy}
          onApply={applyUploadedInterfaces}
          onRegenerate={regenerateUploadedInterfacesCmake}
          onToggle={toggleBuildLog}
          open={showBuildLog}
        />
      )}
      {showRegistry && (
        <RegisteredInterfacesPanel
          onDelete={handleRemoveRegistryEntry}
          onDeleteManual={handleRemoveManualDefinition}
          onEditManual={startEditManualDefinition}
          recentDeletedRegistry={recentDeletedRegistry}
          registry={registry}
        />
      )}
      {showPackages && (
        <UploadedPackagesPanel
          expanded={topicExpandedActive}
          onDelete={handleRemovePackage}
          onToggleExpanded={() => setTopicWorkspaceExpanded((value) => !value)}
          packages={packages}
        />
      )}
      {showCallableTopics && (
        <TopicExecutionPanel
          activeContinuousPublish={activeContinuousPublish}
          busy={topicPublishBusy}
          expanded={topicExpandedActive}
          history={visiblePublishHistory}
          importableOnly={topicImportableOnly}
          messageValues={topicMessageValues}
          messages={callableMessages}
          onContinuousStart={startSelectedContinuousTopicPublish}
          onContinuousStop={stopSelectedContinuousTopicPublish}
          onFieldChange={(name, value) => setTopicMessageValues((current) => ({ ...current, [name]: value }))}
          onHzChange={setTopicPublishHz}
          onImportableOnlyChange={setTopicImportableOnly}
          onPublish={publishSelectedTopicMessage}
          onResetHistory={resetSelectedTopicPublishHistory}
          onSelect={(key) => {
            const message = callableMessages.find((item) => messageKey(item) === key)
            setSelectedMessageKey(key)
            setTopicMessageValues(defaultRequestValues(message?.message_schema ?? []))
            setTopicPublishResult(null)
          }}
          onTopicNameChange={(value, sourceKind) => {
            topicPublishNameSourceRef.current = value ? sourceKind : 'empty'
            setTopicPublishName(value)
          }}
          onToggleExpanded={() => setTopicWorkspaceExpanded((value) => !value)}
          publishGraphTopics={publishGraphTopics}
          publishHz={topicPublishHz}
          publishName={topicPublishName}
          publishResult={topicPublishResult}
          publishWarning={topicPublishWarning}
          selected={selectedMessage}
          selectedKey={selectedMessageKey}
          showExpand={showReceivePanel && receiveMode === 'topic'}
          visibleMessages={visibleCallableMessages}
        />
      )}
      {showCallableServices && (
        <ServiceExecutionPanel
          busy={serviceCallBusy}
          calls={serviceCallHistory}
          expanded={topicExpandedActive}
          importableOnly={serviceImportableOnly}
          onExecute={executeServiceCall}
          onFieldChange={(name, value) => setRequestValues((current) => ({ ...current, [name]: value }))}
          onImportableOnlyChange={setServiceImportableOnly}
          onSelect={(key) => {
            const service = callableServices.find((item) => serviceKey(item) === key)
            setSelectedServiceKey(key)
            setSelectedReceiveServiceKey(key)
            setRequestValues(defaultRequestValues(service?.request_schema ?? []))
            setServiceCallResult(null)
          }}
          onTimeoutChange={setTimeoutSec}
          onToggleExpanded={() => setTopicWorkspaceExpanded((value) => !value)}
          requestValues={requestValues}
          result={serviceCallResult}
          selected={selectedService}
          selectedKey={selectedServiceKey}
          services={callableServices}
          showExpand={showReceivePanel && receiveMode === 'service'}
          timeoutSec={timeoutSec}
          visibleServices={visibleCallableServices}
        />
      )}
      {showCallableActions && (
        <ActionExecutionPanel
          actions={callableActions}
          busy={actionGoalBusy}
          expanded={topicExpandedActive}
          goals={actionGoalHistory}
          goalValues={goalValues}
          importableOnly={actionImportableOnly}
          onExecute={executeActionGoal}
          onFieldChange={(name, value) => setGoalValues((current) => ({ ...current, [name]: value }))}
          onImportableOnlyChange={setActionImportableOnly}
          onSelect={(key) => {
            const action = callableActions.find((item) => actionKey(item) === key)
            setSelectedActionKey(key)
            setSelectedReceiveActionKey(key)
            setGoalValues(defaultRequestValues(action?.goal_schema ?? []))
            setActionGoalResult(null)
          }}
          onTimeoutChange={setGoalTimeoutSec}
          onToggleExpanded={() => setTopicWorkspaceExpanded((value) => !value)}
          result={actionGoalResult}
          selected={selectedAction}
          selectedKey={selectedActionKey}
          showExpand={showReceivePanel && receiveMode === 'action'}
          timeoutSec={goalTimeoutSec}
          visibleActions={visibleCallableActions}
        />
      )}
    </div>
  )
}
