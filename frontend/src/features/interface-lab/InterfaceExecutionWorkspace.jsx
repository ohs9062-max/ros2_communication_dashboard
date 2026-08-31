import { ActionExecutionPanel } from './execution/ActionExecutionPanel.jsx'
import { ServiceExecutionPanel } from './execution/ServiceExecutionPanel.jsx'
import { TopicExecutionPanel } from './execution/TopicExecutionPanel.jsx'
import { ActionServerPanel } from './server/ActionServerPanel.jsx'
import { ServiceServerPanel } from './server/ServiceServerPanel.jsx'
import { ServerListPanel } from './server/ServerListPanel.jsx'

export function InterfaceExecutionWorkspace({
  action,
  actionServer,
  service,
  serviceServer,
  serverList,
  topic,
}) {
  return (
    <>
      {topic?.open && <TopicExecutionPanel {...topic} />}
      {service?.open && <ServiceExecutionPanel {...service} />}
      {action?.open && <ActionExecutionPanel {...action} />}
      {serviceServer?.open && <ServiceServerPanel {...serviceServer} />}
      {actionServer?.open && <ActionServerPanel {...actionServer} />}
      {serverList?.open && <ServerListPanel {...serverList} />}
    </>
  )
}
