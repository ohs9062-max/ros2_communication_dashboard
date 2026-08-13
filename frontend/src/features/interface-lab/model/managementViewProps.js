export function managementViewProps(state) {
  return {
    buildFailure: {
      applying: state.applying,
      buildLogTail: state.buildLogTail,
      busy: state.busy,
      onApply: state.applyUploadedInterfaces,
      onRegenerate: state.regenerateUploadedInterfacesCmake,
      onToggle: state.toggleBuildLog,
      open: state.showBuildLog,
      visible: state.applyStatus?.build_status === 'failed',
    },
    manual: {
      disabled: state.disabled,
      editingManualDefinition: state.editingManualDefinition,
      expanded: state.expanded,
      manualDefinition: state.manualDefinition,
      manualKind: state.manualKind,
      manualMode: state.manualMode,
      manualType: state.manualType,
      manualTypeName: state.manualTypeName,
      onCancelEdit: () => state.setEditingManualDefinition(null),
      onDefinitionChange: state.setManualDefinition,
      onKindChange: state.setManualKind,
      onModeChange: state.setManualMode,
      onClose: () => {
        state.setShowManualInput(false)
        state.collapseWorkspace()
      },
      onSubmitDefinition: state.submitManualDefinition,
      onSubmitType: state.submitManualType,
      onTypeChange: state.setManualType,
      onTypeNameChange: state.setManualTypeName,
      onToggleExpanded: state.toggleWorkspaceExpanded,
      onValidateDefinition: state.validateCurrentManualDefinition,
      open: state.showManualInput,
    },
    packages: {
      expanded: state.expanded,
      onClose: () => {
        state.setShowPackages(false)
        state.collapseWorkspace()
      },
      onDelete: state.handleRemovePackage,
      onToggleExpanded: state.toggleWorkspaceExpanded,
      open: state.showPackages,
      packages: state.packages,
    },
    registry: {
      expanded: state.expanded,
      onDelete: state.handleRemoveRegistryEntry,
      onDeleteManual: state.handleRemoveManualDefinition,
      onEditManual: state.startEditManualDefinition,
      onClose: () => {
        state.setShowRegistry(false)
        state.collapseWorkspace()
      },
      onToggleExpanded: state.toggleWorkspaceExpanded,
      open: state.showRegistry,
      recentDeletedRegistry: state.recentDeletedRegistry,
      registry: state.registry,
    },
    toolbar: {
      applying: state.applying,
      busy: state.busy,
      disabled: state.disabled,
      feedback: state.feedback,
      inputRef: state.inputRef,
      onApply: state.applyUploadedInterfaces,
      onFile: state.handleFile,
      onOpenAction: state.openActionPanel,
      onOpenPackages: state.openPackages,
      onOpenReceive: state.openReceivePanel,
      onOpenRegistry: state.openRegistry,
      onOpenService: state.openServicePanel,
      onOpenTopic: state.openTopicPanel,
      onPackageFile: state.handlePackageFile,
      onPackageFolder: state.handlePackageFolder,
      onReplaceChange: state.setReplacePackage,
      onToggleManual: () => state.setShowManualInput((value) => !value),
      packageFolderInputRef: state.packageFolderInputRef,
      packageInputRef: state.packageInputRef,
      reloadPhase: state.reloadPhase,
      replacePackage: state.replacePackage,
      websocketStatus: state.websocketStatus,
    },
  }
}

export function interfaceManagementView({
  disabled,
  management,
  panel,
  refs,
  removal,
  websocketStatus,
}) {
  return managementViewProps({
    ...management,
    ...panel,
    ...refs,
    ...removal,
    disabled,
    startEditManualDefinition: management.startEditingManualDefinition,
    websocketStatus,
  })
}
