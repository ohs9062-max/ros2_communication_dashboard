import { useCallback, useMemo, useRef, useState } from 'react'

import { fetchDomains } from '../../../api/monitoring.js'
import {
  fetchCallableMessages,
  fetchTopicPublishHistory,
  publishTopicMessage,
  resetTopicPublishHistory,
} from '../../../api/interfaceExecution.js'
import {
  defaultRequestValues,
  domainIdFromResource,
  messageKey,
  normalizeNumericValues,
} from '../model/interfaceUploadModel.js'
import {
  configuredServerDomainIds,
} from '../model/serverSelection.js'
import {
  graphPublishTopicCandidates,
  topicNameTypeWarning,
} from '../../../utils/interfaceTopics.js'
import { useContinuousTopicExecution } from './useContinuousTopicExecution.js'
import { useExecutionQos } from './useExecutionQos.js'

export function useTopicExecutionController({
  availableTopics,
  onGraphTopicSelectionChange,
  onMessageSelectionChange,
  onStateChanged,
  setFeedback,
}) {
  const [messages, setMessages] = useState([])
  const [domainIds, setDomainIds] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [importableOnly, setImportableOnly] = useState(false)
  const [publishName, setPublishName] = useState('')
  const [publishDomainId, setPublishDomainId] = useState(null)
  const [publishResourceKey, setPublishResourceKey] = useState('')
  const publishNameSourceRef = useRef('empty')
  const [messageValues, setMessageValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const qos = useExecutionQos()

  const visibleMessages = useMemo(() => {
    const list = importableOnly
      ? messages.filter((message) => message.import_available)
      : messages
    const map = new Map()
    for (const item of list) {
      const type = item.message_type ?? item.full_type
      if (type && !map.has(type)) {
        map.set(type, item)
      }
    }
    return [...map.values()].sort((a, b) =>
      String(a.message_type ?? a.full_type).localeCompare(String(b.message_type ?? b.full_type))
    )
  }, [importableOnly, messages])

  const selected = useMemo(
    () => messages.find((message) => messageKey(message) === selectedKey)
      ?? messages.find((message) => (message.message_type ?? message.full_type) === selectedKey),
    [messages, selectedKey],
  )

  const publishGraphTopics = useMemo(() => {
    const candidates = graphPublishTopicCandidates(availableTopics, selected?.message_type)
    return publishDomainId != null
      ? candidates.filter((topic) => topic.domain_id === publishDomainId)
      : candidates
  }, [availableTopics, publishDomainId, selected?.message_type])

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

  const suggestedName = useCallback((message, domainId, topics = availableTopics) => {
    const msgType = message?.message_type ?? message?.full_type
    const graphResource = topics.find((item) => (
      item.domain_id === domainId
      && (item.type === msgType || item.types?.includes(msgType))
      && String(item.name ?? '').trim()
    ))
    if (graphResource) return String(graphResource.name).trim()
    const typeName = String(msgType ?? '').split('/').filter(Boolean).at(-1)
    return typeName ? `/${typeName}` : ''
  }, [availableTopics])

  const applySelection = useCallback((message, domainId, topics) => {
    setSelectedKey(message ? messageKey(message) : '')
    onMessageSelectionChange?.(message ? messageKey(message) : '')
    setMessageValues(defaultRequestValues(message?.message_schema ?? []))
    setPublishName(message ? suggestedName(message, domainId, topics) : '')
    setResult(null)
  }, [onMessageSelectionChange, suggestedName])

  const select = useCallback((key) => {
    const message = visibleMessages.find((item) => messageKey(item) === key)
      ?? visibleMessages.find((item) => (item.message_type ?? item.full_type) === key)
    applySelection(message, publishDomainId, availableTopics)
  }, [applySelection, availableTopics, publishDomainId, visibleMessages])

  const selectDomain = useCallback((value) => {
    const domainId = value === '' ? null : Number(value)
    setPublishDomainId(domainId)
    if (selected) {
      setPublishName(suggestedName(selected, domainId, availableTopics))
    }
  }, [availableTopics, selected, suggestedName])

  const continuous = useContinuousTopicExecution({
    messageValues,
    onStateChanged,
    publishDomainId,
    publishName,
    publishResourceKey,
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

  const load = useCallback(async ({ target = null } = {}) => {
    const [messagesPayload, domainsPayload, historyPayload] = await Promise.all([
      fetchCallableMessages(),
      fetchDomains(),
      fetchTopicPublishHistory({ limit: 100 }),
    ])
    const nextMessages = messagesPayload.data ?? []
    const nextDomains = configuredServerDomainIds(domainsPayload)
    replace(nextMessages, historyPayload.data ?? [])
    setDomainIds(nextDomains)

    const targetDomainId = target?.domainId ?? (nextDomains.includes(publishDomainId) ? publishDomainId : nextDomains[0] ?? null)
    setPublishDomainId(targetDomainId)

    if (target) {
      const message = nextMessages.find((item) => (item.message_type ?? item.full_type) === target.fullType)
      if (message) {
        setSelectedKey(messageKey(message))
        onMessageSelectionChange?.(messageKey(message))
        setMessageValues(defaultRequestValues(message.message_schema ?? []))
      }
      if (target.name) {
        publishNameSourceRef.current = 'graph'
        setPublishName(target.name)
        setPublishResourceKey(target.resourceKey ?? '')
      }
    } else if (!selectedKey && nextMessages.length > 0) {
      applySelection(nextMessages[0], targetDomainId, availableTopics)
    }
    return nextMessages
  }, [applySelection, availableTopics, onMessageSelectionChange, publishDomainId, replace, selectedKey])

  const changePublishName = useCallback((value, sourceKind) => {
    if (sourceKind === 'graph') {
      const topic = publishGraphTopics.find((item) => item.resource_key === value)
      publishNameSourceRef.current = topic ? 'graph' : 'empty'
      setPublishName(topic?.name ?? '')
      setPublishDomainId(topic?.domain_id ?? null)
      setPublishResourceKey(topic?.resource_key ?? '')
      if (topic) onGraphTopicSelectionChange?.(topic)
      return
    }
    publishNameSourceRef.current = value ? sourceKind : 'empty'
    setPublishName(value)
    setPublishDomainId(null)
    setPublishResourceKey('')
  }, [onGraphTopicSelectionChange, publishGraphTopics])

  const selectGraphTopicFromReceive = useCallback((topic) => {
    if (!topic?.resource_key) return
    publishNameSourceRef.current = 'graph'
    setPublishName(topic.name ?? '')
    setPublishDomainId(topic.domain_id ?? null)
    setPublishResourceKey(topic.resource_key)
  }, [])

  const publish = useCallback(async () => {
    if (!publishName.trim()) {
      setResult({ success: false, error: 'Enter a Topic name to publish.' })
      return
    }
    if (!selected?.message_type) {
      setResult({ success: false, error: 'Select a Message full_type to publish.' })
      return
    }
    const domainId = domainIdFromResource({
      domain_id: publishDomainId,
      resource_key: publishResourceKey,
    })
    if (domainId === null) {
      setResult({ success: false, error: 'Select a Graph Topic with a monitored Domain ID to publish.' })
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
        domain_id: domainId,
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
  }, [messageValues, onStateChanged, publishDomainId, publishName, publishResourceKey, qos.qosSelection, selected])

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
    domainIds,
    history,
    importableOnly,
    load,
    messageValues,
    messages,
    publish,
    publishGraphTopics,
    publishDomainId,
    publishResourceKey,
    publishName,
    publishWarning,
    replace,
    resetHistory,
    result,
    select,
    selectDomain,
    selectGraphTopicFromReceive,
    selected,
    selectedDomainId: publishDomainId,
    selectedKey,
    setHistory,
    setImportableOnly,
    setMessageValues,
    setResult,
    visibleHistory,
    visibleMessages,
  }
}
