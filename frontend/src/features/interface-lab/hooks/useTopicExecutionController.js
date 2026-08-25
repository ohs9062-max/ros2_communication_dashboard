import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchCallableMessages,
  fetchTopicPublishHistory,
  publishTopicMessage,
  resetTopicPublishHistory,
} from '../../../api/interfaceExecution.js'
import {
  defaultRequestValues,
  messageKey,
  normalizeNumericValues,
} from '../model/interfaceUploadModel.js'
import {
  graphPublishTopicCandidates,
  topicNameTypeWarning,
} from '../../../utils/interfaceTopics.js'
import { useContinuousTopicExecution } from './useContinuousTopicExecution.js'
import { useExecutionQos } from './useExecutionQos.js'

export function useTopicExecutionController({
  availableTopics,
  onStateChanged,
  setFeedback,
}) {
  const [messages, setMessages] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [importableOnly, setImportableOnly] = useState(false)
  const [publishName, setPublishName] = useState('')
  const [publishDomainId, setPublishDomainId] = useState(null)
  const publishNameSourceRef = useRef('empty')
  const [messageValues, setMessageValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const qos = useExecutionQos()

  const visibleMessages = useMemo(
    () => importableOnly
      ? messages.filter((message) => message.import_available)
      : messages,
    [importableOnly, messages],
  )
  const selected = useMemo(
    () => messages.find((message) => messageKey(message) === selectedKey),
    [messages, selectedKey],
  )
  const publishGraphTopics = useMemo(
    () => graphPublishTopicCandidates(availableTopics, selected?.message_type),
    [availableTopics, selected?.message_type],
  )
  const publishWarning = topicNameTypeWarning(
    availableTopics,
    publishName,
    selected?.message_type,
  )
  const visibleHistory = history.filter((event) =>
    (!publishName || event.topic_name === publishName)
    && (publishDomainId === null || event.domain_id === publishDomainId)
    && (!selected?.message_type || event.topic_type === selected.message_type),
  )

  const select = useCallback((key) => {
    const message = messages.find((item) => messageKey(item) === key)
    setSelectedKey(key)
    setMessageValues(defaultRequestValues(message?.message_schema ?? []))
    setResult(null)
  }, [messages])

  useEffect(() => {
    if (!visibleMessages.length) {
      if (selectedKey) select('')
      return
    }
    if (visibleMessages.some((message) => messageKey(message) === selectedKey)) return
    select(messageKey(visibleMessages[0]))
  }, [select, selectedKey, visibleMessages])

  useEffect(() => {
    if (!selected?.message_type) return
    const currentName = publishName.trim()
    const currentIsCandidate = publishGraphTopics.some((topic) =>
      topic.name === currentName && topic.domain_id === publishDomainId)
    const source = publishNameSourceRef.current

    if (source === 'user') {
      if (currentName) return
    } else if (source === 'graph') {
      if (currentIsCandidate) return
      publishNameSourceRef.current = 'empty'
      setPublishName('')
      setPublishDomainId(null)
      return
    } else if (source === 'auto' && publishGraphTopics.length !== 1) {
      publishNameSourceRef.current = 'empty'
      setPublishName('')
      setPublishDomainId(null)
      return
    }

    if (publishGraphTopics.length === 1) {
      const nextName = publishGraphTopics[0].name
      if (source === 'auto' && currentName === nextName) return
      publishNameSourceRef.current = 'auto'
      setPublishName(nextName)
      setPublishDomainId(publishGraphTopics[0].domain_id ?? null)
    }
  }, [publishDomainId, publishGraphTopics, publishName, selected?.message_type])

  const continuous = useContinuousTopicExecution({
    messageValues,
    onStateChanged,
    publishDomainId,
    publishName,
    selected,
    setBusy,
    setResult,
    qosSelection: qos.qosSelection,
  })
  const { setContinuousPublishes } = continuous

  const replace = useCallback((nextMessages, nextHistory = null, nextContinuous = null) => {
    setMessages(nextMessages)
    if (nextHistory !== null) setHistory(nextHistory)
    if (nextContinuous !== null) setContinuousPublishes(nextContinuous)
  }, [setContinuousPublishes])

  const load = useCallback(async () => {
    const [messagesPayload, historyPayload] = await Promise.all([
      fetchCallableMessages(),
      fetchTopicPublishHistory({ limit: 100 }),
    ])
    const nextMessages = messagesPayload.data ?? []
    replace(nextMessages, historyPayload.data ?? [])
    return nextMessages
  }, [replace])

  const changePublishName = useCallback((value, sourceKind) => {
    if (sourceKind === 'graph') {
      const topic = publishGraphTopics.find((item) => item.resource_key === value)
      publishNameSourceRef.current = topic ? 'graph' : 'empty'
      setPublishName(topic?.name ?? '')
      setPublishDomainId(topic?.domain_id ?? null)
      return
    }
    publishNameSourceRef.current = value ? sourceKind : 'empty'
    setPublishName(value)
    setPublishDomainId(null)
  }, [publishGraphTopics])

  const publish = useCallback(async () => {
    if (!publishName.trim()) {
      setResult({ success: false, error: 'Enter a Topic name to publish.' })
      return
    }
    if (!selected?.message_type) {
      setResult({ success: false, error: 'Select a Message full_type to publish.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const payload = await publishTopicMessage({
        topic_name: publishName.trim(),
        topic_type: selected.message_type,
        full_type: selected.message_type,
        message: normalizeNumericValues(messageValues, selected.message_schema),
        qos: qos.qosSelection,
        domain_id: publishDomainId,
      })
      setResult(payload)
      const historyPayload = await fetchTopicPublishHistory({ limit: 100 })
      setHistory(historyPayload.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [messageValues, onStateChanged, publishDomainId, publishName, qos.qosSelection, selected])

  const resetHistory = useCallback(async () => {
    try {
      const payload = await resetTopicPublishHistory({
        topic_name: publishName,
        topic_type: selected?.message_type,
        domain_id: publishDomainId,
      })
      const historyPayload = await fetchTopicPublishHistory({ limit: 100 })
      setHistory(historyPayload.data ?? [])
      setFeedback({
        tone: 'success',
        text: `Topic Publish 이력 ${payload.data?.cleared ?? 0}개를 리셋했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }, [publishDomainId, publishName, selected?.message_type, setFeedback])

  return {
    ...continuous,
    ...qos,
    busy,
    changePublishName,
    history,
    importableOnly,
    load,
    messageValues,
    messages,
    publish,
    publishGraphTopics,
    publishDomainId,
    publishName,
    publishWarning,
    replace,
    resetHistory,
    result,
    select,
    selected,
    selectedKey,
    setHistory,
    setImportableOnly,
    setMessageValues,
    setResult,
    visibleHistory,
    visibleMessages,
  }
}
