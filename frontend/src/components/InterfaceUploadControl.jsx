import { useRef } from 'react'
import { InterfaceUploadView } from '../features/interface-lab/InterfaceUploadView.jsx'
import { useInterfaceManagementController } from '../features/interface-lab/hooks/useInterfaceManagementController.js'
import { useInterfaceControlLifecycle } from '../features/interface-lab/hooks/useInterfaceControlLifecycle.js'
import { useInterfaceExecutionSuite } from '../features/interface-lab/hooks/useInterfaceExecutionSuite.js'
import { useInterfacePanelCoordinator } from '../features/interface-lab/hooks/useInterfacePanelCoordinator.js'
import {
  actionExecutionViewProps,
  managementViewProps,
  receiveWorkspaceViewProps,
  serviceExecutionViewProps,
  topicExecutionViewProps,
} from '../features/interface-lab/model/interfaceUploadViewProps.js'

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
    selected: selectedAction, selectedKey: selectedActionKey, setGoalValues,
    setImportableOnly: setActionImportableOnly, setTimeoutSec: setGoalTimeoutSec,
    timeoutSec: goalTimeoutSec, visibleActions: visibleCallableActions,
  } = action
  const {
    busy: serviceCallBusy, execute: executeServiceCall, history: serviceCallHistory,
    importableOnly: serviceImportableOnly, load: loadServiceExecution, requestValues,
    result: serviceCallResult, select: setSelectedServiceKey, selected: selectedService,
    selectedKey: selectedServiceKey, services: callableServices,
    setImportableOnly: setServiceImportableOnly, setRequestValues, setTimeoutSec,
    timeoutSec, visibleServices: visibleCallableServices,
  } = service
  const {
    activeContinuousPublish, busy: topicPublishBusy,
    changePublishName: setTopicPublishName, importableOnly: topicImportableOnly,
    load: loadTopicExecution, messageValues: topicMessageValues,
    messages: callableMessages, publish: publishSelectedTopicMessage,
    publishGraphTopics, publishHz: topicPublishHz, publishName: topicPublishName,
    publishWarning: topicPublishWarning, resetHistory: resetSelectedTopicPublishHistory,
    result: topicPublishResult, select: setSelectedMessageKey, selected: selectedMessage,
    selectedKey: selectedMessageKey, setImportableOnly: setTopicImportableOnly,
    setMessageValues: setTopicMessageValues, setPublishHz: setTopicPublishHz,
    startContinuous: startSelectedContinuousTopicPublish,
    stopContinuous: stopSelectedContinuousTopicPublish,
    visibleHistory: visiblePublishHistory, visibleMessages: visibleCallableMessages,
  } = topic
  const {
    actionSearch: receiveActionSearch, activeActionKey: activeReceiveActionKey,
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
    startService: startSelectedServiceReceive, startTopic: startSelectedTopicReceive,
    stopAction: stopSelectedActionReceive, stopService: stopSelectedServiceReceive,
    stopTopic: stopSelectedTopicReceive, topicSearch: receiveTopicSearch,
    topics: receiveTopics, visibleActionHistory: visibleReceiveActionHistory,
    visibleServiceHistory: visibleReceiveServiceHistory,
    visibleTopicHistory: visibleReceiveTopicHistory,
  } = receive

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
        open: showCallableActions, selectedAction, selectedActionKey,
        setActionImportableOnly, setGoalTimeoutSec, setGoalValues, setSelectedActionKey,
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
        serviceCallHistory, serviceCallResult, serviceImportableOnly,
        setRequestValues, setSelectedServiceKey, setServiceImportableOnly,
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
        visibleCallableMessages, visiblePublishHistory,
      })}
    />
  )
}
