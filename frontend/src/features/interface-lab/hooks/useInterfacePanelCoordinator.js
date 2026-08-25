import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  closeExecutionPanel,
  isWorkspaceExpanded,
  runExecutionPanelLoad,
} from '../model/panelCoordinatorModel.js'

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
  const executionRequestRef = useRef(0)

  const showCallableTopics = executionMode === 'topic'
  const showCallableServices = executionMode === 'service'
  const showCallableActions = executionMode === 'action'

  const closeExecutionPanels = useCallback(() => {
    closeExecutionPanel({ requestRef: executionRequestRef, setBusy, setExecutionMode })
  }, [setBusy])
  const closeReceivePanel = useCallback(() => setShowReceivePanel(false), [setShowReceivePanel])

  const hideManagementPanels = useCallback(() => {
    setShowRegistry(false)
    setShowPackages(false)
    setShowBuildLog(false)
  }, [setShowBuildLog, setShowPackages, setShowRegistry])

  const loadExecutionPanel = useCallback(async (mode, keepOpen = false, target = null) => {
    const requestId = executionRequestRef.current + 1
    executionRequestRef.current = requestId
    return runExecutionPanelLoad({
      hideManagementPanels,
      isCurrent: () => executionRequestRef.current === requestId,
      keepOpen,
      loaders: {
        action: loadActionExecution,
        service: loadServiceExecution,
        topic: loadTopicExecution,
      },
      mode,
      target,
      setBusy,
      setExecutionMode,
      setFeedback,
    })
  }, [
    hideManagementPanels,
    loadActionExecution,
    loadServiceExecution,
    loadTopicExecution,
    setBusy,
    setFeedback,
  ])

  const openExecutionPanel = useCallback(async (mode, target = null) => {
    setShowReceivePanel(true)
    setReceiveMode(mode)
    if (await loadExecutionPanel(mode, false, target)) await loadReceiveState({ silent: true, mode })
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

  const openTopicPanel = useCallback((target = null) => openExecutionPanel('topic', target), [openExecutionPanel])
  const openServicePanel = useCallback((target = null) => openExecutionPanel('service', target), [openExecutionPanel])
  const openActionPanel = useCallback((target = null) => openExecutionPanel('action', target), [openExecutionPanel])

  const selectReceiveMode = useCallback(async (mode) => {
    setReceiveMode(mode)
    await loadReceiveState({ silent: true, mode })
  }, [loadReceiveState, setReceiveMode])

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

  const expandedActive = useMemo(() => isWorkspaceExpanded({
    executionMode,
    receiveMode,
    showManualInput,
    showPackages,
    showReceivePanel,
    showRegistry,
    workspaceExpanded,
  }), [
    executionMode, receiveMode, showManualInput, showPackages,
    showReceivePanel, showRegistry, workspaceExpanded,
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
