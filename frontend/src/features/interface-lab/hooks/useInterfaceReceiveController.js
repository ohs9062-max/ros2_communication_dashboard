import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  resetReceiveTopicHistory,
  startReceiveTopic,
  stopReceiveTopic,
} from '../../../api/interfaceExecution.js'
import { fetchTopics } from '../../../api/monitoring.js'
import { actionKey, serviceKey } from '../model/interfaceUploadModel.js'
import { topicHasType } from '../../../utils/interfaceTopics.js'

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
  const [selectedTopic, setSelectedTopic] = useState('')
  const selectedTopicSourceRef = useRef('empty')
  const [topicSearch, setTopicSearch] = useState('')
  const [activeServiceKey, setActiveServiceKey] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')
  const [activeActionKey, setActiveActionKey] = useState('')
  const [actionSearch, setActionSearch] = useState('')
  const [topicHistory, setTopicHistory] = useState([])
  const [serviceHistory, setServiceHistory] = useState([])
  const [actionHistory, setActionHistory] = useState([])

  const filteredTopics = useMemo(() => {
    const keyword = topicSearch.trim().toLowerCase()
    const selectedType = selectedMessage?.message_type
    return availableTopics.filter((topic) => {
      const topicType = topic.type ?? topic.types?.[0] ?? ''
      if (selectedType && !topicHasType(topic, selectedType)) return false
      if (!keyword) return true
      return `${topic.name} ${topicType}`.toLowerCase().includes(keyword)
    })
  }, [availableTopics, selectedMessage?.message_type, topicSearch])
  const filteredServices = services.filter((service) => {
    const keyword = serviceSearch.trim().toLowerCase()
    if (!keyword) return true
    return `${service.service_name ?? service.file_name ?? ''} ${service.service_type ?? ''}`.toLowerCase().includes(keyword)
  })
  const filteredActions = actions.filter((action) => {
    const keyword = actionSearch.trim().toLowerCase()
    if (!keyword) return true
    return `${action.action_name ?? action.file_name ?? ''} ${action.action_type ?? ''}`.toLowerCase().includes(keyword)
  })
  const selectedService = services.find(
    (service) => serviceKey(service) === selectedReceiveServiceKey,
  )
  const selectedAction = actions.find(
    (action) => actionKey(action) === selectedReceiveActionKey,
  )
  const selectedTopicReceiving = topics.some((topic) =>
    topic.topic_name === selectedTopic
    && (!selectedMessage?.message_type || topic.topic_type === selectedMessage.message_type)
    && topic.receiving !== false,
  )
  const visibleTopicHistory = topicHistory.filter((event) =>
    (!selectedTopic || event.topic_name === selectedTopic)
    && (!selectedMessage?.message_type || event.topic_type === selectedMessage.message_type),
  )
  const visibleServiceHistory = selectedService && activeServiceKey === selectedReceiveServiceKey
    ? serviceHistory.filter((event) =>
      event.service_name === selectedService.service_name
      && event.service_type === selectedService.service_type)
    : []
  const visibleActionHistory = selectedAction && activeActionKey === selectedReceiveActionKey
    ? actionHistory.filter((event) =>
      event.action_name === selectedAction.action_name
      && event.action_type === selectedAction.action_type)
    : []

  useEffect(() => {
    if (!selectedMessage?.message_type) return
    const currentIsCandidate = filteredTopics.some((topic) => topic.name === selectedTopic)
    const source = selectedTopicSourceRef.current
    if (source === 'user' && selectedTopic.trim()) return
    if ((source === 'auto' || source === 'graph') && currentIsCandidate) return

    const nextTopicName = filteredTopics[0]?.name ?? ''
    selectedTopicSourceRef.current = nextTopicName ? 'auto' : 'empty'
    setSelectedTopic(nextTopicName)
  }, [filteredTopics, selectedMessage?.message_type, selectedTopic])

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
  ])

  useEffect(() => {
    if (!open || mode === 'mock') return undefined
    const timer = window.setInterval(() => load({ silent: true }), 1000)
    return () => window.clearInterval(timer)
  }, [activeActionKey, activeServiceKey, load, mode, open])

  const changeTopic = useCallback((value, source) => {
    selectedTopicSourceRef.current = value ? source : 'empty'
    setSelectedTopic(value)
  }, [])

  const startTopic = async () => {
    if (!selectedTopic.trim()) {
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
        topic_name: selectedTopic.trim(),
        topic_type: topicType,
        history_limit: 500,
      })
      await load()
      setFeedback({ tone: 'success', text: `${selectedTopic.trim()} · ${topicType} 수신을 시작했습니다.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const stopTopic = async () => {
    try {
      await stopReceiveTopic({
        topic_name: selectedTopic,
        topic_type: selectedMessage?.message_type,
      })
      await load()
      setFeedback({ tone: 'warning', text: `${selectedTopic} 수신을 중지했습니다.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const resetSelectedTopic = async () => {
    if (!selectedTopic) {
      setFeedback({ tone: 'error', text: '리셋할 Topic을 선택하세요.' })
      return
    }
    try {
      const selectedType = selectedMessage?.message_type
      const payload = await resetReceiveTopicHistory(selectedTopic, selectedType)
      setTopics(payload.data?.topics ?? [])
      setTopicHistory((items) => items.filter((event) =>
        event.topic_name !== selectedTopic
        || (selectedType && event.topic_type !== selectedType)))
      await load()
      setFeedback({
        tone: 'success',
        text: `${selectedTopic} 수신 항목 ${payload.data?.removed ?? 0}개와 이력 ${payload.data?.cleared ?? 0}개를 삭제했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const resetAllTopics = async () => {
    try {
      const payload = await resetReceiveTopicHistory()
      setTopics(payload.data?.topics ?? [])
      setTopicHistory([])
      await load()
      setFeedback({
        tone: 'success',
        text: `수신 중 Topic ${payload.data?.removed ?? 0}개와 이력 ${payload.data?.cleared ?? 0}개를 전체 삭제했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const startService = async () => {
    if (!selectedService) {
      setFeedback({ tone: 'error', text: '수신할 Service를 선택하세요.' })
      return
    }
    try {
      await resetReceiveServiceHistory({
        service_name: selectedService.service_name,
        service_type: selectedService.service_type,
      })
      setActiveServiceKey(selectedReceiveServiceKey)
      await load()
      setFeedback({ tone: 'success', text: `${selectedService.service_name} Service 수신 관찰을 시작했습니다.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const stopService = async () => {
    if (!activeServiceKey) {
      setFeedback({ tone: 'warning', text: '수신 중인 Service 관찰 항목이 없습니다.' })
      return
    }
    setActiveServiceKey('')
    setFeedback({ tone: 'warning', text: 'Service 수신 관찰을 중지했습니다.' })
  }

  const resetServices = async (selectedOnly = false) => {
    if (selectedOnly && !selectedService) {
      setFeedback({ tone: 'error', text: '리셋할 Service를 선택하세요.' })
      return
    }
    try {
      const payload = await resetReceiveServiceHistory(selectedOnly ? {
        service_name: selectedService.service_name,
        service_type: selectedService.service_type,
      } : undefined)
      await load()
      setFeedback({
        tone: 'success',
        text: selectedOnly
          ? `${selectedService.service_name} 수신 이력 ${payload.data?.cleared ?? 0}개를 리셋했습니다.`
          : `Service 수신 이력 ${payload.data?.cleared ?? 0}개를 전체 리셋했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const startAction = async () => {
    if (!selectedAction) {
      setFeedback({ tone: 'error', text: '수신할 Action을 선택하세요.' })
      return
    }
    try {
      await resetReceiveActionHistory({
        action_name: selectedAction.action_name,
        action_type: selectedAction.action_type,
      })
      setActiveActionKey(selectedReceiveActionKey)
      await load()
      setFeedback({ tone: 'success', text: `${selectedAction.action_name} Action 수신 관찰을 시작했습니다.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const stopAction = async () => {
    if (!activeActionKey) {
      setFeedback({ tone: 'warning', text: '수신 중인 Action 관찰 항목이 없습니다.' })
      return
    }
    setActiveActionKey('')
    setFeedback({ tone: 'warning', text: 'Action 수신 관찰을 중지했습니다.' })
  }

  const resetActions = async (selectedOnly = false) => {
    if (selectedOnly && !selectedAction) {
      setFeedback({ tone: 'error', text: '리셋할 Action을 선택하세요.' })
      return
    }
    try {
      const payload = await resetReceiveActionHistory(selectedOnly ? {
        action_name: selectedAction.action_name,
        action_type: selectedAction.action_type,
      } : undefined)
      await load()
      setFeedback({
        tone: 'success',
        text: selectedOnly
          ? `${selectedAction.action_name} 수신 이력 ${payload.data?.cleared ?? 0}개를 리셋했습니다.`
          : `Action 수신 이력 ${payload.data?.cleared ?? 0}개를 전체 리셋했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  return {
    actionSearch,
    activeActionKey,
    activeServiceKey,
    changeTopic,
    filteredActions,
    filteredServices,
    filteredTopics,
    load,
    mode,
    open,
    resetActions,
    resetAllTopics,
    resetSelectedTopic,
    resetServices,
    selectedTopic,
    selectedTopicReceiving,
    serviceSearch,
    setActionSearch,
    setMode,
    setOpen,
    setServiceSearch,
    setTopicSearch,
    startAction,
    startService,
    startTopic,
    stopAction,
    stopService,
    stopTopic,
    topicSearch,
    topics,
    visibleActionHistory,
    visibleServiceHistory,
    visibleTopicHistory,
  }
}
