import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchServiceServerHistory,
  fetchServiceServers,
  fetchServiceServerTypes,
  startServiceServer,
  stopServiceServer,
} from '../../../api/interfaceExecution.js'
import { defaultRequestValues, serviceKey } from '../model/interfaceUploadModel.js'

export function useServiceServerController({ onStateChanged, setFeedback }) {
  const [services, setServices] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [importableOnly, setImportableOnly] = useState(true)
  const [serverName, setServerName] = useState('')
  const [responseValues, setResponseValues] = useState({})
  const [servers, setServers] = useState([])
  const [calls, setCalls] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const visibleServices = useMemo(
    () => importableOnly ? services.filter((item) => item.import_available) : services,
    [importableOnly, services],
  )
  const selected = useMemo(
    () => services.find((item) => serviceKey(item) === selectedKey),
    [services, selectedKey],
  )
  const activeServer = useMemo(() => servers.find((item) => (
    item.service_name === serverName
    && item.service_type === selected?.service_type
    && item.domain_id === selected?.domain_id
  )), [selected, serverName, servers])
  const visibleCalls = useMemo(() => calls.filter((item) => (
    (!serverName || item.service_name === serverName)
    && (!selected?.service_type || item.service_type === selected.service_type)
    && (selected?.domain_id == null || item.domain_id === selected.domain_id)
  )), [calls, selected, serverName])

  const select = useCallback((key) => {
    const service = services.find((item) => serviceKey(item) === key)
    setSelectedKey(key)
    setResponseValues(defaultRequestValues(service?.response_schema ?? []))
    setResult(null)
  }, [services])

  const refreshRuntime = useCallback(async () => {
    const [status, history] = await Promise.all([fetchServiceServers(), fetchServiceServerHistory()])
    setServers(status.data ?? [])
    setCalls(history.data ?? [])
    return { servers: status.data ?? [], history: history.data ?? [] }
  }, [])

  const load = useCallback(async ({ target = null } = {}) => {
    const [types, runtime] = await Promise.all([fetchServiceServerTypes(), refreshRuntime()])
    const next = types.data ?? []
    setServices(next)
    const running = !target ? runtime.servers[0] : null
    const match = target
      ? next.find((item) => item.service_type === target.fullType && item.domain_id === target.domainId)
      : running ? next.find((item) => item.service_type === running.service_type && item.domain_id === running.domain_id)
      : next.find((item) => item.import_available)
    if (match) {
      setSelectedKey(serviceKey(match))
      setResponseValues(defaultRequestValues(match.response_schema ?? []))
    }
    if (target?.name) setServerName(target.name)
    else if (running?.service_name) setServerName(running.service_name)
    return next
  }, [refreshRuntime])

  useEffect(() => {
    if (!activeServer) return undefined
    const timer = window.setInterval(() => refreshRuntime().catch(() => {}), 1000)
    return () => window.clearInterval(timer)
  }, [activeServer, refreshRuntime])

  const start = useCallback(async () => {
    if (!selected?.server_creatable || !serverName.trim()) {
      setResult({ success: false, error: 'import 가능한 Service 타입과 이름을 선택하세요.' })
      return
    }
    setBusy(true)
    try {
      const response = await startServiceServer({
        service_name: serverName.trim(), service_type: selected.service_type,
        domain_id: selected.domain_id, response: responseValues,
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
  }, [onStateChanged, refreshRuntime, responseValues, selected, serverName, setFeedback])

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
      setFeedback?.({ tone: 'info', text: `Service 서버 [${activeServer.service_name}]를 중지했습니다.` })
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [activeServer, onStateChanged, refreshRuntime, setFeedback])

  return {
    active: Boolean(activeServer), busy, calls: visibleCalls, importableOnly, load,
    onFieldChange: (name, value) => setResponseValues((current) => ({ ...current, [name]: value })),
    responseValues, result, select, selected, selectedKey,
    serverDomainId: selected?.domain_id ?? null, serverName, services,
    setImportableOnly, setServerName, start, stop, visibleServices,
  }
}
