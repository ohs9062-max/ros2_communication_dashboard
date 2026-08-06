import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InterfaceUploadControl } from '../components/InterfaceUploadControl.jsx'
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
  defaultValues,
  normalizeNumericValues,
  relatedWorkspaceItems,
} from '../features/interface-lab/interfaceLabModel.js'
import {
  graphPublishTopicCandidates,
  topicNameTypeWarning,
} from '../utils/interfaceTopics.js'
import {
  callRegisteredService,
  cancelActionGoal,
  fetchContinuousTopicPublishes,
  publishTopicMessage,
  resetReceiveTopicHistory,
  resetTopicPublishHistory,
  sendActionGoal,
  startReceiveTopic,
  startContinuousTopicPublish,
  stopContinuousTopicPublish,
  stopReceiveTopic,
} from '../api/interfaceExecution.js'

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
  const [requestValues, setRequestValues] = useState({})
  const [goalValues, setGoalValues] = useState({})
  const [messageValues, setMessageValues] = useState({})
  const [topicPublishName, setTopicPublishName] = useState('')
  const [topicPublishHz, setTopicPublishHz] = useState(10)
  const [topicSubscribeName, setTopicSubscribeName] = useState('')
  const topicPublishNameSourceRef = useRef('empty')
  const [timeoutSec, setTimeoutSec] = useState(2)
  const [goalTimeoutSec, setGoalTimeoutSec] = useState(10)
  const [cancelingGoal, setCancelingGoal] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [inlineResult, setInlineResult] = useState(null)
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

  const resetInterfaceLab = async () => {
    setActiveGroup('all')
    setSelected(null)
    setSelectedHistoryItem(null)
    setRequestValues({})
    setGoalValues({})
    setMessageValues({})
    topicPublishNameSourceRef.current = 'empty'
    setTopicPublishName('')
    setTopicPublishHz(10)
    setTopicSubscribeName('')
    setTimeoutSec(2)
    setGoalTimeoutSec(10)
    setInlineResult(null)
    setError(null)
    setTopicWorkbenchExpanded(false)
    setWorkbenchResetKey((value) => value + 1)
    await refresh({ notifyWorkbench: false })
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
  const publishGraphTopics = useMemo(
    () => graphPublishTopicCandidates(topics, selectedDetail?.fullType),
    [selectedDetail?.fullType, topics],
  )
  const selectedMessageDefaultTopic = selectedDetail?.connectedTopics?.[0]?.name
    ?? selectedDetail?.topicStates?.[0]?.topic_name
    ?? ''
  const topicPublishWarning = topicNameTypeWarning(
    topics,
    topicPublishName,
    selectedDetail?.fullType,
  )
  const activeContinuousPublish = continuousTopicPublishes.find((item) =>
    item.active
    && item.topic_name === topicPublishName
    && item.topic_type === selectedDetail?.fullType)
  const activeContinuousPublishKey = activeContinuousPublish
    ? `${activeContinuousPublish.topic_name}\u0000${activeContinuousPublish.topic_type}`
    : ''
  const relatedItems = useMemo(
    () => relatedWorkspaceItems(selectedDetail, workspaceItems),
    [selectedDetail, workspaceItems],
  )

  useEffect(() => {
    if (!activeContinuousPublishKey) return undefined
    const timer = window.setInterval(async () => {
      try {
        const payload = await fetchContinuousTopicPublishes()
        updateSnapshotField('continuousTopicPublishes', payload.data ?? [])
      } catch {
        // Explicit actions and the regular refresh surface connection errors.
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeContinuousPublishKey, updateSnapshotField])

  useEffect(() => {
    setSelectedHistoryItem(null)
    setInlineResult(null)
    if (selectedDetail?.kind === 'service' || selectedDetail?.kind === 'callable_service') {
      setRequestValues(defaultValues(selectedDetail.schema ?? []))
    } else if (selectedDetail?.kind === 'action' || selectedDetail?.kind === 'callable_action') {
      setGoalValues(defaultValues(selectedDetail.schema ?? []))
    } else if (selectedDetail?.kind === 'message') {
      setMessageValues(defaultValues(selectedDetail.schema ?? []))
      setTopicSubscribeName(selectedMessageDefaultTopic)
    }
  }, [selectedDetail?.kind, selectedDetail?.schema, selectedDetail?.stableKey, selectedMessageDefaultTopic])

  useEffect(() => {
    if (selectedDetail?.kind !== 'message') return
    const currentName = topicPublishName.trim()
    const currentIsCandidate = publishGraphTopics.some((topic) => topic.name === currentName)
    const source = topicPublishNameSourceRef.current

    if (source === 'user') {
      if (currentName) return
    } else if (source === 'graph') {
      if (currentIsCandidate) return
      topicPublishNameSourceRef.current = 'empty'
      setTopicPublishName('')
      return
    } else if (source === 'auto' && publishGraphTopics.length !== 1) {
      topicPublishNameSourceRef.current = 'empty'
      setTopicPublishName('')
      return
    }

    if (publishGraphTopics.length === 1) {
      const nextName = publishGraphTopics[0].name
      if (source === 'auto' && currentName === nextName) return
      topicPublishNameSourceRef.current = 'auto'
      setTopicPublishName(nextName)
    }
  }, [publishGraphTopics, selectedDetail?.kind, selectedDetail?.fullType, topicPublishName])

  const updateTopicPublishName = (value) => {
    topicPublishNameSourceRef.current = value ? 'user' : 'empty'
    setTopicPublishName(value)
  }

  const selectPublishGraphTopic = (value) => {
    topicPublishNameSourceRef.current = value ? 'graph' : 'empty'
    setTopicPublishName(value)
  }

  const executeSelectedService = async () => {
    const target = selectedDetail?.connectedServices?.find((service) => service.callable)
      ?? (selectedDetail?.kind === 'callable_service' ? selectedDetail.status : null)
    if (!target?.service_name || !target?.service_type) {
      setInlineResult({ success: false, error: '호출 가능한 Service가 없습니다.' })
      return
    }
    setExecuting(true)
    setInlineResult(null)
    try {
      const result = await callRegisteredService({
        service_name: target.service_name,
        service_type: target.service_type,
        request: normalizeNumericValues(requestValues, selectedDetail.schema),
        timeout_sec: timeoutSec,
      })
      setInlineResult(result)
      await refresh({ notifyWorkbench: false })
    } catch (nextError) {
      setInlineResult({ success: false, error: nextError.message, sent_to_server: false })
    } finally {
      setExecuting(false)
    }
  }

  const executeSelectedAction = async () => {
    const target = selectedDetail?.connectedActions?.find((action) => action.callable)
      ?? (selectedDetail?.kind === 'callable_action' ? selectedDetail.status : null)
    if (!target?.action_name || !target?.action_type) {
      setInlineResult({ success: false, accepted: false, error: '실행 가능한 Action이 없습니다.' })
      return
    }
    setExecuting(true)
    setInlineResult(null)
    try {
      const result = await sendActionGoal({
        action_name: target.action_name,
        action_type: target.action_type,
        full_type: target.full_type ?? target.selected_import_type ?? target.action_type,
        goal: normalizeNumericValues(goalValues, selectedDetail.schema),
        timeout_sec: goalTimeoutSec,
      })
      setInlineResult(result)
      await refresh({ notifyWorkbench: false })
    } catch (nextError) {
      setInlineResult({ success: false, accepted: false, error: nextError.message, sent_to_server: false })
    } finally {
      setExecuting(false)
    }
  }

  const cancelSelectedAction = async () => {
    const target = selectedDetail?.connectedActions?.find((action) => action.callable)
      ?? (selectedDetail?.kind === 'callable_action' ? selectedDetail.status : null)
    if (!target?.action_name || !target?.action_type) return
    setCancelingGoal(true)
    try {
      const result = await cancelActionGoal({
        action_name: target.action_name,
        action_type: target.action_type,
        timeout_sec: goalTimeoutSec,
      })
      setInlineResult(result)
      await refresh({ notifyWorkbench: false })
    } catch (nextError) {
      setInlineResult({ success: false, error: nextError.message, error_type: 'cancel_failed' })
    } finally {
      setCancelingGoal(false)
    }
  }

  const publishSelectedTopic = async () => {
    if (!selectedDetail?.fullType) {
      setInlineResult({ success: false, error: 'Message full_type이 없습니다.' })
      return
    }
    if (!topicPublishName) {
      setInlineResult({ success: false, error: 'Publish할 Topic 이름을 입력하세요.' })
      return
    }
    setExecuting(true)
    setInlineResult(null)
    try {
      const result = await publishTopicMessage({
        topic_name: topicPublishName,
        topic_type: selectedDetail.fullType,
        full_type: selectedDetail.fullType,
        message: normalizeNumericValues(messageValues, selectedDetail.schema),
      })
      setInlineResult(result)
      await refresh({ notifyWorkbench: false })
    } catch (nextError) {
      setInlineResult({ success: false, error: nextError.message, sent_to_topic: false })
    } finally {
      setExecuting(false)
    }
  }

  const startSelectedContinuousTopicPublish = async () => {
    if (!selectedDetail?.fullType || !topicPublishName) {
      setInlineResult({ success: false, error: 'Message full_type과 Publish Topic 이름이 필요합니다.' })
      return
    }
    setExecuting(true)
    setInlineResult(null)
    try {
      const result = await startContinuousTopicPublish({
        topic_name: topicPublishName,
        topic_type: selectedDetail.fullType,
        full_type: selectedDetail.fullType,
        message: normalizeNumericValues(messageValues, selectedDetail.schema),
        hz: Number(topicPublishHz),
      })
      setInlineResult(result)
      await refresh({ notifyWorkbench: false })
    } catch (nextError) {
      setInlineResult({ success: false, error: nextError.message, sent_to_topic: false })
    } finally {
      setExecuting(false)
    }
  }

  const stopSelectedContinuousTopicPublish = async () => {
    if (!selectedDetail?.fullType || !topicPublishName) return
    setExecuting(true)
    try {
      const result = await stopContinuousTopicPublish({
        topic_name: topicPublishName,
        topic_type: selectedDetail.fullType,
      })
      setInlineResult(result)
      await refresh({ notifyWorkbench: false })
    } catch (nextError) {
      setInlineResult({ success: false, error: nextError.message })
    } finally {
      setExecuting(false)
    }
  }

  const startSelectedTopicSubscribe = async () => {
    if (!selectedDetail?.fullType || !topicSubscribeName) {
      setInlineResult({ success: false, error: 'Topic 이름과 Message full_type이 필요합니다.' })
      return
    }
    try {
      const result = await startReceiveTopic({
        topic_name: topicSubscribeName,
        topic_type: selectedDetail.fullType,
        full_type: selectedDetail.fullType,
        history_limit: 500,
      })
      setInlineResult(result)
      await refresh({ notifyWorkbench: false })
    } catch (nextError) {
      setInlineResult({ success: false, error: nextError.message })
    }
  }

  const stopSelectedTopicSubscribe = async () => {
    if (!selectedDetail?.fullType || !topicSubscribeName) return
    try {
      const result = await stopReceiveTopic({
        topic_name: topicSubscribeName,
        topic_type: selectedDetail.fullType,
        full_type: selectedDetail.fullType,
      })
      setInlineResult(result)
      await refresh({ notifyWorkbench: false })
    } catch (nextError) {
      setInlineResult({ success: false, error: nextError.message })
    }
  }

  const resetSelectedTopicHistories = async () => {
    const payload = selectedDetail?.fullType && topicSubscribeName
      ? { topicName: topicSubscribeName, topicType: selectedDetail.fullType }
      : {}
    await Promise.all([
      resetReceiveTopicHistory(payload.topicName, payload.topicType),
      resetTopicPublishHistory(
        payload.topicName
          ? { topic_name: payload.topicName, topic_type: payload.topicType }
          : {},
      ),
    ])
    setInlineResult({ success: true, message: 'Topic 수신 항목과 Publish/Subscribe 이력을 초기화했습니다.' })
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
