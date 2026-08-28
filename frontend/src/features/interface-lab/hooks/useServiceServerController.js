import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchDomains } from '../../../api/monitoring.js'
import {
  fetchCallableServices,
  fetchServiceServerHistory,
  fetchServiceServers,
  fetchServiceServerTypes,
  resetServiceServerHistory,
  startServiceServer,
  stopServiceServer,
} from '../../../api/interfaceExecution.js'
import { defaultRequestValues, normalizeNumericValues, serviceKey } from '../model/interfaceUploadModel.js'
import {
  configuredServerDomainIds,
  serverTypesForDomain,
  suggestServerResourceName,
} from '../model/serverSelection.js'

export function useServiceServerController({ onStateChanged, setFeedback }) {
  const [services, setServices] = useState([])
  const [graphServices, setGraphServices] = useState([])
  const [domainIds, setDomainIds] = useState([])
  const [selectedDomainId, setSelectedDomainId] = useState(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [serverName, setServerName] = useState('')
  const [responseValues, setResponseValues] = useState({})
  const [servers, setServers] = useState([])
  const [calls, setCalls] = useState([])
  const [busy, setBusy] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [result, setResult] = useState(null)

  const visibleServices = useMemo(
    () => serverTypesForDomain(services, selectedDomainId, 'service_type'),
    [selectedDomainId, services],
  )
  const selected = useMemo(
    () => visibleServices.find((item) => serviceKey(item) === selectedKey),
    [selectedKey, visibleServices],
  )
  const activeServer = useMemo(() => servers.find((item) => (
    item.service_name === serverName
    && item.service_type === selected?.service_type
    && item.domain_id === selectedDomainId
  )), [selected, selectedDomainId, serverName, servers])
  const visibleCalls = useMemo(() => calls.filter((item) => (
    (!serverName || item.service_name === serverName)
    && (!selected?.service_type || item.service_type === selected.service_type)
    && (selectedDomainId == null || item.domain_id === selectedDomainId)
  )), [calls, selected, selectedDomainId, serverName])

  const suggestedName = useCallback((service, domainId, runtimeServers = servers, resources = graphServices) => {
    const running = runtimeServers.find((item) => (
      item.domain_id === domainId && item.service_type === service?.service_type
    ))
    return running?.service_name ?? suggestServerResourceName({
      domainId,
      nameField: 'service_name',
      resources,
      resourceType: service?.service_type,
      typeField: 'service_type',
    })
  }, [graphServices, servers])

  const applySelection = useCallback((service, domainId, runtimeServers, resources) => {
    setSelectedKey(service ? serviceKey(service) : '')
    setResponseValues(defaultRequestValues(service?.response_schema ?? []))
    setServerName(service ? suggestedName(service, domainId, runtimeServers, resources) : '')
    setResult(null)
  }, [suggestedName])

  const select = useCallback((key) => {
    const service = visibleServices.find((item) => serviceKey(item) === key)
    applySelection(service, selectedDomainId)
  }, [applySelection, selectedDomainId, visibleServices])

  const selectDomain = useCallback((value) => {
    const domainId = value === '' ? null : Number(value)
    const available = serverTypesForDomain(services, domainId, 'service_type')
    const running = servers.find((item) => item.domain_id === domainId)
    const service = available.find((item) => item.service_type === running?.service_type)
      ?? available.find((item) => item.service_type === selected?.service_type)
      ?? available[0]
    setSelectedDomainId(domainId)
    applySelection(service, domainId)
  }, [applySelection, selected, servers, services])

  const refreshRuntime = useCallback(async () => {
    const [status, history] = await Promise.all([fetchServiceServers(), fetchServiceServerHistory()])
    setServers(status.data ?? [])
    setCalls(history.data ?? [])
    return { servers: status.data ?? [], history: history.data ?? [] }
  }, [])

  const load = useCallback(async ({ target = null } = {}) => {
    const [types, domains, graph, runtime] = await Promise.all([
      fetchServiceServerTypes(), fetchDomains(), fetchCallableServices(), refreshRuntime(),
    ])
    const next = types.data ?? []
    const nextDomains = configuredServerDomainIds(domains)
    const resources = graph.data ?? []
    setServices(next)
    setDomainIds(nextDomains)
    setGraphServices(resources)
    const running = !target ? runtime.servers[0] : null
    const preferredDomain = target?.domainId ?? running?.domain_id
    const domainId = nextDomains.includes(preferredDomain) ? preferredDomain : nextDomains[0] ?? null
    const available = serverTypesForDomain(next, domainId, 'service_type')
    const service = available.find((item) => item.service_type === target?.fullType)
      ?? available.find((item) => item.service_type === running?.service_type)
      ?? available[0]
    setSelectedDomainId(domainId)
    applySelection(service, domainId, runtime.servers, resources)
    if (target?.name) setServerName(target.name)
    else if (running?.service_name) setServerName(running.service_name)
    return next
  }, [applySelection, refreshRuntime])

  useEffect(() => {
    if (!activeServer) return undefined
    const timer = window.setInterval(() => refreshRuntime().catch(() => {}), 1000)
    return () => window.clearInterval(timer)
  }, [activeServer, refreshRuntime])

  const start = useCallback(async () => {
    if (!selected?.server_creatable || selectedDomainId == null || !serverName.trim()) {
      setResult({ success: false, error: 'Domain, import 가능한 Service 타입과 이름을 선택하세요.' })
      return
    }
    setBusy(true)
    try {
      const response = await startServiceServer({
        service_name: serverName.trim(), service_type: selected.service_type,
        domain_id: selectedDomainId,
        response: normalizeNumericValues(responseValues, selected.response_schema),
      })
      setResult(response)
      await refreshRuntime()
      setFeedback?.({ tone: 'success', text: `Service 서버 [${serverName.trim()}]를 개설했습니다.` })
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [onStateChanged, refreshRuntime, responseValues, selected, selectedDomainId, serverName, setFeedback])

  const stop = useCallback(async () => {
    if (!activeServer) return
    setBusy(true)
    try {
      const response = await stopServiceServer({
        service_name: activeServer.service_name, service_type: activeServer.service_type,
        domain_id: activeServer.domain_id,
      })
      setResult(response)
      await refreshRuntime()
      setFeedback?.({ tone: 'info', text: `Service 서버 [${activeServer.service_name}]를 종료했습니다.` })
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [activeServer, onStateChanged, refreshRuntime, setFeedback])

  const refreshHistory = useCallback(async () => {
    setHistoryBusy(true)
    try {
      const history = await fetchServiceServerHistory()
      setCalls(history.data ?? [])
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setHistoryBusy(false)
    }
  }, [])

  const resetHistory = useCallback(async () => {
    if (!selected || selectedDomainId == null || !serverName.trim()) return
    setHistoryBusy(true)
    try {
      await resetServiceServerHistory({
        domain_id: selectedDomainId,
        service_name: serverName.trim(),
        service_type: selected.service_type,
      })
      const history = await fetchServiceServerHistory()
      setCalls(history.data ?? [])
      setFeedback?.({ tone: 'info', text: 'Service Server 이력을 초기화했습니다.' })
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setHistoryBusy(false)
    }
  }, [selected, selectedDomainId, serverName, setFeedback])

  return {
    active: Boolean(activeServer), activeServer, busy, calls: visibleCalls, domainIds,
    historyBusy, load,
    onFieldChange: (name, value) => setResponseValues((current) => ({ ...current, [name]: value })),
    refreshHistory, resetHistory, responseValues, result, select, selectDomain,
    selected, selectedDomainId, selectedKey, serverDomainId: selectedDomainId,
    serverName, services, setServerName, start, stop, visibleServices,
  }
}
