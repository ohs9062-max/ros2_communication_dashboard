import { InterfaceExecutionWorkspace } from './InterfaceExecutionWorkspace.jsx'
import {
  BuildFailurePanel,
  RegisteredInterfacesPanel,
  UploadedPackagesPanel,
} from './InterfaceManagementPanels.jsx'
import { ManualInterfacePanel } from './InterfaceManualPanel.jsx'
import { InterfaceReceiveWorkspace } from './InterfaceReceiveWorkspace.jsx'
import { InterfaceUploadToolbar } from './InterfaceUploadToolbar.jsx'

export function InterfaceUploadView({
  actionExecution,
  buildFailure,
  expanded,
  manual,
  packages,
  receive,
  registry,
  serviceExecution,
  toolbar,
  topicExecution,
}) {
  const { visible: buildFailureVisible, ...buildFailureProps } = buildFailure

  return (
    <div className={expanded ? 'interface-upload-control topic-workbench-expanded' : 'interface-upload-control'}>
      <InterfaceUploadToolbar {...toolbar} />
      {manual.open && <ManualInterfacePanel {...manual} />}
      <InterfaceReceiveWorkspace {...receive} />
      {buildFailureVisible && <BuildFailurePanel {...buildFailureProps} />}
      {registry.open && <RegisteredInterfacesPanel {...registry} />}
      {packages.open && <UploadedPackagesPanel {...packages} />}
      <InterfaceExecutionWorkspace
        action={actionExecution}
        service={serviceExecution}
        topic={topicExecution}
      />
    </div>
  )
}
