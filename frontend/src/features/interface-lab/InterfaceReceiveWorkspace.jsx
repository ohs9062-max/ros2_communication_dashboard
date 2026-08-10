import { InterfaceReceiveWorkbench } from './receive/InterfaceReceiveWorkbench.jsx'
import { ResourceReceivePanel } from './receive/ResourceReceivePanel.jsx'
import { TopicReceivePanel } from './receive/TopicReceivePanel.jsx'

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
      {mode === 'service' && <ResourceReceivePanel {...service} kind="service" />}
      {mode === 'action' && <ResourceReceivePanel {...action} kind="action" />}
    </InterfaceReceiveWorkbench>
  )
}
