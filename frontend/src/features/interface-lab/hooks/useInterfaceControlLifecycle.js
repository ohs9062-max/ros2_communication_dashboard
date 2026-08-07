import { useEffect, useRef } from 'react'

import {
  fetchInterfaceApplyStatus,
  fetchInterfacePackages,
  fetchInterfaceRegistry,
} from '../../../api/interfaceManagement.js'

export function useInterfaceControlLifecycle({
  loadActionExecution,
  loadApplyStatus,
  loadServiceExecution,
  loadTopicExecution,
  refreshSignal,
  reloadPhase,
  runImportCheck,
  setApplyStatus,
  setBuildLogTail,
  setFeedback,
  setPackages,
  setRegistry,
  setReloadPhase,
  showCallableActions,
  showCallableServices,
  showCallableTopics,
  showPackages,
  showRegistry,
  websocketStatus,
}) {
  const lastRefreshSignalRef = useRef(refreshSignal)

  useEffect(() => {
    loadApplyStatus().catch((error) => {
      setFeedback({ tone: 'warning', text: `적용 상태를 읽을 수 없습니다: ${error.message}` })
    })
  }, [loadApplyStatus, setFeedback])

  useEffect(() => {
    if (lastRefreshSignalRef.current === refreshSignal) return
    lastRefreshSignalRef.current = refreshSignal

    const refreshOpenState = async () => {
      try {
        const statusPayload = await fetchInterfaceApplyStatus()
        setApplyStatus(statusPayload.data)
        setBuildLogTail(statusPayload.data?.log_tail ?? '')
        if (showRegistry) {
          const registryPayload = await fetchInterfaceRegistry()
          setRegistry(registryPayload.data)
        }
        if (showPackages) {
          const packagesPayload = await fetchInterfacePackages()
          setPackages(packagesPayload.data ?? [])
        }
        await Promise.all([
          showCallableTopics ? loadTopicExecution() : null,
          showCallableServices ? loadServiceExecution() : null,
          showCallableActions ? loadActionExecution() : null,
        ])
      } catch (error) {
        setFeedback({ tone: 'warning', text: `상태 새로고침에 실패했습니다: ${error.message}` })
      }
    }

    refreshOpenState()
  }, [
    loadActionExecution,
    loadServiceExecution,
    loadTopicExecution,
    refreshSignal,
    setApplyStatus,
    setBuildLogTail,
    setFeedback,
    setPackages,
    setRegistry,
    showCallableActions,
    showCallableServices,
    showCallableTopics,
    showPackages,
    showRegistry,
  ])

  useEffect(() => {
    if (reloadPhase === 'scheduled' && websocketStatus !== 'connected') {
      setReloadPhase('reconnecting')
    }
    if (reloadPhase === 'reconnecting' && websocketStatus === 'connected') {
      runImportCheck()
    }
  }, [reloadPhase, runImportCheck, setReloadPhase, websocketStatus])

  useEffect(() => {
    if (reloadPhase !== 'scheduled') return undefined
    const timer = window.setTimeout(() => runImportCheck(), 5000)
    return () => window.clearTimeout(timer)
  }, [reloadPhase, runImportCheck])
}
