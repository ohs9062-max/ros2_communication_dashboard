import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchActionGoalHistory,
  fetchCallableActions,
  sendActionGoal,
} from '../../../api/interfaceExecution.js'
import {
  actionKey,
  defaultRequestValues,
  domainIdFromResource,
  normalizeNumericValues,
} from '../model/interfaceUploadModel.js'
import { useActionExecutionQos } from './useExecutionQos.js'

export function useActionExecutionController({
  onSelectionChange,
  onStateChanged,
}) {
  const [actions, setActions] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [goalValues, setGoalValues] = useState({})
  const [timeoutSec, setTimeoutSec] = useState(10)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [importableOnly, setImportableOnly] = useState(false)
  const qos = useActionExecutionQos()

  const visibleActions = useMemo(
    () => importableOnly
      ? actions.filter((action) => action.import_available)
      : actions,
    [actions, importableOnly],
  )
  const selected = useMemo(
    () => actions.find((action) => actionKey(action) === selectedKey),
    [actions, selectedKey],
  )

  const select = useCallback((key) => {
    const action = actions.find((item) => actionKey(item) === key)
    setSelectedKey(key)
    onSelectionChange?.(key)
    setGoalValues(defaultRequestValues(action?.goal_schema ?? []))
    setResult(null)
  }, [actions, onSelectionChange])

  useEffect(() => {
    if (!visibleActions.length) {
      if (selectedKey) select('')
      return
    }
    if (visibleActions.some((action) => actionKey(action) === selectedKey)) return
    select(actionKey(visibleActions[0]))
  }, [select, selectedKey, visibleActions])

  const replace = useCallback((nextActions, nextHistory = null) => {
    setActions(nextActions)
    if (nextHistory !== null) setHistory(nextHistory)
  }, [])

  const load = useCallback(async ({ target = null } = {}) => {
    const [actionsPayload, historyPayload] = await Promise.all([
      fetchCallableActions(),
      fetchActionGoalHistory(),
    ])
    const nextActions = actionsPayload.data ?? []
    replace(nextActions, historyPayload.data ?? [])
    if (target) {
      const action = nextActions.find((item) => matchesTarget(item, target))
      if (action) {
        setSelectedKey(actionKey(action))
        onSelectionChange?.(actionKey(action))
        setGoalValues(defaultRequestValues(action.goal_schema ?? []))
      }
    }
    return nextActions
  }, [onSelectionChange, replace])

  const execute = useCallback(async () => {
    if (!selected || !selected.callable) {
      setResult({ success: false, error: 'No executable Action is available.' })
      return
    }
    const domainId = domainIdFromResource(selected)
    if (domainId === null) {
      setResult({ success: false, accepted: false, error: 'The selected Action has no monitored Domain ID.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const payload = await sendActionGoal({
        action_name: selected.action_name,
        action_type: selected.action_type,
        full_type: selected.full_type ?? selected.selected_import_type ?? selected.action_type,
        goal: normalizeNumericValues(goalValues, selected.goal_schema),
        timeout_sec: timeoutSec,
        qos: qos.qosSelection,
        domain_id: domainId,
      })
      setResult(payload)
      const historyPayload = await fetchActionGoalHistory()
      setHistory(historyPayload.data ?? [])
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, accepted: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [goalValues, onStateChanged, qos.qosSelection, selected, timeoutSec])

  return {
    actions,
    ...qos,
    busy,
    execute,
    goalValues,
    history,
    importableOnly,
    load,
    replace,
    result,
    select,
    selected,
    selectedKey,
    setGoalValues,
    setHistory,
    setImportableOnly,
    setResult,
    setTimeoutSec,
    timeoutSec,
    visibleActions,
  }
}

function matchesTarget(action, target) {
  return (target.resourceKey && action.resource_key === target.resourceKey)
    || (action.domain_id === target.domainId
      && action.action_name === target.name
      && action.action_type === target.fullType)
}
