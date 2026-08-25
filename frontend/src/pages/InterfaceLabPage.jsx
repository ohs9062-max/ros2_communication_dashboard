import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInlineWorkspaceController } from '../features/interface-lab/hooks/useInlineWorkspaceController.js'
import { useInterfaceLabSnapshot } from '../features/interface-lab/hooks/useInterfaceLabSnapshot.js'
import { InterfaceLabManagementOverview } from '../features/interface-lab/InterfaceLabManagementOverview.jsx'
import { InterfaceLabWorkspaceBrowser } from '../features/interface-lab/InterfaceLabWorkspaceBrowser.jsx'
import {
  buildSummary,
  buildWorkspaceItems,
} from '../features/interface-lab/model/workspaceItems.js'
import {
  relatedWorkspaceItems,
} from '../features/interface-lab/model/workspacePresentation.js'

export function InterfaceLabPage({ websocket }) {
  const {
    lastRefreshedAt,
    refreshing,
    refreshSnapshot,
    snapshot: {
      actionHistory, applyStatus, callableActions, callableMessages, callableServices,
      continuousTopicPublishes, graphActions, graphServices, packages, receiveTopics,
      registry, serviceHistory, topicPublishHistory, topicReceiveHistory, topics,
    },
    updateSnapshotField,
  } = useInterfaceLabSnapshot()
  const [activeGroup, setActiveGroup] = useState('all')
  const [selected, setSelected] = useState(null)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null)
  const [error, setError] = useState(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [workbenchResetKey, setWorkbenchResetKey] = useState(0)
  const [topicWorkbenchExpanded, setTopicWorkbenchExpanded] = useState(false)
  const [executionRequest, setExecutionRequest] = useState(null)

  const refresh = useCallback(async ({ notifyWorkbench = true } = {}) => {
    setError(await refreshSnapshot())
    if (notifyWorkbench) setRefreshSignal((value) => value + 1)
  }, [refreshSnapshot])

  const handleWorkbenchStateChanged = () => {
    refresh({ notifyWorkbench: false })
  }

  useEffect(() => {
    refresh()
  }, [refresh])

  const summary = useMemo(() => buildSummary({
    registry,
    callableActions,
    callableMessages,
    callableServices,
    graphActions,
    graphServices,
    packages,
  }), [registry, callableActions, callableMessages, callableServices, graphActions, graphServices, packages])
  const workspaceItems = useMemo(() => buildWorkspaceItems({
    actionHistory,
    callableActions,
    callableMessages,
    callableServices,
    filter: activeGroup,
    graphActions,
    graphServices,
    packages,
    registry,
    receiveTopics,
    serviceHistory,
    topicPublishHistory,
    topicReceiveHistory,
    topics,
  }), [actionHistory, activeGroup, callableActions, callableMessages, callableServices, graphActions, graphServices, packages, receiveTopics, registry, serviceHistory, topicPublishHistory, topicReceiveHistory, topics])
  const selectedDetail = workspaceItems.find((item) => item.id === selected?.id)
    ?? workspaceItems.find((item) => item.stableKey === selected?.stableKey)
    ?? null
  const inlineWorkspaceController = useInlineWorkspaceController({
    continuousTopicPublishes,
    refresh,
    selectedDetail,
    topics,
    updateSnapshotField,
  })
  const relatedItems = useMemo(
    () => relatedWorkspaceItems(selectedDetail, workspaceItems),
    [selectedDetail, workspaceItems],
  )

  useEffect(() => {
    setSelectedHistoryItem(null)
  }, [selectedDetail?.stableKey])

  const resetInterfaceLab = async () => {
    setActiveGroup('all')
    setSelected(null)
    setSelectedHistoryItem(null)
    inlineWorkspaceController.reset()
    setError(null)
    setTopicWorkbenchExpanded(false)
    setWorkbenchResetKey((value) => value + 1)
    await refresh({ notifyWorkbench: false })
  }

  return (
    <main className="interface-lab-page">
      <InterfaceLabManagementOverview
        applyStatus={applyStatus}
        error={error}
        executionRequest={executionRequest}
        lastRefreshedAt={lastRefreshedAt}
        onRefresh={() => refresh()}
        onReset={resetInterfaceLab}
        onStateChanged={handleWorkbenchStateChanged}
        onTopicWorkspaceExpandedChange={setTopicWorkbenchExpanded}
        refreshing={refreshing}
        refreshSignal={refreshSignal}
        summary={summary}
        websocket={websocket}
        workbenchResetKey={workbenchResetKey}
      />

      {!topicWorkbenchExpanded && (
      <InterfaceLabWorkspaceBrowser
        activeGroup={activeGroup}
        controller={inlineWorkspaceController}
        onGroupChange={(group) => {
          setActiveGroup(group)
          setSelected(null)
        }}
        onHistorySelect={setSelectedHistoryItem}
        onExecute={(item) => setExecutionRequest({
          id: Date.now(),
          kind: item.kind,
          target: executionTarget(item),
        })}
        onRelatedSelect={(nextItem) => {
          setSelected(nextItem)
          setSelectedHistoryItem(null)
        }}
        onSelect={(item) => {
          setSelected((current) => current?.id === item.id ? null : item)
          setSelectedHistoryItem(null)
        }}
        relatedItems={relatedItems}
        selectedDetail={selectedDetail}
        selectedHistoryItem={selectedHistoryItem}
        workspaceItems={workspaceItems}
      />
      )}
    </main>
  )
}

function executionTarget(item) {
  const kind = item.kind === 'callable_service' ? 'service'
    : item.kind === 'callable_action' ? 'action'
    : item.kind
  const candidates = kind === 'message'
    ? item.connectedTopics ?? []
    : kind === 'service'
    ? item.connectedServices ?? []
    : kind === 'action'
    ? item.connectedActions ?? []
    : []
  if (candidates.length !== 1) return null

  const resource = candidates[0]
  const name = kind === 'message'
    ? resource.name ?? resource.topic_name
    : kind === 'service'
    ? resource.service_name
    : resource.action_name
  if (!name || resource.domain_id === null || resource.domain_id === undefined) return null
  return {
    domainId: resource.domain_id,
    fullType: item.fullType,
    name,
    resourceKey: resource.resource_key ?? `${resource.domain_id}:${name}`,
  }
}
