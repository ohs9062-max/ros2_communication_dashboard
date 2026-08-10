import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  resetReceiveTopicHistory,
  startReceiveTopic,
  stopReceiveTopic,
} from '../../../api/interfaceExecution.js'
import { topicHasType } from '../../../utils/interfaceTopics.js'

export function useTopicReceiveController({
  availableTopics,
  load,
  selectedMessage,
  setFeedback,
  setTopicHistory,
  setTopics,
  topicHistory,
  topics,
}) {
  const [selectedTopic, setSelectedTopic] = useState('')
  const selectedTopicSourceRef = useRef('empty')
  const [topicSearch, setTopicSearch] = useState('')

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
      await startReceiveTopic({ topic_name: selectedTopic.trim(), topic_type: topicType, history_limit: 500 })
      await load()
      setFeedback({ tone: 'success', text: `${selectedTopic.trim()} · ${topicType} 수신을 시작했습니다.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const stopTopic = async () => {
    try {
      await stopReceiveTopic({ topic_name: selectedTopic, topic_type: selectedMessage?.message_type })
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
        event.topic_name !== selectedTopic || (selectedType && event.topic_type !== selectedType)))
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
    resetAllTopics,
    resetSelectedTopic,
    selectedTopic,
    selectedTopicReceiving,
    setTopicSearch,
    startTopic,
    stopTopic,
    topicSearch,
    topics,
    visibleTopicHistory,
  }
}
