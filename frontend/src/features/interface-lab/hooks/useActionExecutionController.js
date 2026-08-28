import { useCallback, useMemo, useState } from 'react'

import { fetchDomains } from '../../../api/monitoring.js'
import {
  fetchActionGoalHistory,
  fetchCallableActions,
  sendActionGoal,
} from '../../../api/interfaceExecution.js'
import {
  actionKey,
  actionGoalPayload,
  defaultRequestValues,
  domainIdFromResource,
  executionResourceForSelection,
  executionResourceForTarget,
  normalizeNumericValues,
} from '../model/interfaceUploadModel.js'
import {
  configuredServerDomainIds,
  suggestServerResourceName,
} from '../model/serverSelection.js'
import { useActionExecutionQos } from './useExecutionQos.js'

export function useActionExecutionController({
  onDomainChange,
  onSelectionChange,
  onStateChanged,
}) {
  const [actions, setActions] = useState([])
  const [domainIds, setDomainIds] = useState([])
  const [selectedDomainId, setSelectedDomainId] = useState(null)
  const [selectedKey, setSelectedKey] = useState('')
  const [actionName, setActionName] = useState('')
  const [goalValues, setGoalValues] = useState({})
  const [timeoutSec, setTimeoutSec] = useState(10)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [importableOnly, setImportableOnly] = useState(false)
  const qos = useActionExecutionQos()

  const visibleActions = useMemo(() => {
    const domainActions = actions.filter((item) => (
      (selectedDomainId == null || item.domain_id === selectedDomainId)
      && (!importableOnly || item.import_available)
      && Boolean(item.action_type)
    ))
    const map = new Map()
    for (const item of domainActions) {
      if (!map.has(item.action_type) || item.callable) {
        map.set(item.action_type, item)
      }
    }
    return [...map.values()].sort((a, b) => String(a.action_type).localeCompare(String(b.action_type)))
  }, [actions, importableOnly, selectedDomainId])

  const selected = useMemo(() => {
    const candidate = visibleActions.find((item) => item.action_type === selectedKey)
    if (!candidate) return null
    const graphMatch = actions.find((item) => (
      item.domain_id === selectedDomainId
      && item.action_type === candidate.action_type
      && item.action_name === actionName
    ))
    return graphMatch ?? {
      ...candidate,
      action_name: actionName,
      domain_id: selectedDomainId,
      resource_key: `${selectedDomainId}:${actionName}`,
    }
  }, [actions, actionName, selectedDomainId, selectedKey, visibleActions])

  const graphCandidates = useMemo(() => {
    if (!selected?.action_type || selectedDomainId == null) return []
    return actions.filter((item) => (
      item.domain_id === selectedDomainId
      && item.action_type === selected.action_type
      && String(item.action_name ?? '').trim()
    ))
  }, [actions, selected?.action_type, selectedDomainId])

  const suggestedName = useCallback((action, domainId, allActions = actions) => {
    return suggestServerResourceName({
      domainId,
      nameField: 'action_name',
      resources: allActions,
      resourceType: action?.action_type,
      typeField: 'action_type',
    })
  }, [actions])

  const applySelection = useCallback((action, domainId, allActions) => {
    setSelectedKey(action?.action_type ?? '')
    setGoalValues(defaultRequestValues(action?.goal_schema ?? []))
    const exactName = action?.domain_id === domainId && String(action?.action_name ?? '').trim()
      ? String(action.action_name).trim()
      : ''
    const nextName = action ? exactName || suggestedName(action, domainId, allActions) : ''
    setActionName(nextName)
    setResult(null)
    const exactResource = (allActions ?? actions).find((item) => (
      item.domain_id === domainId
      && item.action_type === action?.action_type
      && item.action_name === nextName
    ))
    onSelectionChange?.(exactResource ? actionKey(exactResource) : '')
  }, [actions, onSelectionChange, suggestedName])

  const select = useCallback((key) => {
    const action = executionResourceForSelection(
      actions, key, selectedDomainId, actionKey, 'action_type',
    )
    const exact = action && actionKey(action) === key ? action : null
    const domainId = exact?.domain_id ?? selectedDomainId
    if (exact) setSelectedDomainId(domainId)
    applySelection(action, domainId)
  }, [actions, applySelection, selectedDomainId])

  const changeActionName = useCallback((value) => {
    setActionName(value)
    const exact = graphCandidates.find((item) => item.action_name === value)
    onSelectionChange?.(exact ? actionKey(exact) : '')
  }, [graphCandidates, onSelectionChange])

  const selectDomain = useCallback((value, notify = true) => {
    const domainId = value === '' ? null : Number(value)
    const domainActions = actions.filter((item) => (
      item.domain_id === domainId
      && (!importableOnly || item.import_available)
      && Boolean(item.action_type)
    ))
    const action = domainActions.find((item) => item.action_type === selected?.action_type)
      ?? domainActions[0]
    setSelectedDomainId(domainId)
    applySelection(action, domainId)
    if (notify) onDomainChange?.(domainId)
  }, [actions, applySelection, importableOnly, onDomainChange, selected?.action_type])

  const replace = useCallback((nextActions, nextHistory = null) => {
    setActions(nextActions)
    if (nextHistory !== null) setHistory(nextHistory)
  }, [])

  const load = useCallback(async ({ target = null } = {}) => {
    const [actionsPayload, domainsPayload, historyPayload] = await Promise.all([
      fetchCallableActions(),
      fetchDomains(),
      fetchActionGoalHistory(),
    ])
    const nextActions = actionsPayload.data ?? []
    const nextDomains = configuredServerDomainIds(domainsPayload)
    replace(nextActions, historyPayload.data ?? [])
    setDomainIds(nextDomains)

    const targetDomainId = target?.domainId ?? (nextDomains.includes(selectedDomainId) ? selectedDomainId : nextDomains[0] ?? null)
    setSelectedDomainId(targetDomainId)

    const available = nextActions.filter((item) => (
      item.domain_id === targetDomainId
      && item.import_available === true
      && Boolean(item.action_type)
    ))
    const initialAction = (target
      ? executionResourceForTarget(available, target, 'action_name', 'action_type')
      : null) ?? available[0]

    applySelection(initialAction, targetDomainId, nextActions)
    if (target?.name) {
      setActionName(target.name)
      const exact = executionResourceForTarget(
        available, target, 'action_name', 'action_type',
      )
      onSelectionChange?.(exact ? actionKey(exact) : '')
    }
    onDomainChange?.(targetDomainId)
    return nextActions
  }, [applySelection, onDomainChange, onSelectionChange, replace, selectedDomainId])

  const execute = useCallback(async () => {
    if (!selected || !selected.callable) {
      setResult({ success: false, error: 'No executable Action is available.' })
      return
    }
    if (!actionName.trim()) {
      setResult({ success: false, error: 'Action name is required.' })
      return
    }
    const domainId = selectedDomainId ?? domainIdFromResource(selected)
    if (domainId === null) {
      setResult({ success: false, accepted: false, error: 'The selected Action has no monitored Domain ID.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const payload = await sendActionGoal(actionGoalPayload({
        actionName: actionName.trim(),
        actionType: selected.action_type,
        domainId,
        goal: normalizeNumericValues(goalValues, selected.goal_schema),
        qosSelection: qos.qosSelection,
        timeoutSec,
      }))
      const nextHistory = await fetchActionGoalHistory()
      setHistory(nextHistory.data ?? [])
      setResult(payload)
      onStateChanged?.()
    } catch (error) {
      setResult({ success: false, accepted: false, error: error.message })
    } finally {
      setBusy(false)
    }
  }, [actionName, goalValues, onStateChanged, qos.qosSelection, selected, selectedDomainId, timeoutSec])

  return {
    ...qos,
    actionName,
    actions,
    busy,
    domainIds,
    execute,
    goals: history,
    goalValues,
    graphCandidates,
    history,
    importableOnly,
    load,
    onFieldChange: (name, value) => setGoalValues((current) => ({ ...current, [name]: value })),
    replace,
    result,
    select,
    selectDomain,
    selected,
    selectedDomainId,
    selectedKey,
    setActionName: changeActionName,
    setGoalValues,
    setImportableOnly,
    setTimeoutSec,
    timeoutSec,
    visibleActions,
  }
}
