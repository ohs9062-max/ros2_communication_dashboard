import { useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchContinuousTopicPublishes,
  publishTopicMessage,
  resetReceiveTopicHistory,
  resetTopicPublishHistory,
  startContinuousTopicPublish,
  startReceiveTopic,
  stopContinuousTopicPublish,
  stopReceiveTopic,
} from '../../../api/interfaceExecution.js'
import {
  graphPublishTopicCandidates,
  topicNameTypeWarning,
} from '../../../utils/interfaceTopics.js'
import { defaultValues, normalizeNumericValues } from '../model/schemaValues.js'
import { useExecutionQos } from './useExecutionQos.js'

export function useInlineTopicController({
  continuousTopicPublishes,
  refresh,
  selectedDetail,
  topics,
  updateSnapshotField,
}) {
  const [messageValues, setMessageValues] = useState({})
  const [publishName, setPublishName] = useState('')
  const [publishHz, setPublishHz] = useState(10)
  const [subscribeName, setSubscribeName] = useState('')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState(null)
  const publishNameSourceRef = useRef('empty')
  const publishQos = useExecutionQos()
  const subscribeQos = useExecutionQos()

  const publishGraphTopics = useMemo(
    () => graphPublishTopicCandidates(topics, selectedDetail?.fullType),
    [selectedDetail?.fullType, topics],
  )
  const defaultTopicName = selectedDetail?.connectedTopics?.[0]?.name
    ?? selectedDetail?.topicStates?.[0]?.topic_name
    ?? ''
  const publishWarning = topicNameTypeWarning(topics, publishName, selectedDetail?.fullType)
  const activeContinuousPublish = continuousTopicPublishes.find((item) =>
    item.active
    && item.topic_name === publishName
    && item.topic_type === selectedDetail?.fullType)
  const activeContinuousPublishKey = activeContinuousPublish
    ? `${activeContinuousPublish.topic_name}\u0000${activeContinuousPublish.topic_type}`
    : ''

  useEffect(() => {
    if (!activeContinuousPublishKey) return undefined
    const timer = window.setInterval(async () => {
      try {
        const payload = await fetchContinuousTopicPublishes()
        updateSnapshotField('continuousTopicPublishes', payload.data ?? [])
      } catch {
        // Explicit actions and the regular refresh surface connection errors.
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeContinuousPublishKey, updateSnapshotField])

  useEffect(() => {
    setResult(null)
    if (selectedDetail?.kind === 'message') {
      setMessageValues(defaultValues(selectedDetail.schema ?? []))
      setSubscribeName(defaultTopicName)
    }
  }, [defaultTopicName, selectedDetail?.kind, selectedDetail?.schema, selectedDetail?.stableKey])

  useEffect(() => {
    if (selectedDetail?.kind !== 'message') return
    const currentName = publishName.trim()
    const currentIsCandidate = publishGraphTopics.some((topic) => topic.name === currentName)
    const source = publishNameSourceRef.current

    if (source === 'user') {
      if (currentName) return
    } else if (source === 'graph') {
      if (currentIsCandidate) return
      publishNameSourceRef.current = 'empty'
      setPublishName('')
      return
    } else if (source === 'auto' && publishGraphTopics.length !== 1) {
      publishNameSourceRef.current = 'empty'
      setPublishName('')
      return
    }

    if (publishGraphTopics.length === 1) {
      const nextName = publishGraphTopics[0].name
      if (source === 'auto' && currentName === nextName) return
      publishNameSourceRef.current = 'auto'
      setPublishName(nextName)
    }
  }, [publishGraphTopics, selectedDetail?.kind, selectedDetail?.fullType, publishName])

  const updatePublishName = (value) => {
    publishNameSourceRef.current = value ? 'user' : 'empty'
    setPublishName(value)
  }

  const selectPublishGraphTopic = (value) => {
    publishNameSourceRef.current = value ? 'graph' : 'empty'
    setPublishName(value)
  }

  const publish = async () => {
    if (!selectedDetail?.fullType) {
      setResult({ success: false, error: 'Message full_type이 없습니다.' })
      return
    }
    if (!publishName) {
      setResult({ success: false, error: 'Publish할 Topic 이름을 입력하세요.' })
      return
    }
    setExecuting(true)
    setResult(null)
    try {
      const nextResult = await publishTopicMessage({
        topic_name: publishName,
        topic_type: selectedDetail.fullType,
        full_type: selectedDetail.fullType,
        message: normalizeNumericValues(messageValues, selectedDetail.schema),
        qos: publishQos.qosSelection,
      })
      setResult(nextResult)
      await refresh({ notifyWorkbench: false })
    } catch (error) {
      setResult({ success: false, error: error.message, sent_to_topic: false })
    } finally {
      setExecuting(false)
    }
  }

  const startContinuous = async () => {
    if (!selectedDetail?.fullType || !publishName) {
      setResult({ success: false, error: 'Message full_type과 Publish Topic 이름이 필요합니다.' })
      return
    }
    setExecuting(true)
    setResult(null)
    try {
      const nextResult = await startContinuousTopicPublish({
        topic_name: publishName,
        topic_type: selectedDetail.fullType,
        full_type: selectedDetail.fullType,
        message: normalizeNumericValues(messageValues, selectedDetail.schema),
        hz: Number(publishHz),
        qos: publishQos.qosSelection,
      })
      setResult(nextResult)
      await refresh({ notifyWorkbench: false })
    } catch (error) {
      setResult({ success: false, error: error.message, sent_to_topic: false })
    } finally {
      setExecuting(false)
    }
  }

  const stopContinuous = async () => {
    if (!selectedDetail?.fullType || !publishName) return
    setExecuting(true)
    try {
      const nextResult = await stopContinuousTopicPublish({
        topic_name: publishName,
        topic_type: selectedDetail.fullType,
      })
      setResult(nextResult)
      await refresh({ notifyWorkbench: false })
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setExecuting(false)
    }
  }

  const startSubscribe = async () => {
    if (!selectedDetail?.fullType || !subscribeName) {
      setResult({ success: false, error: 'Topic 이름과 Message full_type이 필요합니다.' })
      return
    }
    try {
      const nextResult = await startReceiveTopic({
        topic_name: subscribeName,
        topic_type: selectedDetail.fullType,
        full_type: selectedDetail.fullType,
        history_limit: 500,
        qos: subscribeQos.qosSelection,
      })
      setResult(nextResult)
      await refresh({ notifyWorkbench: false })
    } catch (error) {
      setResult({ success: false, error: error.message })
    }
  }

  const stopSubscribe = async () => {
    if (!selectedDetail?.fullType || !subscribeName) return
    try {
      const nextResult = await stopReceiveTopic({
        topic_name: subscribeName,
        topic_type: selectedDetail.fullType,
        full_type: selectedDetail.fullType,
      })
      setResult(nextResult)
      await refresh({ notifyWorkbench: false })
    } catch (error) {
      setResult({ success: false, error: error.message })
    }
  }

  const resetHistories = async (scope = 'all') => {
    const topicType = scope === 'selected' ? selectedDetail?.fullType : ''
    await Promise.all([
      resetReceiveTopicHistory('', topicType),
      resetTopicPublishHistory(topicType ? { topic_type: topicType } : {}),
    ])
    setResult({ success: true, message: topicType ? '선택 Topic 타입 이력을 초기화했습니다.' : 'Topic 전체 Publish/Subscribe 이력을 초기화했습니다.' })
    await refresh({ notifyWorkbench: false })
  }

  const reset = () => {
    setMessageValues({})
    publishNameSourceRef.current = 'empty'
    setPublishName('')
    setPublishHz(10)
    setSubscribeName('')
    setResult(null)
  }

  return {
    activeContinuousPublish,
    publishQosMode: publishQos.qosMode,
    publishQosProfile: publishQos.qosProfile,
    setPublishQosMode: publishQos.setQosMode,
    setPublishQosProfile: publishQos.setQosProfile,
    setSubscribeQosMode: subscribeQos.setQosMode,
    setSubscribeQosProfile: subscribeQos.setQosProfile,
    subscribeQosMode: subscribeQos.qosMode,
    subscribeQosProfile: subscribeQos.qosProfile,
    executing,
    messageValues,
    publish,
    publishGraphTopics,
    publishHz,
    publishName,
    publishWarning,
    reset,
    resetHistories,
    result,
    selectPublishGraphTopic,
    setMessageValues,
    setPublishHz,
    setSubscribeName,
    startContinuous,
    startSubscribe,
    stopContinuous,
    stopSubscribe,
    subscribeName,
    updatePublishName,
  }
}
