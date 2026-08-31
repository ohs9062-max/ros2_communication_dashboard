import assert from 'node:assert/strict'
import test from 'node:test'

import { interfaceManagementView } from './managementViewProps.js'

function marker(name) {
  return Object.assign(() => {}, { marker: name })
}

test('management adapter preserves controller, panel, removal, and ref contracts', () => {
  const management = {
    applyStatus: { build_status: 'failed' },
    applyUploadedInterfaces: marker('apply'), applying: true,
    buildLogTail: 'failure output', busy: false,
    editingManualDefinition: { full_type: 'demo/msg/Test' },
    feedback: { tone: 'error', text: 'failed' },
    handleFile: marker('file'), handlePackageFile: marker('package-file'),
    handlePackageFolder: marker('package-folder'),
    manualDefinition: 'string data', manualKind: 'msg', manualMode: 'definition',
    manualType: 'demo/msg/Test', manualTypeName: 'demo/msg/Test',
    packages: [{ package_name: 'demo' }],
    recentDeletedRegistry: [{ full_type: 'demo/msg/Old' }],
    regenerateUploadedInterfacesCmake: marker('regenerate'),
    registry: [{ full_type: 'demo/msg/Test' }], reloadPhase: 'idle', replacePackage: false,
    setEditingManualDefinition: marker('set-editing'),
    setManualDefinition: marker('set-definition'), setManualKind: marker('set-kind'),
    setManualMode: marker('set-mode'), setManualType: marker('set-type'),
    setManualTypeName: marker('set-type-name'), setReplacePackage: marker('set-replace'),
    setShowManualInput: marker('show-manual'), setShowPackages: marker('show-packages'),
    setShowRegistry: marker('show-registry'), showBuildLog: true,
    showManualInput: true, showPackages: true, showRegistry: true,
    startEditingManualDefinition: marker('start-edit'),
    submitManualDefinition: marker('submit-definition'), submitManualType: marker('submit-type'),
    validateCurrentManualDefinition: marker('validate'),
  }
  const panel = {
    collapseWorkspace: marker('collapse'), expanded: true,
    openActionPanel: marker('open-action'), openPackages: marker('open-packages'),
    openReceivePanel: marker('open-receive'), openRegistry: marker('open-registry'),
    openServicePanel: marker('open-service'), openTopicPanel: marker('open-topic'),
    openServerListPanel: marker('open-server-list'),
    toggleBuildLog: marker('toggle-build'), toggleWorkspaceExpanded: marker('toggle-expanded'),
  }
  const refs = {
    inputRef: { current: 'file' }, packageFolderInputRef: { current: 'folder' },
    packageInputRef: { current: 'package' },
  }
  const removal = {
    handleRemoveManualDefinition: marker('remove-manual'),
    handleRemovePackage: marker('remove-package'),
    handleRemoveRegistryEntry: marker('remove-registry'),
  }

  const view = interfaceManagementView({
    disabled: true, management, panel, refs, removal, websocketStatus: 'connected',
  })

  assert.equal(view.buildFailure.visible, true)
  assert.equal(view.buildFailure.onApply, management.applyUploadedInterfaces)
  assert.equal(view.manual.onSubmitDefinition, management.submitManualDefinition)
  assert.equal(view.manual.onToggleExpanded, panel.toggleWorkspaceExpanded)
  assert.equal(view.packages.onDelete, removal.handleRemovePackage)
  assert.equal(view.registry.onEditManual, management.startEditingManualDefinition)
  assert.equal(view.registry.onDelete, removal.handleRemoveRegistryEntry)
  assert.equal(view.toolbar.onOpenTopic, panel.openTopicPanel)
  assert.equal(view.toolbar.onOpenReceive, panel.openReceivePanel)
  assert.equal(view.toolbar.onOpenServerList, panel.openServerListPanel)
  assert.equal(view.toolbar.inputRef, refs.inputRef)
  assert.equal(view.toolbar.websocketStatus, 'connected')
  assert.equal(view.toolbar.disabled, true)
})

test('management panel close callbacks retain close-then-collapse behavior', () => {
  const calls = []
  const management = {
    setEditingManualDefinition: () => {},
    setShowManualInput: (value) => calls.push(['manual', value]),
    setShowPackages: (value) => calls.push(['packages', value]),
    setShowRegistry: (value) => calls.push(['registry', value]),
  }
  const panel = { collapseWorkspace: () => calls.push(['collapse']) }
  const view = interfaceManagementView({ management, panel, refs: {}, removal: {} })

  view.manual.onClose()
  view.packages.onClose()
  view.registry.onClose()

  assert.deepEqual(calls, [
    ['manual', false], ['collapse'],
    ['packages', false], ['collapse'],
    ['registry', false], ['collapse'],
  ])
})
