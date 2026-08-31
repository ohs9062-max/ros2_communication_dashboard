export const EXECUTION_MODES = [
  'topic', 'service', 'action',
  'service_server', 'action_server', 'server_list',
]

export function isExecutionMode(mode) {
  return EXECUTION_MODES.includes(mode)
}

export function executionLoader(mode, loaders) {
  return loaders?.[mode]
}

export function closeExecutionPanel({ requestRef, setBusy, setExecutionMode }) {
  requestRef.current += 1
  setBusy(false)
  setExecutionMode(null)
}

export async function runExecutionPanelLoad({
  hideManagementPanels,
  keepOpen = false,
  loaders,
  mode,
  target = null,
  isCurrent = () => true,
  setBusy,
  setExecutionMode,
  setFeedback,
}) {
  const loader = executionLoader(mode, loaders)
  if (!loader) return false

  setBusy(true)
  try {
    await loader(target ? { target } : undefined)
    if (!isCurrent()) return false
    setExecutionMode(mode)
    if (!keepOpen) hideManagementPanels()
    return true
  } catch (error) {
    if (isCurrent()) setFeedback({ tone: 'error', text: error.message })
    return false
  } finally {
    if (isCurrent()) setBusy(false)
  }
}

export function isWorkspaceExpanded({
  executionMode,
  receiveMode,
  showManualInput,
  showPackages,
  showReceivePanel,
  showRegistry,
  workspaceExpanded,
}) {
  return Boolean(workspaceExpanded && (
    showManualInput
    || showRegistry
    || showPackages
    || (showReceivePanel && receiveMode !== 'mock')
    || executionMode === 'service_server'
    || executionMode === 'action_server'
    || executionMode === 'server_list'
  ))
}
