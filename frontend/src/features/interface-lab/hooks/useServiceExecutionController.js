import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  callRegisteredService,
  fetchCallableServices,
  fetchServiceCallHistory,
} from '../../../api/interfaceExecution.js'
import {
  defaultRequestValues,
  normalizeNumericValues,
  serviceKey,
} from '../model/interfaceUploadModel.js'
import { useServiceExecutionQos } from './useExecutionQos.js'

export function useServiceExecutionController({
  onSelectionChange,
  onStateChanged,
}) {
  const [services, setServices] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [requestValues, setRequestValues] = useState({})
  const [timeoutSec, setTimeoutSec] = useState(2)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [importableOnly, setImportableOnly] = useState(false)
  const qos = useServiceExecutionQos()

  const visibleServices = useMemo(
    () => importableOnly
      ? services.filter((service) => service.import_available)
      : services,
    [importableOnly, services],
  )
  const selected = useMemo(
    () => services.find((service) => serviceKey(service) === selectedKey),
    [selectedKey, services],
  )

  const select = useCallback((key) => {
    const service = services.find((item) => serviceKey(item) === key)
    setSelectedKey(key)
    onSelectionChange?.(key)
    setRequestValues(defaultRequestValues(service?.request_schema ?? []))
    setResult(null)
  }, [onSelectionChange, services])

  useEffect(() => {
    if (!visibleServices.length) {
      if (selectedKey) select('')
      return
    }
    if (visibleServices.some((service) => serviceKey(service) === selectedKey)) return
    select(serviceKey(visibleServices[0]))
  }, [select, selectedKey, visibleServices])

  const replace = useCallback((nextServices, nextHistory = null) => {
    setServices(nextServices)
    if (nextHistory !== null) setHistory(nextHistory)
  }, [])

  const load = useCallback(async () => {
    const [servicesPayload, historyPayload] = await Promise.all([
      fetchCallableServices(),
      fetchServiceCallHistory(),
    ])
    const nextServices = servicesPayload.data ?? []
    replace(nextServices, historyPayload.data ?? [])
    return nextServices
  }, [replace])

  const execute = useCallback(async () => {
    if (!selected || !selected.callable) {
      setResult({ success: false, error: '호출 가능한 Service가 없습니다.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const payload = await callRegisteredService({
        service_name: selected.service_name,
        service_type: selected.service_type,
        request: normalizeNumericValues(requestValues, selected.request_schema),
        timeout_sec: timeoutSec,
        qos: qos.qosSelection,
      })
      setResult(payload)
      const historyPayload = await fetchServiceCallHistory()
      setHistory(historyPayload.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [onStateChanged, qos.qosSelection, requestValues, selected, timeoutSec])

  return {
    busy,
    ...qos,
    execute,
    history,
    importableOnly,
    load,
    replace,
    requestValues,
    result,
    select,
    selected,
    selectedKey,
    services,
    setHistory,
    setImportableOnly,
    setRequestValues,
    setResult,
    setTimeoutSec,
    timeoutSec,
    visibleServices,
  }
}
