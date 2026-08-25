import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  resetReceiveTopicHistory,
  startReceiveTopic,
  stopReceiveTopic,
} from '../../../api/interfaceExecution.js'
import { topicHasType } from '../../../utils/interfaceTopics.js'
import { domainIdFromResource } from '../model/interfaceUploadModel.js'
import { useExecutionQos } from './useExecutionQos.js'

export function useTopicReceiveController({
  availableTopics,
  load,
  onTopicSelectionChange,
  selectedMessage,
  setFeedback,
  setTopicHistory,
  setTopics,
  topicHistory,
  topics,
}) {
  const [selectedTopic, setSelectedTopic] = useState('')
  const [selectedDomainId, setSelectedDomainId] = useState(null)
  const [selectedResourceKey, setSelectedResourceKey] = useState('')
  const selectedTopicSourceRef = useRef('empty')
  const [topicSearch, setTopicSearch] = useState('')
  const qos = useExecutionQos()

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
    && topic.domain_id === selectedDomainId
    && (!selectedMessage?.message_type || topic.topic_type === selectedMessage.message_type)
    && topic.receiving !== false,
  )
  const visibleTopicHistory = topicHistory.filter((event) =>
    (!selectedTopic || event.topic_name === selectedTopic)
    && (selectedDomainId === null || event.domain_id === selectedDomainId)
    && (!selectedMessage?.message_type || event.topic_type === selectedMessage.message_type),
  )

  useEffect(() => {
    if (!selectedMessage?.message_type) return
    const currentIsCandidate = filteredTopics.some((topic) =>
      topic.name === selectedTopic && topic.domain_id === selectedDomainId)
    const source = selectedTopicSourceRef.current
    if (source === 'user' && selectedTopic.trim()) return
    if ((source === 'auto' || source === 'graph') && currentIsCandidate) return

    const nextTopic = filteredTopics[0] ?? null
    selectedTopicSourceRef.current = nextTopic ? 'auto' : 'empty'
    setSelectedTopic(nextTopic?.name ?? '')
    setSelectedDomainId(nextTopic?.domain_id ?? null)
    setSelectedResourceKey(nextTopic?.resource_key ?? '')
  }, [filteredTopics, selectedDomainId, selectedMessage?.message_type, selectedTopic])

  const changeTopic = useCallback((value, source) => {
    if (source === 'graph') {
      const topic = filteredTopics.find((item) => item.resource_key === value)
      selectedTopicSourceRef.current = topic ? 'graph' : 'empty'
      setSelectedTopic(topic?.name ?? '')
      setSelectedDomainId(topic?.domain_id ?? null)
      setSelectedResourceKey(topic?.resource_key ?? '')
      if (topic) onTopicSelectionChange?.(topic)
      return
    }
    selectedTopicSourceRef.current = value ? source : 'empty'
    setSelectedTopic(value)
    setSelectedDomainId(null)
    setSelectedResourceKey('')
  }, [filteredTopics, onTopicSelectionChange])

  const selectTopicFromExecution = useCallback((topic) => {
    if (!topic?.resource_key) return
    selectedTopicSourceRef.current = 'graph'
    setSelectedTopic(topic.name ?? '')
    setSelectedDomainId(topic.domain_id ?? null)
    setSelectedResourceKey(topic.resource_key)
  }, [])

  const startTopic = async () => {
    if (!selectedTopic.trim()) {
      setFeedback({ tone: 'error', text: 'Enter a Topic name to receive.' })
      return
    }
    const topicType = selectedMessage?.message_type
    if (!topicType) {
      setFeedback({ tone: 'error', text: 'Select a Message full_type to receive.' })
      return
    }
    const domainId = domainIdFromResource({
      domain_id: selectedDomainId,
      resource_key: selectedResourceKey,
    })
    if (domainId === null) {
      setFeedback({ tone: 'error', text: 'Select a Graph Topic with a monitored Domain ID to receive.' })
      return
    }
    try {
      await startReceiveTopic({
        topic_name: selectedTopic.trim(),
        topic_type: topicType,
        history_limit: 500,
        qos: qos.qosSelection,
        domain_id: domainId,
      })
      await load()
      setFeedback({ tone: 'success', text: `${selectedTopic.trim()} · ${topicType} 수신을 시작했습니다.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const stopTopic = async () => {
    const domainId = domainIdFromResource({
      domain_id: selectedDomainId,
      resource_key: selectedResourceKey,
    })
    if (domainId === null) {
      setFeedback({ tone: 'error', text: 'Select a Graph Topic with a monitored Domain ID to stop receiving.' })
      return
    }
    try {
      await stopReceiveTopic({ topic_name: selectedTopic, topic_type: selectedMessage?.message_type, domain_id: domainId })
      await load()
      setFeedback({ tone: 'warning', text: `Stopped receiving ${selectedTopic}.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const resetSelectedTopic = async () => {
    if (!selectedTopic) {
      setFeedback({ tone: 'error', text: 'Select a Topic to reset.' })
      return
    }
    try {
      const selectedType = selectedMessage?.message_type
      const payload = await resetReceiveTopicHistory(selectedTopic, selectedType, selectedDomainId)
      setTopics(payload.data?.topics ?? [])
      setTopicHistory((items) => items.filter((event) =>
        event.domain_id !== selectedDomainId
        || event.topic_name !== selectedTopic
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
    changeTopic,
    filteredTopics,
    ...qos,
    resetAllTopics,
    resetSelectedTopic,
    selectedTopic,
    selectedDomainId,
    selectedTopicReceiving,
    selectTopicFromExecution,
    setTopicSearch,
    startTopic,
    stopTopic,
    topicSearch,
    topics,
    visibleTopicHistory,
  }
}
