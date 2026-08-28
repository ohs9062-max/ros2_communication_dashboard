import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchDomains } from '../../../api/monitoring.js'
import {
  fetchActionServerHistory,
  fetchActionServers,
  fetchActionServerTypes,
  fetchCallableActions,
  resetActionServerHistory,
  startActionServer,
  stopActionServer,
} from '../../../api/interfaceExecution.js'
import { actionKey, defaultRequestValues, normalizeNumericValues } from '../model/interfaceUploadModel.js'
import {
  configuredServerDomainIds,
  serverTypesForDomain,
  suggestServerResourceName,
} from '../model/serverSelection.js'

export function useActionServerController({ onStateChanged, setFeedback }) {
  const [actions, setActions] = useState([])
  const [graphActions, setGraphActions] = useState([])
  const [domainIds, setDomainIds] = useState([])
  const [selectedDomainId, setSelectedDomainId] = useState(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [actionName, setActionName] = useState('')
  const [feedbackValues, setFeedbackValues] = useState({})
  const [resultValues, setResultValues] = useState({})
  const [acceptGoals, setAcceptGoals] = useState(true)
  const [acceptCancels, setAcceptCancels] = useState(true)
  const [resultDelaySec, setResultDelaySec] = useState(1)
  const [servers, setServers] = useState([])
  const [goals, setGoals] = useState([])
  const [busy, setBusy] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [result, setResult] = useState(null)

  const visibleActions = useMemo(
    () => serverTypesForDomain(actions, selectedDomainId, 'action_type'),
    [actions, selectedDomainId],
  )
  const selected = useMemo(
    () => visibleActions.find((item) => actionKey(item) === selectedKey),
    [selectedKey, visibleActions],
  )
  const activeServer = useMemo(() => servers.find((item) => (
    item.action_name === actionName
    && item.action_type === selected?.action_type
    && item.domain_id === selectedDomainId
  )), [actionName, selected, selectedDomainId, servers])
  const visibleGoals = useMemo(() => goals.filter((item) => (
    (!actionName || item.action_name === actionName)
    && (!selected?.action_type || item.action_type === selected.action_type)
    && (selectedDomainId == null || item.domain_id === selectedDomainId)
  )), [actionName, goals, selected, selectedDomainId])

  const suggestedName = useCallback((action, domainId, runtimeServers = servers, resources = graphActions) => {
    const running = runtimeServers.find((item) => (
      item.domain_id === domainId && item.action_type === action?.action_type
    ))
    return running?.action_name ?? suggestServerResourceName({
      domainId,
      nameField: 'action_name',
      resources,
      resourceType: action?.action_type,
      typeField: 'action_type',
    })
  }, [graphActions, servers])

  const applySelection = useCallback((action, domainId, runtimeServers, resources) => {
    setSelectedKey(action ? actionKey(action) : '')
    setFeedbackValues(defaultRequestValues(action?.feedback_schema ?? []))
    setResultValues(defaultRequestValues(action?.result_schema ?? []))
    setActionName(action ? suggestedName(action, domainId, runtimeServers, resources) : '')
    setResult(null)
  }, [suggestedName])

  const select = useCallback((key) => {
    const action = visibleActions.find((item) => actionKey(item) === key)
    applySelection(action, selectedDomainId)
  }, [applySelection, selectedDomainId, visibleActions])

  const selectDomain = useCallback((value) => {
    const domainId = value === '' ? null : Number(value)
    const available = serverTypesForDomain(actions, domainId, 'action_type')
    const running = servers.find((item) => item.domain_id === domainId)
    const action = available.find((item) => item.action_type === running?.action_type)
      ?? available.find((item) => item.action_type === selected?.action_type)
      ?? available[0]
    setSelectedDomainId(domainId)
    applySelection(action, domainId)
  }, [actions, applySelection, selected, servers])

  const refreshRuntime = useCallback(async () => {
    const [status, history] = await Promise.all([fetchActionServers(), fetchActionServerHistory()])
    setServers(status.data ?? [])
    setGoals(history.data ?? [])
    return { servers: status.data ?? [], history: history.data ?? [] }
  }, [])

  const load = useCallback(async ({ target = null } = {}) => {
    const [types, domains, graph, runtime] = await Promise.all([
      fetchActionServerTypes(), fetchDomains(), fetchCallableActions(), refreshRuntime(),
    ])
    const next = types.data ?? []
    const nextDomains = configuredServerDomainIds(domains)
    const resources = graph.data ?? []
    setActions(next)
    setDomainIds(nextDomains)
    setGraphActions(resources)
    const running = !target ? runtime.servers[0] : null
    const preferredDomain = target?.domainId ?? running?.domain_id
    const domainId = nextDomains.includes(preferredDomain) ? preferredDomain : nextDomains[0] ?? null
    const available = serverTypesForDomain(next, domainId, 'action_type')
    const action = available.find((item) => item.action_type === target?.fullType)
      ?? available.find((item) => item.action_type === running?.action_type)
      ?? available[0]
    setSelectedDomainId(domainId)
    applySelection(action, domainId, runtime.servers, resources)
    if (target?.name) setActionName(target.name)
    else if (running?.action_name) setActionName(running.action_name)
    return next
  }, [applySelection, refreshRuntime])

  useEffect(() => {
    if (!activeServer) return undefined
    const timer = window.setInterval(() => refreshRuntime().catch(() => {}), 1000)
    return () => window.clearInterval(timer)
  }, [activeServer, refreshRuntime])

  const start = useCallback(async () => {
    if (!selected?.server_creatable || selectedDomainId == null || !actionName.trim()) {
      setResult({ success: false, error: 'Domain, import 가능한 Action 타입과 이름을 선택하세요.' })
      return
    }
    setBusy(true)
    try {
      const response = await startActionServer({
        action_name: actionName.trim(), action_type: selected.action_type,
        domain_id: selectedDomainId,
        feedback: normalizeNumericValues(feedbackValues, selected.feedback_schema),
        result: normalizeNumericValues(resultValues, selected.result_schema),
        accept_goals: acceptGoals, accept_cancels: acceptCancels,
        result_delay_sec: resultDelaySec,
      })
      setResult(response)
      await refreshRuntime()
      setFeedback?.({ tone: 'success', text: `Action 서버 [${actionName.trim()}]를 개설했습니다.` })
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [acceptCancels, acceptGoals, actionName, feedbackValues, onStateChanged, refreshRuntime, resultDelaySec, resultValues, selected, selectedDomainId, setFeedback])

  const stop = useCallback(async () => {
    if (!activeServer) return
    setBusy(true)
    try {
      const response = await stopActionServer({
        action_name: activeServer.action_name, action_type: activeServer.action_type,
        domain_id: activeServer.domain_id,
      })
      setResult(response)
      await refreshRuntime()
      setFeedback?.({ tone: 'info', text: `Action 서버 [${activeServer.action_name}]를 종료했습니다.` })
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
      const history = await fetchActionServerHistory()
      setGoals(history.data ?? [])
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setHistoryBusy(false)
    }
  }, [])

  const resetHistory = useCallback(async () => {
    if (!selected || selectedDomainId == null || !actionName.trim()) return
    setHistoryBusy(true)
    try {
      await resetActionServerHistory({
        action_name: actionName.trim(),
        action_type: selected.action_type,
        domain_id: selectedDomainId,
      })
      const history = await fetchActionServerHistory()
      setGoals(history.data ?? [])
      setFeedback?.({ tone: 'info', text: 'Action Server 이력을 초기화했습니다.' })
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setHistoryBusy(false)
    }
  }, [actionName, selected, selectedDomainId, setFeedback])

  return {
    acceptCancels, acceptGoals, actionName, actions, active: Boolean(activeServer), activeServer,
    busy, domainIds, feedbackValues, goals: visibleGoals, historyBusy, load,
    onFieldChange: (kind, name, value) => (kind === 'feedback'
      ? setFeedbackValues((current) => ({ ...current, [name]: value }))
      : setResultValues((current) => ({ ...current, [name]: value }))),
    refreshHistory, resetHistory, result, resultDelaySec, resultValues, select,
    selectDomain, selected, selectedDomainId, selectedKey, serverDomainId: selectedDomainId,
    setAcceptCancels, setAcceptGoals, setActionName, setResultDelaySec, start, stop, visibleActions,
  }
}
