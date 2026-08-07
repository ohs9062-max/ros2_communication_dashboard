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
import { useResourceReceiveObserver } from './useResourceReceiveObserver.js'

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
  const selectedTopicReceiving = topics.some((topic) =>
    topic.topic_name === selectedTopic
    && (!selectedMessage?.message_type || topic.topic_type === selectedMessage.message_type)
    && topic.receiving !== false,
  )
  const visibleTopicHistory = topicHistory.filter((event) =>
    (!selectedTopic || event.topic_name === selectedTopic)
    && (!selectedMessage?.message_type || event.topic_type === selectedMessage.message_type),
  )

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
