import { useRef, useState } from 'react'
import { InterfaceUploadView } from '../features/interface-lab/InterfaceUploadView.jsx'
import { useInterfaceManagementController } from '../features/interface-lab/hooks/useInterfaceManagementController.js'
import { useActionExecutionController } from '../features/interface-lab/hooks/useActionExecutionController.js'
import { useInterfaceControlLifecycle } from '../features/interface-lab/hooks/useInterfaceControlLifecycle.js'
import { useInterfacePanelCoordinator } from '../features/interface-lab/hooks/useInterfacePanelCoordinator.js'
import { useInterfaceReceiveController } from '../features/interface-lab/hooks/useInterfaceReceiveController.js'
import { useServiceExecutionController } from '../features/interface-lab/hooks/useServiceExecutionController.js'
import { useTopicExecutionController } from '../features/interface-lab/hooks/useTopicExecutionController.js'

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
  const [availableTopics, setAvailableTopics] = useState([])
  const [selectedReceiveServiceKey, setSelectedReceiveServiceKey] = useState('')
  const [selectedReceiveActionKey, setSelectedReceiveActionKey] = useState('')
  const {
    activeContinuousPublish,
    busy: topicPublishBusy,
    changePublishName: setTopicPublishName,
    load: loadTopicExecution,
    messageValues: topicMessageValues,
    messages: callableMessages,
    publish: publishSelectedTopicMessage,
    publishGraphTopics,
    publishHz: topicPublishHz,
    publishName: topicPublishName,
    publishWarning: topicPublishWarning,
    replace: setCallableMessages,
    resetHistory: resetSelectedTopicPublishHistory,
    result: topicPublishResult,
    select: setSelectedMessageKey,
    selected: selectedMessage,
    selectedKey: selectedMessageKey,
    setImportableOnly: setTopicImportableOnly,
    setMessageValues: setTopicMessageValues,
    setPublishHz: setTopicPublishHz,
    startContinuous: startSelectedContinuousTopicPublish,
    stopContinuous: stopSelectedContinuousTopicPublish,
    importableOnly: topicImportableOnly,
    visibleHistory: visiblePublishHistory,
    visibleMessages: visibleCallableMessages,
  } = useTopicExecutionController({
    availableTopics,
    onStateChanged,
    setFeedback,
  })
  const {
    busy: serviceCallBusy,
    execute: executeServiceCall,
    history: serviceCallHistory,
    importableOnly: serviceImportableOnly,
    load: loadServiceExecution,
    replace: setCallableServices,
    requestValues,
    result: serviceCallResult,
    select: setSelectedServiceKey,
    selected: selectedService,
    selectedKey: selectedServiceKey,
    services: callableServices,
    setImportableOnly: setServiceImportableOnly,
    setRequestValues,
    setTimeoutSec,
    timeoutSec,
    visibleServices: visibleCallableServices,
  } = useServiceExecutionController({
    onSelectionChange: setSelectedReceiveServiceKey,
    onStateChanged,
  })
  const {
    actions: callableActions,
    busy: actionGoalBusy,
    execute: executeActionGoal,
    goalValues,
    history: actionGoalHistory,
    importableOnly: actionImportableOnly,
    load: loadActionExecution,
    replace: setCallableActions,
    result: actionGoalResult,
    select: setSelectedActionKey,
    selected: selectedAction,
    selectedKey: selectedActionKey,
    setGoalValues,
    setImportableOnly: setActionImportableOnly,
    setTimeoutSec: setGoalTimeoutSec,
    timeoutSec: goalTimeoutSec,
    visibleActions: visibleCallableActions,
  } = useActionExecutionController({
    onSelectionChange: setSelectedReceiveActionKey,
    onStateChanged,
  })
  const {
    actionSearch: receiveActionSearch,
    activeActionKey: activeReceiveActionKey,
    activeServiceKey: activeReceiveServiceKey,
    changeTopic: setSelectedReceiveTopic,
    filteredActions: filteredReceiveActions,
    filteredServices: filteredReceiveServices,
    filteredTopics: filteredReceiveTopics,
    load: loadReceiveState,
    mode: receiveMode,
    open: showReceivePanel,
    resetActions: resetReceiveActions,
    resetAllTopics: resetAllTopicReceiveHistory,
    resetSelectedTopic: resetSelectedTopicReceiveHistory,
    resetServices: resetReceiveServices,
    selectedTopic: selectedReceiveTopic,
    selectedTopicReceiving,
    serviceSearch: receiveServiceSearch,
    setActionSearch: setReceiveActionSearch,
    setMode: setReceiveMode,
    setOpen: setShowReceivePanel,
    setServiceSearch: setReceiveServiceSearch,
    setTopicSearch: setReceiveTopicSearch,
    startAction: startSelectedActionReceive,
    startService: startSelectedServiceReceive,
    startTopic: startSelectedTopicReceive,
    stopAction: stopSelectedActionReceive,
    stopService: stopSelectedServiceReceive,
    stopTopic: stopSelectedTopicReceive,
    topicSearch: receiveTopicSearch,
    topics: receiveTopics,
    visibleActionHistory: visibleReceiveActionHistory,
    visibleServiceHistory: visibleReceiveServiceHistory,
    visibleTopicHistory: visibleReceiveTopicHistory,
  } = useInterfaceReceiveController({
    actions: callableActions,
    availableTopics,
    replaceActions: setCallableActions,
    replaceMessages: setCallableMessages,
    replaceServices: setCallableServices,
    selectedMessage,
    selectedReceiveActionKey,
    selectedReceiveServiceKey,
    services: callableServices,
    setAvailableTopics,
    setBusy,
    setFeedback,
    setSelectedReceiveActionKey,
    setSelectedReceiveServiceKey,
  })

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

  const resetServiceReceiveHistory = () => resetReceiveServices(false)
  const resetSelectedServiceReceiveHistory = () => resetReceiveServices(true)
  const resetActionReceiveHistory = () => resetReceiveActions(false)
  const resetSelectedActionReceiveHistory = () => resetReceiveActions(true)

  return (
    <InterfaceUploadView
      actionExecution={{
        actions: callableActions,
        busy: actionGoalBusy,
        expanded: topicExpandedActive,
        goals: actionGoalHistory,
        goalValues,
        importableOnly: actionImportableOnly,
        onExecute: executeActionGoal,
        onFieldChange: (name, value) => setGoalValues((current) => ({ ...current, [name]: value })),
        onImportableOnlyChange: setActionImportableOnly,
        onSelect: setSelectedActionKey,
        onTimeoutChange: setGoalTimeoutSec,
        onToggleExpanded: toggleWorkspaceExpanded,
        open: showCallableActions,
        result: actionGoalResult,
        selected: selectedAction,
        selectedKey: selectedActionKey,
        showExpand: showReceivePanel && receiveMode === 'action',
        timeoutSec: goalTimeoutSec,
        visibleActions: visibleCallableActions,
      }}
      buildFailure={{
        applying,
        buildLogTail,
        busy,
        onApply: applyUploadedInterfaces,
        onRegenerate: regenerateUploadedInterfacesCmake,
        onToggle: toggleBuildLog,
        open: showBuildLog,
        visible: applyStatus?.build_status === 'failed',
      }}
      expanded={topicExpandedActive}
      manual={{
        disabled,
        editingManualDefinition,
        manualDefinition,
        manualKind,
        manualMode,
        manualType,
        manualTypeName,
        onCancelEdit: () => setEditingManualDefinition(null),
        onDefinitionChange: setManualDefinition,
        onKindChange: setManualKind,
        onModeChange: setManualMode,
        onSubmitDefinition: submitManualDefinition,
        onSubmitType: submitManualType,
        onTypeChange: setManualType,
        onTypeNameChange: setManualTypeName,
        onValidateDefinition: validateCurrentManualDefinition,
        open: showManualInput,
      }}
      packages={{
        expanded: topicExpandedActive,
        onDelete: handleRemovePackage,
        onToggleExpanded: toggleWorkspaceExpanded,
        open: showPackages,
        packages,
      }}
      receive={{
        action: {
          activeKey: activeReceiveActionKey,
          history: visibleReceiveActionHistory,
          items: callableActions,
          onRefresh: loadReceiveState,
          onResetAll: resetActionReceiveHistory,
          onResetSelected: resetSelectedActionReceiveHistory,
          onSearchChange: setReceiveActionSearch,
          onSelect: setSelectedActionKey,
          onStart: startSelectedActionReceive,
          onStop: stopSelectedActionReceive,
          search: receiveActionSearch,
          selectedKey: selectedReceiveActionKey,
          visibleItems: filteredReceiveActions,
        },
        expanded: topicExpandedActive,
        mode: receiveMode,
        onModeChange: selectReceiveMode,
        onToggleExpanded: toggleWorkspaceExpanded,
        open: showReceivePanel,
        service: {
          activeKey: activeReceiveServiceKey,
          history: visibleReceiveServiceHistory,
          items: callableServices,
          onRefresh: loadReceiveState,
          onResetAll: resetServiceReceiveHistory,
          onResetSelected: resetSelectedServiceReceiveHistory,
          onSearchChange: setReceiveServiceSearch,
          onSelect: setSelectedServiceKey,
          onStart: startSelectedServiceReceive,
          onStop: stopSelectedServiceReceive,
          search: receiveServiceSearch,
          selectedKey: selectedReceiveServiceKey,
          visibleItems: filteredReceiveServices,
        },
        topic: {
          allMessages: callableMessages,
          allTopics: availableTopics,
          filteredTopics: filteredReceiveTopics,
          importableOnly: topicImportableOnly,
          onImportableOnlyChange: setTopicImportableOnly,
          onMessageSelect: setSelectedMessageKey,
          onRefresh: loadReceiveState,
          onResetAll: resetAllTopicReceiveHistory,
          onResetSelected: resetSelectedTopicReceiveHistory,
          onSearchChange: setReceiveTopicSearch,
          onStart: startSelectedTopicReceive,
          onStop: stopSelectedTopicReceive,
          onTopicNameChange: setSelectedReceiveTopic,
          receiveHistory: visibleReceiveTopicHistory,
          receiving: selectedTopicReceiving,
          receivingTopics: receiveTopics,
          search: receiveTopicSearch,
          selectedMessage,
          selectedMessageKey,
          selectedTopic: selectedReceiveTopic,
          visibleMessages: visibleCallableMessages,
        },
      }}
      registry={{
        onDelete: handleRemoveRegistryEntry,
        onDeleteManual: handleRemoveManualDefinition,
        onEditManual: startEditManualDefinition,
        open: showRegistry,
        recentDeletedRegistry,
        registry,
      }}
      serviceExecution={{
        busy: serviceCallBusy,
        calls: serviceCallHistory,
        expanded: topicExpandedActive,
        importableOnly: serviceImportableOnly,
        onExecute: executeServiceCall,
        onFieldChange: (name, value) => setRequestValues((current) => ({ ...current, [name]: value })),
        onImportableOnlyChange: setServiceImportableOnly,
        onSelect: setSelectedServiceKey,
        onTimeoutChange: setTimeoutSec,
        onToggleExpanded: toggleWorkspaceExpanded,
        open: showCallableServices,
        requestValues,
        result: serviceCallResult,
        selected: selectedService,
        selectedKey: selectedServiceKey,
        services: callableServices,
        showExpand: showReceivePanel && receiveMode === 'service',
        timeoutSec,
        visibleServices: visibleCallableServices,
      }}
      toolbar={{
        applying,
        busy,
        disabled,
        feedback,
        inputRef,
        onApply: applyUploadedInterfaces,
        onFile: handleFile,
        onOpenAction: openActionPanel,
        onOpenPackages: openPackages,
        onOpenReceive: openReceivePanel,
        onOpenRegistry: openRegistry,
        onOpenService: openServicePanel,
        onOpenTopic: openTopicPanel,
        onPackageFile: handlePackageFile,
        onPackageFolder: handlePackageFolder,
        onReplaceChange: setReplacePackage,
        onToggleManual: () => setShowManualInput((value) => !value),
        packageFolderInputRef,
        packageInputRef,
        reloadPhase,
        replacePackage,
        websocketStatus: websocket?.status,
      }}
      topicExecution={{
        activeContinuousPublish,
        busy: topicPublishBusy,
        expanded: topicExpandedActive,
        history: visiblePublishHistory,
        importableOnly: topicImportableOnly,
        messageValues: topicMessageValues,
        messages: callableMessages,
        onContinuousStart: startSelectedContinuousTopicPublish,
        onContinuousStop: stopSelectedContinuousTopicPublish,
        onFieldChange: (name, value) => setTopicMessageValues((current) => ({ ...current, [name]: value })),
        onHzChange: setTopicPublishHz,
        onImportableOnlyChange: setTopicImportableOnly,
        onPublish: publishSelectedTopicMessage,
        onResetHistory: resetSelectedTopicPublishHistory,
        onSelect: setSelectedMessageKey,
        onTopicNameChange: setTopicPublishName,
        onToggleExpanded: toggleWorkspaceExpanded,
        open: showCallableTopics,
        publishGraphTopics,
        publishHz: topicPublishHz,
        publishName: topicPublishName,
        publishResult: topicPublishResult,
        publishWarning: topicPublishWarning,
        selected: selectedMessage,
        selectedKey: selectedMessageKey,
        showExpand: showReceivePanel && receiveMode === 'topic',
        visibleMessages: visibleCallableMessages,
      }}
    />
  )
}
