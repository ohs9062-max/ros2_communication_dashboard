import { useRef } from 'react'
import { InterfaceUploadView } from '../features/interface-lab/InterfaceUploadView.jsx'
import { useInterfaceManagementController } from '../features/interface-lab/hooks/useInterfaceManagementController.js'
import { useInterfaceControlLifecycle } from '../features/interface-lab/hooks/useInterfaceControlLifecycle.js'
import { useInterfaceExecutionSuite } from '../features/interface-lab/hooks/useInterfaceExecutionSuite.js'
import { useInterfacePanelCoordinator } from '../features/interface-lab/hooks/useInterfacePanelCoordinator.js'
import { useLinkedQosModes } from '../features/interface-lab/hooks/useLinkedQosModes.js'
import {
  actionExecutionViewProps,
  serviceExecutionViewProps,
  topicExecutionViewProps,
} from '../features/interface-lab/model/executionViewProps.js'
import { managementViewProps } from '../features/interface-lab/model/managementViewProps.js'
import { receiveWorkspaceViewProps } from '../features/interface-lab/model/receiveViewProps.js'

export function InterfaceUploadControl({
  onStateChanged,
  onTopicWorkspaceExpandedChange,
  refreshSignal = 0,
  websocket,
}) {
  const inputRef = useRef(null)
  const packageFolderInputRef = useRef(null)
  const packageInputRef = useRef(null)
  const {
    applyStatus, applyUploadedInterfaces, applying, buildLogTail, busy,
    editingManualDefinition, feedback,
    handleFile, handlePackageFile, handlePackageFolder, loadApplyStatus, loadPackages,
    loadRegistry, regenerateUploadedInterfacesCmake, removeManualDefinition,
    removePackage, removeRegistryEntry, runImportCheck,
    manualDefinition, manualKind, manualMode, manualType, manualTypeName,
    packages, recentDeletedRegistry, registry, reloadPhase, replacePackage,
    setApplyStatus, setBuildLogTail, setBusy, setEditingManualDefinition,
    setFeedback, setManualDefinition, setManualKind, setManualMode, setManualType,
    setManualTypeName, setPackages, setRegistry,
    setReloadPhase, setReplacePackage, setShowBuildLog, setShowManualInput,
    setShowPackages, setShowRegistry, showBuildLog, showManualInput, showPackages,
    showRegistry, startEditingManualDefinition, submitManualDefinition,
    submitManualType, validateCurrentManualDefinition,
  } = useInterfaceManagementController({
    onStateChanged,
  })
  const {
    action, availableTopics, receive, selectedReceiveActionKey,
    selectedReceiveServiceKey, service, topic,
  } = useInterfaceExecutionSuite({
    onStateChanged,
    setBusy,
    setFeedback,
  })
  const {
    actions: callableActions, busy: actionGoalBusy, execute: executeActionGoal,
    goalValues, history: actionGoalHistory, importableOnly: actionImportableOnly,
    load: loadActionExecution, result: actionGoalResult, select: setSelectedActionKey,
    qosControls: actionQosControls,
    selected: selectedAction, selectedKey: selectedActionKey, setGoalValues,
    setImportableOnly: setActionImportableOnly, setTimeoutSec: setGoalTimeoutSec,
    timeoutSec: goalTimeoutSec, visibleActions: visibleCallableActions,
  } = action
  const {
    busy: serviceCallBusy, execute: executeServiceCall, history: serviceCallHistory,
    importableOnly: serviceImportableOnly, load: loadServiceExecution, requestValues,
    result: serviceCallResult, select: setSelectedServiceKey, selected: selectedService,
    selectedKey: selectedServiceKey, services: callableServices,
    requestQosMode: serviceRequestQosMode, requestQosProfile: serviceRequestQosProfile,
    responseQosMode: serviceResponseQosMode, responseQosProfile: serviceResponseQosProfile,
    setImportableOnly: setServiceImportableOnly, setRequestValues, setTimeoutSec,
    setRequestQosMode: setServiceRequestQosMode,
    setRequestQosProfile: setServiceRequestQosProfile,
    setResponseQosMode: setServiceResponseQosMode,
    setResponseQosProfile: setServiceResponseQosProfile,
    timeoutSec, visibleServices: visibleCallableServices,
  } = service
  const {
    activeContinuousPublish, busy: topicPublishBusy,
    changePublishName: setTopicPublishName, importableOnly: topicImportableOnly,
    load: loadTopicExecution, messageValues: topicMessageValues,
    messages: callableMessages, publish: publishSelectedTopicMessage,
    publishGraphTopics, publishHz: topicPublishHz, publishName: topicPublishName,
    publishWarning: topicPublishWarning, resetHistory: resetSelectedTopicPublishHistory,
    qosMode: topicQosMode, qosProfile: topicQosProfile,
    result: topicPublishResult, select: setSelectedMessageKey, selected: selectedMessage,
    selectedKey: selectedMessageKey, setImportableOnly: setTopicImportableOnly,
    setQosMode: setTopicQosMode, setQosProfile: setTopicQosProfile,
    setMessageValues: setTopicMessageValues, setPublishHz: setTopicPublishHz,
    startContinuous: startSelectedContinuousTopicPublish,
    stopContinuous: stopSelectedContinuousTopicPublish,
    visibleHistory: visiblePublishHistory, visibleMessages: visibleCallableMessages,
  } = topic
  const {
    actionSearch: receiveActionSearch, activeActionKey: activeReceiveActionKey,
    actionQosControls: receiveActionQosControls,
    activeServiceKey: activeReceiveServiceKey, changeTopic: setSelectedReceiveTopic,
    filteredActions: filteredReceiveActions, filteredServices: filteredReceiveServices,
    filteredTopics: filteredReceiveTopics, load: loadReceiveState, mode: receiveMode,
    open: showReceivePanel, resetActions: resetReceiveActions,
    resetAllTopics: resetAllTopicReceiveHistory,
    resetSelectedTopic: resetSelectedTopicReceiveHistory,
    resetServices: resetReceiveServices, selectedTopic: selectedReceiveTopic,
    selectedTopicReceiving, serviceSearch: receiveServiceSearch,
    setActionSearch: setReceiveActionSearch, setMode: setReceiveMode,
    setOpen: setShowReceivePanel, setServiceSearch: setReceiveServiceSearch,
    setTopicSearch: setReceiveTopicSearch, startAction: startSelectedActionReceive,
    qosMode: receiveTopicQosMode, qosProfile: receiveTopicQosProfile,
    setQosMode: setReceiveTopicQosMode, setQosProfile: setReceiveTopicQosProfile,
    startService: startSelectedServiceReceive, startTopic: startSelectedTopicReceive,
    stopAction: stopSelectedActionReceive, stopService: stopSelectedServiceReceive,
    stopTopic: stopSelectedTopicReceive, topicSearch: receiveTopicSearch,
    topics: receiveTopics, visibleActionHistory: visibleReceiveActionHistory,
    visibleServiceHistory: visibleReceiveServiceHistory,
    visibleTopicHistory: visibleReceiveTopicHistory,
  } = receive

  const topicQosLink = useLinkedQosModes({
    executionMode: topicQosMode,
    executionProfiles: { topic: topicQosProfile },
    receiveMode: receiveTopicQosMode,
    receiveProfiles: { topic: receiveTopicQosProfile },
    setExecutionMode: setTopicQosMode,
    setExecutionProfile: (_key, profile) => setTopicQosProfile(profile),
    setReceiveMode: setReceiveTopicQosMode,
    setReceiveProfile: (_key, profile) => setReceiveTopicQosProfile(profile),
  })
  const serviceQosLink = useLinkedQosModes({
    executionMode: serviceRequestQosMode,
    executionProfiles: { service: serviceRequestQosProfile },
    receiveMode: serviceResponseQosMode,
    receiveProfiles: { service: serviceResponseQosProfile },
    setExecutionMode: setServiceRequestQosMode,
    setExecutionProfile: (_key, profile) => setServiceRequestQosProfile(profile),
    setReceiveMode: setServiceResponseQosMode,
    setReceiveProfile: (_key, profile) => setServiceResponseQosProfile(profile),
  })
  const actionQosLink = useLinkedQosModes({
    executionMode: actionQosControls[0].mode,
    executionProfiles: Object.fromEntries(
      actionQosControls.map((control) => [control.key, control.profile]),
    ),
    receiveMode: receiveActionQosControls[0].mode,
    receiveProfiles: Object.fromEntries(
      receiveActionQosControls.map((control) => [control.key, control.profile]),
    ),
    setExecutionMode: actionQosControls[0].onModeChange,
    setExecutionProfile: (key, profile) => {
      actionQosControls.find((control) => control.key === key)?.onProfileChange(profile)
    },
    setReceiveMode: receiveActionQosControls[0].onModeChange,
    setReceiveProfile: (key, profile) => {
      receiveActionQosControls.find((control) => control.key === key)?.onProfileChange(profile)
    },
  })
  const linkedActionExecutionQosControls = actionQosControls.map((control) => ({
    ...control,
    onModeChange: actionQosLink.changeExecutionMode,
    onProfileChange: (profile) => actionQosLink.changeExecutionProfile(control.key, profile),
  }))
  const linkedActionReceiveQosControls = receiveActionQosControls.map((control) => ({
    ...control,
    onModeChange: actionQosLink.changeReceiveMode,
    onProfileChange: (profile) => actionQosLink.changeReceiveProfile(control.key, profile),
  }))

  const {
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
    loadPackages,
    loadReceiveState,
    loadRegistry,
    loadServiceExecution,
    loadTopicExecution,
    onExpandedChange: onTopicWorkspaceExpandedChange,
    receiveMode,
    setBusy,
    setFeedback,
    setReceiveMode,
    setShowBuildLog,
    setShowManualInput,
    setShowPackages,
    setShowReceivePanel,
    setShowRegistry,
    showPackages,
    showReceivePanel,
  })

  useInterfaceControlLifecycle({
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
    websocketStatus: websocket?.status,
  })

  const disabled = busy || applying || serviceCallBusy || actionGoalBusy || topicPublishBusy
  const startEditManualDefinition = (item) => {
    startEditingManualDefinition(item)
  }

  const refreshExecutionCandidatesAfterDelete = async () => {
    await Promise.all([
      loadTopicExecution(),
      loadServiceExecution(),
      loadActionExecution(),
    ])
  }

  const handleRemoveManualDefinition = (item) =>
    removeManualDefinition(item, refreshExecutionCandidatesAfterDelete)

  const handleRemovePackage = (packageName) =>
    removePackage(packageName, refreshExecutionCandidatesAfterDelete)

  const handleRemoveRegistryEntry = (item) =>
    removeRegistryEntry(item, refreshExecutionCandidatesAfterDelete)

  const managementView = managementViewProps({
    applyStatus, applyUploadedInterfaces, applying, buildLogTail, busy, disabled,
    editingManualDefinition, feedback, handleFile, handlePackageFile,
    handlePackageFolder, handleRemoveManualDefinition, handleRemovePackage,
    handleRemoveRegistryEntry, inputRef, manualDefinition, manualKind, manualMode,
    manualType, manualTypeName, openActionPanel, openPackages, openReceivePanel,
    openRegistry, openServicePanel, openTopicPanel, packageFolderInputRef,
    packageInputRef, packages, recentDeletedRegistry,
    regenerateUploadedInterfacesCmake, registry, reloadPhase, replacePackage,
    setEditingManualDefinition, setManualDefinition, setManualKind, setManualMode,
    setManualType, setManualTypeName, setReplacePackage, setShowManualInput,
    showBuildLog, showManualInput, showPackages, showRegistry,
    startEditManualDefinition, submitManualDefinition, submitManualType,
    toggleBuildLog, toggleWorkspaceExpanded, validateCurrentManualDefinition,
    websocketStatus: websocket?.status,
    expanded: topicExpandedActive,
  })

  return (
    <InterfaceUploadView
      {...managementView}
      actionExecution={actionExecutionViewProps({
        actionGoalBusy, actionGoalHistory, actionGoalResult, actionImportableOnly,
        callableActions, executeActionGoal, expanded: topicExpandedActive,
        goalTimeoutSec, goalValues, onToggleExpanded: toggleWorkspaceExpanded,
        actionQosControls: linkedActionExecutionQosControls,
        actionQosModeLinked: actionQosLink.linked,
        open: showCallableActions, selectedAction, selectedActionKey,
        setActionImportableOnly, setGoalTimeoutSec, setGoalValues, setSelectedActionKey,
        setActionQosModeLinked: actionQosLink.linkFromExecution,
        showExpand: showReceivePanel && receiveMode === 'action', visibleCallableActions,
      })}
      expanded={topicExpandedActive}
      receive={receiveWorkspaceViewProps({
        activeReceiveActionKey, activeReceiveServiceKey, availableTopics,
        callableActions, callableMessages, callableServices,
        expanded: topicExpandedActive, filteredReceiveActions, filteredReceiveServices,
        filteredReceiveTopics, loadReceiveState, onToggleExpanded: toggleWorkspaceExpanded,
        open: showReceivePanel, receiveActionSearch, receiveMode, receiveServiceSearch,
        receiveTopicSearch, receiveTopics, resetAllTopicReceiveHistory,
        resetReceiveActions, resetReceiveServices, resetSelectedTopicReceiveHistory,
        selectReceiveMode, selectedMessage, selectedMessageKey,
        selectedReceiveActionKey, selectedReceiveServiceKey, selectedReceiveTopic,
        selectedTopicReceiving, setReceiveActionSearch, setReceiveServiceSearch,
        setReceiveTopicSearch, setSelectedActionKey, setSelectedMessageKey,
        setTopicQosMode: topicQosLink.changeReceiveMode,
        setTopicQosProfile: (profile) => topicQosLink.changeReceiveProfile('topic', profile),
        topicQosMode: receiveTopicQosMode,
        topicQosModeLinked: topicQosLink.linked,
        topicQosProfile: receiveTopicQosProfile,
        actionQosControls: linkedActionReceiveQosControls,
        actionQosModeLinked: actionQosLink.linked,
        serviceQosModeLinked: serviceQosLink.linked,
        setActionQosModeLinked: actionQosLink.linkFromReceive,
        setServiceQosModeLinked: serviceQosLink.linkFromReceive,
        setTopicQosModeLinked: topicQosLink.linkFromReceive,
        serviceResponseQosMode, serviceResponseQosProfile,
        setServiceResponseQosMode: serviceQosLink.changeReceiveMode,
        setServiceResponseQosProfile: (profile) => serviceQosLink.changeReceiveProfile('service', profile),
        setSelectedReceiveTopic, setSelectedServiceKey, startSelectedActionReceive,
        startSelectedServiceReceive, startSelectedTopicReceive, stopSelectedActionReceive,
        stopSelectedServiceReceive, stopSelectedTopicReceive, topicImportableOnly,
        setTopicImportableOnly, visibleCallableMessages, visibleReceiveActionHistory,
        visibleReceiveServiceHistory, visibleReceiveTopicHistory,
      })}
      serviceExecution={serviceExecutionViewProps({
        callableServices, executeServiceCall, expanded: topicExpandedActive,
        onToggleExpanded: toggleWorkspaceExpanded, open: showCallableServices,
        requestValues, selectedService, selectedServiceKey, serviceCallBusy,
        serviceRequestQosMode, serviceRequestQosProfile,
        serviceQosModeLinked: serviceQosLink.linked,
        serviceCallHistory, serviceCallResult, serviceImportableOnly,
        setRequestValues, setSelectedServiceKey, setServiceImportableOnly,
        setServiceQosModeLinked: serviceQosLink.linkFromExecution,
        setServiceRequestQosMode: serviceQosLink.changeExecutionMode,
        setServiceRequestQosProfile: (profile) => serviceQosLink.changeExecutionProfile('service', profile),
        setTimeoutSec, showExpand: showReceivePanel && receiveMode === 'service',
        timeoutSec, visibleCallableServices,
      })}
      topicExecution={topicExecutionViewProps({
        activeContinuousPublish, callableMessages, expanded: topicExpandedActive,
        onToggleExpanded: toggleWorkspaceExpanded, open: showCallableTopics,
        publishGraphTopics, publishSelectedTopicMessage, resetSelectedTopicPublishHistory,
        selectedMessage, selectedMessageKey, setSelectedMessageKey,
        setTopicImportableOnly, setTopicMessageValues, setTopicPublishHz,
        setTopicPublishName, showExpand: showReceivePanel && receiveMode === 'topic',
        startSelectedContinuousTopicPublish, stopSelectedContinuousTopicPublish,
        topicImportableOnly, topicMessageValues, topicPublishBusy, topicPublishHz,
        topicPublishName, topicPublishResult, topicPublishWarning,
        topicQosMode, topicQosProfile,
        topicQosModeLinked: topicQosLink.linked,
        setTopicQosMode: topicQosLink.changeExecutionMode,
        setTopicQosModeLinked: topicQosLink.linkFromExecution,
        setTopicQosProfile: (profile) => topicQosLink.changeExecutionProfile('topic', profile),
        visibleCallableMessages, visiblePublishHistory,
      })}
    />
  )
}
