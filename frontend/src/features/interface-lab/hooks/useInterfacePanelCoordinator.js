import { useCallback, useEffect, useMemo, useState } from 'react'

const EXECUTION_MODES = ['topic', 'service', 'action']

export function useInterfacePanelCoordinator({
  loadActionExecution,
  loadPackages,
  loadReceiveState,
  loadRegistry,
  loadServiceExecution,
  loadTopicExecution,
  onExpandedChange,
  receiveMode,
  setBusy,
  setFeedback,
  setReceiveMode,
  setShowBuildLog,
  setShowManualInput,
  setShowPackages,
  setShowReceivePanel,
  setShowRegistry,
  showManualInput,
  showPackages,
  showReceivePanel,
  showRegistry,
}) {
  const [executionMode, setExecutionMode] = useState(null)
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false)

  const showCallableTopics = executionMode === 'topic'
  const showCallableServices = executionMode === 'service'
  const showCallableActions = executionMode === 'action'

  const closeExecutionPanels = useCallback(() => setExecutionMode(null), [])
  const closeReceivePanel = useCallback(() => setShowReceivePanel(false), [setShowReceivePanel])

  const hideManagementPanels = useCallback(() => {
    setShowRegistry(false)
    setShowPackages(false)
    setShowBuildLog(false)
  }, [setShowBuildLog, setShowPackages, setShowRegistry])

  const loadExecutionPanel = useCallback(async (mode, keepOpen = false) => {
    const loaders = {
      action: loadActionExecution,
      service: loadServiceExecution,
      topic: loadTopicExecution,
    }
    const loader = loaders[mode]
    if (!loader) return false

    setBusy(true)
    try {
      await loader()
      setExecutionMode(mode)
      if (!keepOpen) hideManagementPanels()
      return true
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
      return false
    } finally {
      setBusy(false)
    }
  }, [
    hideManagementPanels,
    loadActionExecution,
    loadServiceExecution,
    loadTopicExecution,
    setBusy,
    setFeedback,
  ])

  const openExecutionPanel = useCallback(async (mode) => {
    setShowReceivePanel(true)
    setReceiveMode(mode)
    await loadExecutionPanel(mode)
    await loadReceiveState({ silent: true })
  }, [loadExecutionPanel, loadReceiveState, setReceiveMode, setShowReceivePanel])

  const openReceivePanel = useCallback(() => {
    setShowReceivePanel(true)
    closeExecutionPanels()
    setShowManualInput(false)
    hideManagementPanels()
    loadReceiveState()
  }, [
    closeExecutionPanels,
    hideManagementPanels,
    loadReceiveState,
    setShowManualInput,
    setShowReceivePanel,
  ])

  const openTopicPanel = useCallback(() => openExecutionPanel('topic'), [openExecutionPanel])
  const openServicePanel = useCallback(() => openExecutionPanel('service'), [openExecutionPanel])
  const openActionPanel = useCallback(() => openExecutionPanel('action'), [openExecutionPanel])

  const selectReceiveMode = useCallback(async (mode) => {
    setReceiveMode(mode)
    if (!EXECUTION_MODES.includes(mode)) {
      closeExecutionPanels()
      return
    }
    await loadExecutionPanel(mode)
    await loadReceiveState({ silent: true })
  }, [closeExecutionPanels, loadExecutionPanel, loadReceiveState, setReceiveMode])

  const openPackages = useCallback(async () => {
    if (await loadPackages()) closeExecutionPanels()
  }, [closeExecutionPanels, loadPackages])

  const openRegistry = useCallback(async () => {
    if (await loadRegistry()) closeExecutionPanels()
  }, [closeExecutionPanels, loadRegistry])

  const toggleBuildLog = useCallback(() => {
    setShowBuildLog((value) => !value)
    setShowRegistry(false)
    setShowPackages(false)
    closeExecutionPanels()
  }, [closeExecutionPanels, setShowBuildLog, setShowPackages, setShowRegistry])

  const expandedActive = useMemo(() => workspaceExpanded && (
    showManualInput
    || showRegistry
    || showPackages
    || (
      showReceivePanel
      && (
        executionMode === receiveMode
        || (executionMode === null && receiveMode !== 'mock')
      )
    )
  ), [
    executionMode,
    receiveMode,
    showManualInput,
    showPackages,
    showReceivePanel,
    showRegistry,
    workspaceExpanded,
  ])

  useEffect(() => {
    onExpandedChange?.(expandedActive)
    return () => onExpandedChange?.(false)
  }, [expandedActive, onExpandedChange])

  return {
    closeExecutionPanels,
    closeReceivePanel,
    collapseWorkspace: () => setWorkspaceExpanded(false),
    expandedActive,
    loadExecutionPanel,
    openActionPanel,
    openPackages,
    openReceivePanel,
    openRegistry,
    openServicePanel,
    openTopicPanel,
    selectReceiveMode,
    showCallableActions,
    showCallableServices,
    showCallableTopics,
    toggleBuildLog,
    toggleWorkspaceExpanded: () => setWorkspaceExpanded((value) => !value),
  }
}
