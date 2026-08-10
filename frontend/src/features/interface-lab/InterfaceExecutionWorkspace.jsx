import { ActionExecutionPanel } from './execution/ActionExecutionPanel.jsx'
import { ServiceExecutionPanel } from './execution/ServiceExecutionPanel.jsx'
import { TopicExecutionPanel } from './execution/TopicExecutionPanel.jsx'

export function InterfaceExecutionWorkspace({ action, service, topic }) {
  return (
    <>
      {topic.open && <TopicExecutionPanel {...topic} />}
      {service.open && <ServiceExecutionPanel {...service} />}
      {action.open && <ActionExecutionPanel {...action} />}
    </>
  )
}
