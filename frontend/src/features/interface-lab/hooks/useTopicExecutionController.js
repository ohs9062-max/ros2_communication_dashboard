import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchCallableMessages,
  fetchContinuousTopicPublishes,
  fetchTopicPublishHistory,
  publishTopicMessage,
  resetTopicPublishHistory,
  startContinuousTopicPublish,
  stopContinuousTopicPublish,
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

export function useTopicExecutionController({
  availableTopics,
  onStateChanged,
  setFeedback,
}) {
  const [messages, setMessages] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [importableOnly, setImportableOnly] = useState(false)
  const [publishName, setPublishName] = useState('')
  const [publishHz, setPublishHz] = useState(10)
  const publishNameSourceRef = useRef('empty')
  const [messageValues, setMessageValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [continuousPublishes, setContinuousPublishes] = useState([])

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
  const activeContinuousPublish = continuousPublishes.find((item) =>
    item.active
    && item.topic_name === publishName.trim()
    && item.topic_type === selected?.message_type)
  const activeContinuousPublishKey = activeContinuousPublish
    ? `${activeContinuousPublish.topic_name}\u0000${activeContinuousPublish.topic_type}`
    : ''
  const visibleHistory = history.filter((event) =>
    (!publishName || event.topic_name === publishName)
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
  }, [publishGraphTopics, publishName, selected?.message_type])

  useEffect(() => {
    if (!activeContinuousPublishKey) return undefined
    const timer = window.setInterval(async () => {
      try {
        const payload = await fetchContinuousTopicPublishes()
        setContinuousPublishes(payload.data ?? [])
      } catch {
        // Explicit actions and the regular page refresh surface transport errors.
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeContinuousPublishKey])

  const replace = useCallback((nextMessages, nextHistory = null, nextContinuous = null) => {
    setMessages(nextMessages)
    if (nextHistory !== null) setHistory(nextHistory)
    if (nextContinuous !== null) setContinuousPublishes(nextContinuous)
  }, [])

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
    publishNameSourceRef.current = value ? sourceKind : 'empty'
    setPublishName(value)
  }, [])

  const publish = useCallback(async () => {
    if (!publishName.trim()) {
      setResult({ success: false, error: 'Publish할 Topic 이름을 입력하세요.' })
      return
    }
    if (!selected?.message_type) {
      setResult({ success: false, error: 'Publish할 Message full_type을 선택하세요.' })
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
  }, [messageValues, onStateChanged, publishName, selected])

  const startContinuous = useCallback(async () => {
    if (!publishName.trim() || !selected?.message_type) {
      setResult({ success: false, error: 'Publish Topic 이름과 Message full_type을 선택하세요.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const payload = await startContinuousTopicPublish({
        topic_name: publishName.trim(),
        topic_type: selected.message_type,
        full_type: selected.message_type,
        message: normalizeNumericValues(messageValues, selected.message_schema),
        hz: Number(publishHz),
      })
      setResult(payload)
      const state = await fetchContinuousTopicPublishes()
      setContinuousPublishes(state.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [messageValues, onStateChanged, publishHz, publishName, selected])

  const stopContinuous = useCallback(async () => {
    if (!publishName.trim() || !selected?.message_type) return
    setBusy(true)
    try {
      const payload = await stopContinuousTopicPublish({
        topic_name: publishName.trim(),
        topic_type: selected.message_type,
      })
      setResult(payload)
      const state = await fetchContinuousTopicPublishes()
      setContinuousPublishes(state.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [onStateChanged, publishName, selected?.message_type])

  const resetHistory = useCallback(async () => {
    try {
      const payload = await resetTopicPublishHistory({
        topic_name: publishName,
        topic_type: selected?.message_type,
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
  }, [publishName, selected?.message_type, setFeedback])

  return {
    activeContinuousPublish,
    busy,
    changePublishName,
    continuousPublishes,
    history,
    importableOnly,
    load,
    messageValues,
    messages,
    publish,
    publishGraphTopics,
    publishHz,
    publishName,
    publishWarning,
    replace,
    resetHistory,
    result,
    select,
    selected,
    selectedKey,
    setContinuousPublishes,
    setHistory,
    setImportableOnly,
    setMessageValues,
    setPublishHz,
    setResult,
    startContinuous,
    stopContinuous,
    visibleHistory,
    visibleMessages,
  }
}
