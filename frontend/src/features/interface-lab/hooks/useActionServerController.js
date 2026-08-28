import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchActionServerHistory,
  fetchActionServers,
  fetchActionServerTypes,
  startActionServer,
  stopActionServer,
} from '../../../api/interfaceExecution.js'
import { actionKey, defaultRequestValues } from '../model/interfaceUploadModel.js'

export function useActionServerController({ onStateChanged, setFeedback }) {
  const [actions, setActions] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [importableOnly, setImportableOnly] = useState(true)
  const [actionName, setActionName] = useState('')
  const [feedbackValues, setFeedbackValues] = useState({})
  const [resultValues, setResultValues] = useState({})
  const [acceptGoals, setAcceptGoals] = useState(true)
  const [acceptCancels, setAcceptCancels] = useState(true)
  const [resultDelaySec, setResultDelaySec] = useState(1)
  const [servers, setServers] = useState([])
  const [goals, setGoals] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const visibleActions = useMemo(
    () => importableOnly ? actions.filter((item) => item.import_available) : actions,
    [actions, importableOnly],
  )
  const selected = useMemo(
    () => actions.find((item) => actionKey(item) === selectedKey),
    [actions, selectedKey],
  )
  const activeServer = useMemo(() => servers.find((item) => (
    item.action_name === actionName
    && item.action_type === selected?.action_type
    && item.domain_id === selected?.domain_id
  )), [actionName, selected, servers])
  const visibleGoals = useMemo(() => goals.filter((item) => (
    (!actionName || item.action_name === actionName)
    && (!selected?.action_type || item.action_type === selected.action_type)
    && (selected?.domain_id == null || item.domain_id === selected.domain_id)
  )), [actionName, goals, selected])

  const select = useCallback((key) => {
    const action = actions.find((item) => actionKey(item) === key)
    setSelectedKey(key)
    setFeedbackValues(defaultRequestValues(action?.feedback_schema ?? []))
    setResultValues(defaultRequestValues(action?.result_schema ?? []))
    setResult(null)
  }, [actions])

  const refreshRuntime = useCallback(async () => {
    const [status, history] = await Promise.all([fetchActionServers(), fetchActionServerHistory()])
    setServers(status.data ?? [])
    setGoals(history.data ?? [])
    return { servers: status.data ?? [], history: history.data ?? [] }
  }, [])

  const load = useCallback(async ({ target = null } = {}) => {
    const [types, runtime] = await Promise.all([fetchActionServerTypes(), refreshRuntime()])
    const next = types.data ?? []
    setActions(next)
    const running = !target ? runtime.servers[0] : null
    const match = target
      ? next.find((item) => item.action_type === target.fullType && item.domain_id === target.domainId)
      : running ? next.find((item) => item.action_type === running.action_type && item.domain_id === running.domain_id)
      : next.find((item) => item.import_available)
    if (match) {
      setSelectedKey(actionKey(match))
      setFeedbackValues(defaultRequestValues(match.feedback_schema ?? []))
      setResultValues(defaultRequestValues(match.result_schema ?? []))
    }
    if (target?.name) setActionName(target.name)
    else if (running?.action_name) setActionName(running.action_name)
    return next
  }, [refreshRuntime])

  useEffect(() => {
    if (!activeServer) return undefined
    const timer = window.setInterval(() => refreshRuntime().catch(() => {}), 1000)
    return () => window.clearInterval(timer)
  }, [activeServer, refreshRuntime])

  const start = useCallback(async () => {
    if (!selected?.server_creatable || !actionName.trim()) {
      setResult({ success: false, error: 'import 가능한 Action 타입과 이름을 선택하세요.' })
      return
    }
    setBusy(true)
    try {
      const response = await startActionServer({
        action_name: actionName.trim(), action_type: selected.action_type,
        domain_id: selected.domain_id, feedback: feedbackValues, result: resultValues,
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
  }, [acceptCancels, acceptGoals, actionName, feedbackValues, onStateChanged, refreshRuntime, resultDelaySec, resultValues, selected, setFeedback])

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
      setFeedback?.({ tone: 'info', text: `Action 서버 [${activeServer.action_name}]를 중지했습니다.` })
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [activeServer, onStateChanged, refreshRuntime, setFeedback])

  return {
    acceptCancels, acceptGoals, actionName, actions, active: Boolean(activeServer), busy,
    feedbackValues, goals: visibleGoals, importableOnly, load,
    onFieldChange: (kind, name, value) => (kind === 'feedback'
      ? setFeedbackValues((current) => ({ ...current, [name]: value }))
      : setResultValues((current) => ({ ...current, [name]: value }))),
    result, resultDelaySec, resultValues, select, selected, selectedKey,
    serverDomainId: selected?.domain_id ?? null, setAcceptCancels, setAcceptGoals,
    setActionName, setImportableOnly, setResultDelaySec, start, stop, visibleActions,
  }
}
