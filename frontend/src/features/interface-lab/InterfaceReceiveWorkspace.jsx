import {
  ActionReceivePanel,
  InterfaceReceiveWorkbench,
  ServiceReceivePanel,
  TopicReceivePanel,
} from './InterfaceReceivePanels.jsx'

export function InterfaceReceiveWorkspace({
  action,
  expanded,
  mode,
  onModeChange,
  onToggleExpanded,
  open,
  service,
  topic,
}) {
  if (!open) return null

  return (
    <InterfaceReceiveWorkbench
      expanded={expanded}
      mode={mode}
      onModeChange={onModeChange}
      onToggleExpanded={onToggleExpanded}
    >
      {mode === 'topic' && <TopicReceivePanel {...topic} />}
      {mode === 'service' && <ServiceReceivePanel {...service} />}
      {mode === 'action' && <ActionReceivePanel {...action} />}
    </InterfaceReceiveWorkbench>
  )
}
