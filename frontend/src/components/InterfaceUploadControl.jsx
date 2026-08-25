import { useEffect, useRef } from 'react'
import { InterfaceUploadView } from '../features/interface-lab/InterfaceUploadView.jsx'
import { useInterfaceManagementController } from '../features/interface-lab/hooks/useInterfaceManagementController.js'
import { useInterfaceControlLifecycle } from '../features/interface-lab/hooks/useInterfaceControlLifecycle.js'
import { useInterfaceExecutionSuite } from '../features/interface-lab/hooks/useInterfaceExecutionSuite.js'
import { useInterfacePanelCoordinator } from '../features/interface-lab/hooks/useInterfacePanelCoordinator.js'
import { useInterfaceQosLinks } from '../features/interface-lab/hooks/useInterfaceQosLinks.js'
import { useInterfaceRemovalActions } from '../features/interface-lab/hooks/useInterfaceRemovalActions.js'
import { interfaceExecutionViews } from '../features/interface-lab/model/interfaceExecutionViews.js'
import { interfaceManagementView } from '../features/interface-lab/model/managementViewProps.js'

export function InterfaceUploadControl({
  executionRequest,
  onStateChanged,
  onTopicWorkspaceExpandedChange,
  refreshSignal = 0,
  websocket,
}) {
  const inputRef = useRef(null)
  const packageFolderInputRef = useRef(null)
  const packageInputRef = useRef(null)
  const management = useInterfaceManagementController({
    onStateChanged,
  })
  const {
    action, availableTopics, receive, service, topic,
  } = useInterfaceExecutionSuite({
    onStateChanged,
    setBusy: management.setBusy,
    setFeedback: management.setFeedback,
  })
  const {
    busy: actionGoalBusy,
    load: loadActionExecution,
    qosControls: actionQosControls,
  } = action
  const {
    busy: serviceCallBusy,
    load: loadServiceExecution,
    requestQosMode: serviceRequestQosMode, requestQosProfile: serviceRequestQosProfile,
    responseQosMode: serviceResponseQosMode, responseQosProfile: serviceResponseQosProfile,
    setRequestQosMode: setServiceRequestQosMode,
    setRequestQosProfile: setServiceRequestQosProfile,
    setResponseQosMode: setServiceResponseQosMode,
    setResponseQosProfile: setServiceResponseQosProfile,
  } = service
  const {
    busy: topicPublishBusy,
    load: loadTopicExecution,
    qosMode: topicQosMode, qosProfile: topicQosProfile,
    setQosMode: setTopicQosMode, setQosProfile: setTopicQosProfile,
  } = topic
  const {
    actionQosControls: receiveActionQosControls,
    load: loadReceiveState,
    mode: receiveMode,
    open: showReceivePanel,
    qosMode: receiveTopicQosMode, qosProfile: receiveTopicQosProfile,
    setMode: setReceiveMode,
    setOpen: setShowReceivePanel,
    setQosMode: setReceiveTopicQosMode, setQosProfile: setReceiveTopicQosProfile,
  } = receive

  const {
    actionQosLink,
    linkedActionExecutionQosControls,
    linkedActionReceiveQosControls,
    serviceQosLink,
    topicQosLink,
  } = useInterfaceQosLinks({
    action: {
      executionControls: actionQosControls,
      receiveControls: receiveActionQosControls,
    },
    service: {
      executionMode: serviceRequestQosMode,
      executionProfile: serviceRequestQosProfile,
      receiveMode: serviceResponseQosMode,
      receiveProfile: serviceResponseQosProfile,
      setExecutionMode: setServiceRequestQosMode,
      setExecutionProfile: setServiceRequestQosProfile,
      setReceiveMode: setServiceResponseQosMode,
      setReceiveProfile: setServiceResponseQosProfile,
    },
    topic: {
      executionMode: topicQosMode,
      executionProfile: topicQosProfile,
      receiveMode: receiveTopicQosMode,
      receiveProfile: receiveTopicQosProfile,
      setExecutionMode: setTopicQosMode,
      setExecutionProfile: setTopicQosProfile,
      setReceiveMode: setReceiveTopicQosMode,
      setReceiveProfile: setReceiveTopicQosProfile,
    },
  })

  const {
    closeExecutionPanels,
    closeReceivePanel,
    collapseWorkspace,
    expandedActive: topicExpandedActive,
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
    toggleWorkspaceExpanded,
  } = useInterfacePanelCoordinator({
    loadActionExecution,
    loadPackages: management.loadPackages,
    loadReceiveState,
    loadRegistry: management.loadRegistry,
    loadServiceExecution,
    loadTopicExecution,
    onExpandedChange: onTopicWorkspaceExpandedChange,
    receiveMode,
    setBusy: management.setBusy,
    setFeedback: management.setFeedback,
    setReceiveMode,
    setShowBuildLog: management.setShowBuildLog,
    setShowManualInput: management.setShowManualInput,
    setShowPackages: management.setShowPackages,
    setShowReceivePanel,
    setShowRegistry: management.setShowRegistry,
    showManualInput: management.showManualInput,
    showPackages: management.showPackages,
    showReceivePanel,
    showRegistry: management.showRegistry,
  })

  useEffect(() => {
    if (!executionRequest?.id) return
    if (executionRequest.kind === 'message') openTopicPanel(executionRequest.target)
    else if (executionRequest.kind === 'service' || executionRequest.kind === 'callable_service') openServicePanel(executionRequest.target)
    else if (executionRequest.kind === 'action' || executionRequest.kind === 'callable_action') openActionPanel(executionRequest.target)
  }, [executionRequest, openActionPanel, openServicePanel, openTopicPanel])

  useInterfaceControlLifecycle({
    loadActionExecution,
    loadApplyStatus: management.loadApplyStatus,
    loadServiceExecution,
    loadTopicExecution,
    refreshSignal,
    reloadPhase: management.reloadPhase,
    runImportCheck: management.runImportCheck,
    setApplyStatus: management.setApplyStatus,
    setBuildLogTail: management.setBuildLogTail,
    setFeedback: management.setFeedback,
    setPackages: management.setPackages,
    setRegistry: management.setRegistry,
    setReloadPhase: management.setReloadPhase,
    showCallableActions,
    showCallableServices,
    showCallableTopics,
    showPackages: management.showPackages,
    showRegistry: management.showRegistry,
    websocketStatus: websocket?.status,
  })

  const disabled = management.busy || management.applying
    || serviceCallBusy || actionGoalBusy || topicPublishBusy

  const {
    handleRemoveManualDefinition,
    handleRemovePackage,
    handleRemoveRegistryEntry,
  } = useInterfaceRemovalActions({
    loadActionExecution,
    loadServiceExecution,
    loadTopicExecution,
    removeManualDefinition: management.removeManualDefinition,
    removePackage: management.removePackage,
    removeRegistryEntry: management.removeRegistryEntry,
  })

  const managementView = interfaceManagementView({
    disabled,
    management,
    panel: {
      collapseWorkspace,
      expanded: topicExpandedActive,
      openActionPanel,
      openPackages,
      openReceivePanel,
      openRegistry,
      openServicePanel,
      openTopicPanel,
      toggleBuildLog,
      toggleWorkspaceExpanded,
    },
    refs: { inputRef, packageFolderInputRef, packageInputRef },
    removal: {
      handleRemoveManualDefinition,
      handleRemovePackage,
      handleRemoveRegistryEntry,
    },
    websocketStatus: websocket?.status,
  })
  const executionViews = interfaceExecutionViews({
    action,
    availableTopics,
    panel: {
      closeExecutionPanels,
      closeReceivePanel,
      expanded: topicExpandedActive,
      selectReceiveMode,
      showCallableActions,
      showCallableServices,
      showCallableTopics,
      showReceivePanel,
      toggleWorkspaceExpanded,
    },
    qos: {
      actionQosLink,
      linkedActionExecutionQosControls,
      linkedActionReceiveQosControls,
      serviceQosLink,
      topicQosLink,
    },
    receive,
    service,
    topic,
  })

  return (
    <InterfaceUploadView
      {...managementView}
      {...executionViews}
      expanded={topicExpandedActive}
    />
  )
}
