import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchContinuousTopicPublishes,
  startContinuousTopicPublish,
  stopContinuousTopicPublish,
} from '../../../api/interfaceExecution.js'
import { domainIdFromResource, normalizeNumericValues } from '../model/interfaceUploadModel.js'
import { runSingleFlight } from '../model/singleFlight.js'

export function useContinuousTopicExecution({
  messageValues,
  onStateChanged,
  publishDomainId,
  publishResourceKey,
  publishName,
  qosSelection,
  selected,
  setBusy,
  setResult,
}) {
  const [publishHz, setPublishHz] = useState(10)
  const [continuousPublishes, setContinuousPublishes] = useState([])
  const pollInFlightRef = useRef(false)
  const activeContinuousPublish = continuousPublishes.find((item) =>
    item.active
    && item.topic_name === publishName.trim()
    && item.topic_type === selected?.message_type
    && item.domain_id === publishDomainId)
  const activeKey = activeContinuousPublish
    ? `${activeContinuousPublish.domain_id}\u0000${activeContinuousPublish.topic_name}\u0000${activeContinuousPublish.topic_type}`
    : ''

  useEffect(() => {
    if (!activeKey) return undefined
    const timer = window.setInterval(async () => {
      await runSingleFlight(pollInFlightRef, async () => {
        try {
          const payload = await fetchContinuousTopicPublishes()
          setContinuousPublishes(payload.data ?? [])
        } catch {
          // Explicit actions and the regular page refresh surface transport errors.
        }
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeKey])

  const startContinuous = useCallback(async () => {
    if (!publishName.trim() || !selected?.message_type) {
      setResult({ success: false, error: 'Select a publish Topic name and Message full_type.' })
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
      const payload = await startContinuousTopicPublish({
        topic_name: publishName.trim(),
        topic_type: selected.message_type,
        full_type: selected.message_type,
        message: normalizeNumericValues(messageValues, selected.message_schema),
        hz: Number(publishHz),
        qos: qosSelection,
        domain_id: domainId,
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
  }, [messageValues, onStateChanged, publishDomainId, publishHz, publishName, publishResourceKey, qosSelection, selected, setBusy, setResult])

  const stopContinuous = useCallback(async () => {
    if (!publishName.trim() || !selected?.message_type) return
    const domainId = domainIdFromResource({
      domain_id: publishDomainId,
      resource_key: publishResourceKey,
    })
    if (domainId === null) {
      setResult({ success: false, error: 'Select a Graph Topic with a monitored Domain ID to stop publishing.' })
      return
    }
    setBusy(true)
    try {
      const payload = await stopContinuousTopicPublish({
        topic_name: publishName.trim(),
        topic_type: selected.message_type,
        domain_id: domainId,
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
  }, [onStateChanged, publishDomainId, publishName, publishResourceKey, selected?.message_type, setBusy, setResult])

  return {
    activeContinuousPublish,
    continuousPublishes,
    publishHz,
    setContinuousPublishes,
    setPublishHz,
    startContinuous,
    stopContinuous,
  }
}
