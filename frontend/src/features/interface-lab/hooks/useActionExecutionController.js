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
  executionCandidateForTarget,
  executionResourceOptions,
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
    const current = visibleActions.find((action) => actionKey(action) === selectedKey)
    if (current) return
    if (visibleActions.length === 1) select(actionKey(visibleActions[0]))
    else if (selectedKey) select('')
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
    let selectedTarget = null
    const nextActions = executionResourceOptions(
      actionsPayload.data ?? [], 'action_name', 'action_type',
    ).map((item) => {
      const candidate = target
        ? executionCandidateForTarget(item, target, 'action_name', 'action_type')
        : null
      if (!candidate) return item
      selectedTarget = { ...item, ...candidate, resource_candidates: item.resource_candidates }
      return selectedTarget
    })
    replace(nextActions, historyPayload.data ?? [])
    if (selectedTarget) {
      setSelectedKey(actionKey(selectedTarget))
      onSelectionChange?.(actionKey(selectedTarget))
      setGoalValues(defaultRequestValues(selectedTarget.goal_schema ?? []))
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
