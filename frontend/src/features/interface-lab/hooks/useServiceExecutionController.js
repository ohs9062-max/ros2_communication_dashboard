import { useCallback, useMemo, useState } from 'react'

import { fetchDomains } from '../../../api/monitoring.js'
import {
  callRegisteredService,
  fetchCallableServices,
  fetchServiceCallHistory,
} from '../../../api/interfaceExecution.js'
import {
  defaultRequestValues,
  domainIdFromResource,
  executionResourceForSelection,
  executionResourceForTarget,
  normalizeNumericValues,
  refreshServiceCallState,
  serviceKey,
} from '../model/interfaceUploadModel.js'
import {
  configuredServerDomainIds,
  suggestServerResourceName,
} from '../model/serverSelection.js'
import { useServiceExecutionQos } from './useExecutionQos.js'

export function useServiceExecutionController({
  onDomainChange,
  onSelectionChange,
  onStateChanged,
}) {
  const [services, setServices] = useState([])
  const [domainIds, setDomainIds] = useState([])
  const [selectedDomainId, setSelectedDomainId] = useState(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [requestValues, setRequestValues] = useState({})
  const [timeoutSec, setTimeoutSec] = useState(2)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [importableOnly, setImportableOnly] = useState(false)
  const qos = useServiceExecutionQos()

  const visibleServices = useMemo(() => {
    const domainServices = services.filter((item) => (
      (selectedDomainId == null || item.domain_id === selectedDomainId)
      && (!importableOnly || item.import_available)
      && Boolean(item.service_type)
    ))
    const map = new Map()
    for (const item of domainServices) {
      if (!map.has(item.service_type) || item.callable) {
        map.set(item.service_type, item)
      }
    }
    return [...map.values()].sort((a, b) => String(a.service_type).localeCompare(String(b.service_type)))
  }, [importableOnly, selectedDomainId, services])

  const selected = useMemo(() => {
    const candidate = visibleServices.find((item) => item.service_type === selectedKey)
    if (!candidate) return null
    const graphMatch = services.find((item) => (
      item.domain_id === selectedDomainId
      && item.service_type === candidate.service_type
      && item.service_name === serviceName
    ))
    return graphMatch ?? {
      ...candidate,
      service_name: serviceName,
      domain_id: selectedDomainId,
      resource_key: `${selectedDomainId}:${serviceName}`,
    }
  }, [selectedDomainId, selectedKey, serviceName, services, visibleServices])

  const graphCandidates = useMemo(() => {
    if (!selected?.service_type || selectedDomainId == null) return []
    return services.filter((item) => (
      item.domain_id === selectedDomainId
      && item.service_type === selected.service_type
      && String(item.service_name ?? '').trim()
    ))
  }, [selected?.service_type, selectedDomainId, services])

  const suggestedName = useCallback((service, domainId, allServices = services) => {
    return suggestServerResourceName({
      domainId,
      nameField: 'service_name',
      resources: allServices,
      resourceType: service?.service_type,
      typeField: 'service_type',
    })
  }, [services])

  const applySelection = useCallback((service, domainId, allServices) => {
    setSelectedKey(service?.service_type ?? '')
    setRequestValues(defaultRequestValues(service?.request_schema ?? []))
    const exactName = service?.domain_id === domainId && String(service?.service_name ?? '').trim()
      ? String(service.service_name).trim()
      : ''
    const nextName = service ? exactName || suggestedName(service, domainId, allServices) : ''
    setServiceName(nextName)
    setResult(null)
    const exactResource = (allServices ?? services).find((item) => (
      item.domain_id === domainId
      && item.service_type === service?.service_type
      && item.service_name === nextName
    ))
    onSelectionChange?.(exactResource ? serviceKey(exactResource) : '')
  }, [onSelectionChange, services, suggestedName])

  const select = useCallback((key) => {
    const service = executionResourceForSelection(
      services, key, selectedDomainId, serviceKey, 'service_type',
    )
    const exact = service && serviceKey(service) === key ? service : null
    const domainId = exact?.domain_id ?? selectedDomainId
    if (exact) setSelectedDomainId(domainId)
    applySelection(service, domainId)
  }, [applySelection, selectedDomainId, services])

  const changeServiceName = useCallback((value) => {
    setServiceName(value)
    const exact = graphCandidates.find((item) => item.service_name === value)
    onSelectionChange?.(exact ? serviceKey(exact) : '')
  }, [graphCandidates, onSelectionChange])

  const selectDomain = useCallback((value, notify = true) => {
    const domainId = value === '' ? null : Number(value)
    const domainServices = services.filter((item) => (
      item.domain_id === domainId
      && (!importableOnly || item.import_available)
      && Boolean(item.service_type)
    ))
    const service = domainServices.find((item) => item.service_type === selected?.service_type)
      ?? domainServices[0]
    setSelectedDomainId(domainId)
    applySelection(service, domainId)
    if (notify) onDomainChange?.(domainId)
  }, [applySelection, importableOnly, onDomainChange, selected?.service_type, services])

  const replace = useCallback((nextServices, nextHistory = null) => {
    setServices(nextServices)
    if (nextHistory !== null) setHistory(nextHistory)
  }, [])

  const load = useCallback(async ({ target = null } = {}) => {
    const [servicesPayload, domainsPayload, historyPayload] = await Promise.all([
      fetchCallableServices(),
      fetchDomains(),
      fetchServiceCallHistory(),
    ])
    const nextServices = servicesPayload.data ?? []
    const nextDomains = configuredServerDomainIds(domainsPayload)
    replace(nextServices, historyPayload.data ?? [])
    setDomainIds(nextDomains)

    const targetDomainId = target?.domainId ?? (nextDomains.includes(selectedDomainId) ? selectedDomainId : nextDomains[0] ?? null)
    setSelectedDomainId(targetDomainId)

    const available = nextServices.filter((item) => (
      item.domain_id === targetDomainId
      && item.import_available === true
      && Boolean(item.service_type)
    ))
    const initialService = (target
      ? executionResourceForTarget(available, target, 'service_name', 'service_type')
      : null) ?? available[0]

    applySelection(initialService, targetDomainId, nextServices)
    if (target?.name) {
      setServiceName(target.name)
      const exact = executionResourceForTarget(
        available, target, 'service_name', 'service_type',
      )
      onSelectionChange?.(exact ? serviceKey(exact) : '')
    }
    onDomainChange?.(targetDomainId)
    return nextServices
  }, [applySelection, onDomainChange, onSelectionChange, replace, selectedDomainId])

  const execute = useCallback(async () => {
    if (!selected || !selected.callable) {
      setResult({ success: false, error: 'No callable Service is available.' })
      return
    }
    if (!serviceName.trim()) {
      setResult({ success: false, error: 'Service name is required.' })
      return
    }
    const domainId = selectedDomainId ?? domainIdFromResource(selected)
    if (domainId === null) {
      setResult({ success: false, error: 'The selected Service has no monitored Domain ID.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const payload = await callRegisteredService({
        service_name: serviceName.trim(),
        service_type: selected.service_type,
        request: normalizeNumericValues(requestValues, selected.request_schema),
        timeout_sec: timeoutSec,
        qos: qos.qosSelection,
        domain_id: domainId,
      })
      await refreshServiceCallState({ fetchHistory: fetchServiceCallHistory, setHistory, onStateChanged })
      setResult(payload)
    } catch (error) {
      setResult({ success: false, error: error.message })
      await refreshServiceCallState({ fetchHistory: fetchServiceCallHistory, setHistory, onStateChanged })
    } finally {
      setBusy(false)
    }
  }, [onStateChanged, qos.qosSelection, requestValues, selected, selectedDomainId, serviceName, timeoutSec])

  return {
    ...qos,
    busy,
    calls: history,
    domainIds,
    execute,
    graphCandidates,
    history,
    importableOnly,
    load,
    onFieldChange: (name, value) => setRequestValues((current) => ({ ...current, [name]: value })),
    replace,
    requestValues,
    result,
    select,
    selectDomain,
    selected,
    selectedDomainId,
    selectedKey,
    serviceName,
    services,
    setImportableOnly,
    setRequestValues,
    setServiceName: changeServiceName,
    setTimeoutSec,
    timeoutSec,
    visibleServices,
  }
}
