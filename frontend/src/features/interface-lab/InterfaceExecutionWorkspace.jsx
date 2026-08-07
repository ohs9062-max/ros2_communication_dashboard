import {
  ActionExecutionPanel,
  ServiceExecutionPanel,
  TopicExecutionPanel,
} from './InterfaceExecutionPanels.jsx'

export function InterfaceExecutionWorkspace({ action, service, topic }) {
  return (
    <>
      {topic.open && <TopicExecutionPanel {...topic} />}
      {service.open && <ServiceExecutionPanel {...service} />}
      {action.open && <ActionExecutionPanel {...action} />}
    </>
  )
}
