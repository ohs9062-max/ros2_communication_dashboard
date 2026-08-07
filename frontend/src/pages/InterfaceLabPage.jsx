import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { InterfaceUploadControl } from '../components/InterfaceUploadControl.jsx'
import { useInlineWorkspaceController } from '../features/interface-lab/hooks/useInlineWorkspaceController.js'
import { useInterfaceLabSnapshot } from '../features/interface-lab/hooks/useInterfaceLabSnapshot.js'
import {
  InlineWorkspace,
  InterfaceCard,
  SummaryCard,
  applyStatusLabel,
} from '../features/interface-lab/InterfaceLabWorkspace.jsx'
import {
  buildSummary,
  buildWorkspaceItems,
} from '../features/interface-lab/model/workspaceItems.js'
import {
  relatedWorkspaceItems,
} from '../features/interface-lab/model/workspacePresentation.js'

const GROUPS = [
  { id: 'all', label: '전체' },
  { id: 'messages', label: 'Message' },
  { id: 'services', label: 'Service' },
  { id: 'actions', label: 'Action' },
  { id: 'packages', label: 'Package' },
  { id: 'callable_services', label: '실행 가능 Service' },
  { id: 'callable_actions', label: '실행 가능 Action' },
  { id: 'importable', label: 'import됨' },
  { id: 'rebuild_required', label: 'build 필요' },
  { id: 'errors', label: '오류' },
]

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
  const {
    activeContinuousPublish,
    cancelAction: cancelSelectedAction,
    cancelingGoal,
    executeAction: executeSelectedAction,
    executeService: executeSelectedService,
    executing,
    goalTimeoutSec,
    goalValues,
    messageValues,
    publishGraphTopics,
    publishTopic: publishSelectedTopic,
    requestValues,
    reset: resetInlineWorkspace,
    resetTopicHistories: resetSelectedTopicHistories,
    result: inlineResult,
    selectPublishGraphTopic,
    setGoalTimeoutSec,
    setGoalValues,
    setMessageValues,
    setRequestValues,
    setTimeoutSec,
    setTopicPublishHz,
    setTopicSubscribeName,
    startContinuousTopic: startSelectedContinuousTopicPublish,
    startTopicSubscribe: startSelectedTopicSubscribe,
    stopContinuousTopic: stopSelectedContinuousTopicPublish,
    stopTopicSubscribe: stopSelectedTopicSubscribe,
    timeoutSec,
    topicPublishHz,
    topicPublishName,
    topicPublishWarning,
    topicSubscribeName,
    updateTopicPublishName,
  } = useInlineWorkspaceController({
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
    resetInlineWorkspace()
    setError(null)
    setTopicWorkbenchExpanded(false)
    setWorkbenchResetKey((value) => value + 1)
    await refresh({ notifyWorkbench: false })
  }

  return (
    <main className="interface-lab-page">
      <section className="interface-lab-hero">
        <div>
          <p className="eyebrow">Interface Lab</p>
          <h2>타입 등록, 빌드 적용, Service/Action 테스트</h2>
          <p>
            타입 등록은 “사용자가 이 타입을 쓰겠다”는 선언입니다.
            이미 설치되어 import됐고 Graph에 서버가 있는 타입만 실행 후보가 됩니다.
            Service request와 Action Goal은 사용자가 버튼을 누를 때만 전송됩니다.
          </p>
          <p className="interface-lab-note">
            단일 타입 등록만으로 없는 package, CMakeLists.txt, package.xml, 의존 msg 파일을 자동 생성하거나
            colcon build 성공을 보장하지 않습니다. 패키지 전체가 필요하면 Package zip/폴더 업로드를 사용하세요.
          </p>
          <p className="interface-lab-note">
            Interface Lab이 Publish·Receive·Service Call·Action Goal을 위해 만든
            Dashboard 내부 통신은 각 통신 탭의 Node 수에서 제외되며, 실행 이력은
            Interface Lab에 그대로 기록됩니다.
          </p>
        </div>
        <div className="interface-lab-actions">
          <button
            className="interface-reset-button"
            disabled={refreshing}
            onClick={resetInterfaceLab}
            type="button"
          >
            초기화
          </button>
          <button
            className="interface-refresh-button"
            disabled={refreshing}
            onClick={() => refresh()}
            type="button"
          >
            {refreshing ? '새로고침 중…' : '상태 새로고침'}
          </button>
          <span className="interface-refresh-meta" role="status">
            {refreshing
              ? 'registry / apply / callable 상태를 다시 읽는 중'
              : lastRefreshedAt
              ? `마지막 갱신 ${lastRefreshedAt.toLocaleTimeString()}`
              : '아직 갱신 전'}
          </span>
        </div>
      </section>

      <section className="interface-summary-grid">
        <SummaryCard label="Message" value={summary.messages} />
        <SummaryCard label="Message import됨" value={summary.callableMessages} />
        <SummaryCard label="Service" value={summary.services} />
        <SummaryCard label="Action" value={summary.actions} />
        <SummaryCard label="import됨" value={summary.importable} />
        <SummaryCard label="build 필요" value={summary.rebuildRequired} tone={summary.rebuildRequired ? 'warning' : 'success'} />
        <SummaryCard label="Package" value={summary.packages} />
        <SummaryCard label="실행 가능 Service" value={summary.callableServices} />
        <SummaryCard label="실행 가능 Action" value={summary.callableActions} />
      </section>

      <section className="interface-workbench-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Upload / Apply / Run</p>
            <h2>인터페이스 작업 도구</h2>
          </div>
          <span className={applyStatus?.real_apply_success && !summary.rebuildRequired ? 'status-pill success' : 'status-pill warning'}>
            {applyStatusLabel(applyStatus, summary.rebuildRequired > 0)}
          </span>
        </div>
        <InterfaceUploadControl
          key={workbenchResetKey}
          onStateChanged={handleWorkbenchStateChanged}
          onTopicWorkspaceExpandedChange={setTopicWorkbenchExpanded}
          refreshSignal={refreshSignal}
          websocket={websocket}
        />
        {error && <p className="interface-lab-error">{error.message}</p>}
      </section>

      {!topicWorkbenchExpanded && (
      <section className="interface-lab-layout">
        <div className="interface-registry-browser">
          <div className="interface-tabs">
            {GROUPS.map((group) => (
              <button
                className={activeGroup === group.id ? 'active' : ''}
                key={group.id}
                onClick={() => {
                  setActiveGroup(group.id)
                  setSelected(null)
                }}
                type="button"
              >
                {group.label}
              </button>
            ))}
          </div>
          <div className="interface-list-heading">
            <strong>항목 목록</strong>
            <span>{workspaceItems.length}개</span>
          </div>
          <div className="interface-card-list">
            {workspaceItems.map((item) => (
              <Fragment key={item.id}>
                <InterfaceCard
                  item={item}
                  onClick={() => {
                    setSelected((current) => current?.id === item.id ? null : item)
                    setSelectedHistoryItem(null)
                  }}
                  selected={selectedDetail?.id === item.id}
                />
                {selectedDetail?.id === item.id && (
                  <InlineWorkspace
                    cancelingGoal={cancelingGoal}
                    executing={executing}
                    goalTimeoutSec={goalTimeoutSec}
                    goalValues={goalValues}
                    inlineResult={inlineResult}
                    item={selectedDetail}
                    onActionExecute={executeSelectedAction}
                    onActionCancel={cancelSelectedAction}
                    onGoalChange={setGoalValues}
                    onHistorySelect={setSelectedHistoryItem}
                    onMessageChange={setMessageValues}
                    onRelatedSelect={(nextItem) => {
                      setSelected(nextItem)
                      setSelectedHistoryItem(null)
                    }}
                    onRequestChange={setRequestValues}
                    onTopicPublish={publishSelectedTopic}
                    onTopicContinuousStart={startSelectedContinuousTopicPublish}
                    onTopicContinuousStop={stopSelectedContinuousTopicPublish}
                    onServiceExecute={executeSelectedService}
                    onTopicReset={resetSelectedTopicHistories}
                    onTopicSubscribeStart={startSelectedTopicSubscribe}
                    onTopicSubscribeStop={stopSelectedTopicSubscribe}
                    relatedItems={relatedItems}
                    messageValues={messageValues}
                    requestValues={requestValues}
                    selectedHistoryItem={selectedHistoryItem}
                    setGoalTimeoutSec={setGoalTimeoutSec}
                    setTopicPublishName={updateTopicPublishName}
                    setTopicPublishHz={setTopicPublishHz}
                    selectPublishGraphTopic={selectPublishGraphTopic}
                    setTopicSubscribeName={setTopicSubscribeName}
                    setTimeoutSec={setTimeoutSec}
                    topicPublishName={topicPublishName}
                    topicPublishHz={topicPublishHz}
                    activeContinuousPublish={activeContinuousPublish}
                    publishGraphTopics={publishGraphTopics}
                    topicPublishWarning={topicPublishWarning}
                    topicSubscribeName={topicSubscribeName}
                    timeoutSec={timeoutSec}
                  />
                )}
              </Fragment>
            ))}
            {!workspaceItems.length && (
              <p className="muted">표시할 항목이 없습니다.</p>
            )}
          </div>
        </div>
      </section>
      )}
    </main>
  )
}
