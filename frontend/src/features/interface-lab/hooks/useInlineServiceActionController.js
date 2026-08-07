import { useEffect, useState } from 'react'

import {
  callRegisteredService,
  cancelActionGoal,
  sendActionGoal,
} from '../../../api/interfaceExecution.js'
import { defaultValues, normalizeNumericValues } from '../model/schemaValues.js'

export function useInlineServiceActionController({ refresh, selectedDetail }) {
  const [requestValues, setRequestValues] = useState({})
  const [goalValues, setGoalValues] = useState({})
  const [timeoutSec, setTimeoutSec] = useState(2)
  const [goalTimeoutSec, setGoalTimeoutSec] = useState(10)
  const [cancelingGoal, setCancelingGoal] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    setResult(null)
    if (selectedDetail?.kind === 'service' || selectedDetail?.kind === 'callable_service') {
      setRequestValues(defaultValues(selectedDetail.schema ?? []))
    } else if (selectedDetail?.kind === 'action' || selectedDetail?.kind === 'callable_action') {
      setGoalValues(defaultValues(selectedDetail.schema ?? []))
    }
  }, [selectedDetail?.kind, selectedDetail?.schema, selectedDetail?.stableKey])

  const executeService = async () => {
    const target = selectedDetail?.connectedServices?.find((service) => service.callable)
      ?? (selectedDetail?.kind === 'callable_service' ? selectedDetail.status : null)
    if (!target?.service_name || !target?.service_type) {
      setResult({ success: false, error: '호출 가능한 Service가 없습니다.' })
      return
    }
    setExecuting(true)
    setResult(null)
    try {
      const nextResult = await callRegisteredService({
        service_name: target.service_name,
        service_type: target.service_type,
        request: normalizeNumericValues(requestValues, selectedDetail.schema),
        timeout_sec: timeoutSec,
      })
      setResult(nextResult)
      await refresh({ notifyWorkbench: false })
    } catch (error) {
      setResult({ success: false, error: error.message, sent_to_server: false })
    } finally {
      setExecuting(false)
    }
  }

  const executeAction = async () => {
    const target = selectedDetail?.connectedActions?.find((action) => action.callable)
      ?? (selectedDetail?.kind === 'callable_action' ? selectedDetail.status : null)
    if (!target?.action_name || !target?.action_type) {
      setResult({ success: false, accepted: false, error: '실행 가능한 Action이 없습니다.' })
      return
    }
    setExecuting(true)
    setResult(null)
    try {
      const nextResult = await sendActionGoal({
        action_name: target.action_name,
        action_type: target.action_type,
        full_type: target.full_type ?? target.selected_import_type ?? target.action_type,
        goal: normalizeNumericValues(goalValues, selectedDetail.schema),
        timeout_sec: goalTimeoutSec,
      })
      setResult(nextResult)
      await refresh({ notifyWorkbench: false })
    } catch (error) {
      setResult({ success: false, accepted: false, error: error.message, sent_to_server: false })
    } finally {
      setExecuting(false)
    }
  }

  const cancelAction = async () => {
    const target = selectedDetail?.connectedActions?.find((action) => action.callable)
      ?? (selectedDetail?.kind === 'callable_action' ? selectedDetail.status : null)
    if (!target?.action_name || !target?.action_type) return
    setCancelingGoal(true)
    try {
      const nextResult = await cancelActionGoal({
        action_name: target.action_name,
        action_type: target.action_type,
        timeout_sec: goalTimeoutSec,
      })
      setResult(nextResult)
      await refresh({ notifyWorkbench: false })
    } catch (error) {
      setResult({ success: false, error: error.message, error_type: 'cancel_failed' })
    } finally {
      setCancelingGoal(false)
    }
  }

  const reset = () => {
    setRequestValues({})
    setGoalValues({})
    setTimeoutSec(2)
    setGoalTimeoutSec(10)
    setResult(null)
  }

  return {
    cancelAction,
    cancelingGoal,
    executeAction,
    executeService,
    executing,
    goalTimeoutSec,
    goalValues,
    requestValues,
    reset,
    result,
    setGoalTimeoutSec,
    setGoalValues,
    setRequestValues,
    setTimeoutSec,
    timeoutSec,
  }
}
