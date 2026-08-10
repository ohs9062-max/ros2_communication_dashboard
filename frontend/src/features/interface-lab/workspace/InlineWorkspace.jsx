import {
  sourceLabel,
} from '../model/workspacePresentation.js'
import { ActionWorkspaceDetail } from './ActionWorkspaceDetail.jsx'
import { ServiceWorkspaceDetail } from './ServiceWorkspaceDetail.jsx'
import { TopicWorkspaceDetail } from './TopicWorkspaceDetail.jsx'
import {
  CollapsibleJson,
  CollapsibleText,
} from './WorkspaceShared.jsx'

export function InlineWorkspace({
  activeContinuousPublish,
  cancelingGoal,
  executing,
  goalTimeoutSec,
  goalValues,
  inlineResult,
  item,
  onActionExecute,
  onActionCancel,
  onGoalChange,
  onHistorySelect,
  onMessageChange,
  onRelatedSelect,
  onRequestChange,
  onServiceExecute,
  onTopicPublish,
  onTopicContinuousStart,
  onTopicContinuousStop,
  onTopicReset,
  onTopicSubscribeStart,
  onTopicSubscribeStop,
  relatedItems,
  messageValues,
  requestValues,
  selectedHistoryItem,
  selectPublishGraphTopic,
  setGoalTimeoutSec,
  setTopicPublishName,
  setTopicPublishHz,
  setTopicSubscribeName,
  setTimeoutSec,
  topicPublishName,
  topicPublishHz,
  publishGraphTopics,
  topicPublishWarning,
  topicSubscribeName,
  timeoutSec,
}) {
  const showDetail = item.kind !== 'package'
  return (
    <div className="interface-inline-workspace">
      {item.kind === 'package' && (
        <>
          <div className="interface-inline-heading">
            <strong>{item.title} 연결 항목</strong>
            <span>Service / Action을 누르면 여기서 바로 상세와 실행 폼을 봅니다.</span>
          </div>
          <div className="interface-related-grid">
            {relatedItems.length ? relatedItems.map((related) => (
              <button
                key={related.id}
                onClick={() => onRelatedSelect(related)}
                type="button"
              >
                <strong>{related.title}</strong>
                <span>{related.fullType}</span>
                <small>
                  {related.serverAvailable ? '서버 있음' : '서버 없음'}
                  {' · '}
                  {related.callable ? '실행 가능' : related.reason ?? '실행 대기'}
                </small>
              </button>
            )) : <p className="muted">연결된 Service/Action 항목이 없습니다.</p>}
          </div>
        </>
      )}
      {showDetail && (
        <InterfaceDetailPanel
          cancelingGoal={cancelingGoal}
          activeContinuousPublish={activeContinuousPublish}
          executing={executing}
          goalTimeoutSec={goalTimeoutSec}
          goalValues={goalValues}
          inlineResult={inlineResult}
          item={item}
          onActionExecute={onActionExecute}
          onActionCancel={onActionCancel}
          onGoalChange={onGoalChange}
          onHistorySelect={onHistorySelect}
          onMessageChange={onMessageChange}
          onRequestChange={onRequestChange}
          onServiceExecute={onServiceExecute}
          onTopicPublish={onTopicPublish}
          onTopicContinuousStart={onTopicContinuousStart}
          onTopicContinuousStop={onTopicContinuousStop}
          onTopicReset={onTopicReset}
          onTopicSubscribeStart={onTopicSubscribeStart}
          onTopicSubscribeStop={onTopicSubscribeStop}
          messageValues={messageValues}
          requestValues={requestValues}
          selectedHistoryItem={selectedHistoryItem}
          selectPublishGraphTopic={selectPublishGraphTopic}
          setGoalTimeoutSec={setGoalTimeoutSec}
          setTopicPublishName={setTopicPublishName}
          setTopicPublishHz={setTopicPublishHz}
          setTopicSubscribeName={setTopicSubscribeName}
          setTimeoutSec={setTimeoutSec}
          topicPublishName={topicPublishName}
          topicPublishHz={topicPublishHz}
          publishGraphTopics={publishGraphTopics}
          topicPublishWarning={topicPublishWarning}
          topicSubscribeName={topicSubscribeName}
          timeoutSec={timeoutSec}
        />
      )}
    </div>
  )
}

function InterfaceDetailPanel({
  activeContinuousPublish,
  cancelingGoal,
  executing,
  goalTimeoutSec,
  goalValues,
  inlineResult,
  item,
  onActionExecute,
  onActionCancel,
  onGoalChange,
  onHistorySelect,
  onMessageChange,
  onRequestChange,
  onServiceExecute,
  onTopicPublish,
  onTopicContinuousStart,
  onTopicContinuousStop,
  onTopicReset,
  onTopicSubscribeStart,
  onTopicSubscribeStop,
  messageValues,
  requestValues,
  selectedHistoryItem,
  selectPublishGraphTopic,
  setGoalTimeoutSec,
  setTopicPublishName,
  setTopicPublishHz,
  setTopicSubscribeName,
  setTimeoutSec,
  topicPublishName,
  topicPublishHz,
  publishGraphTopics,
  topicPublishWarning,
  topicSubscribeName,
  timeoutSec,
}) {
  if (!item) {
    return (
      <aside className="interface-detail-panel">
        <h3>상세</h3>
        <p className="muted">항목을 선택하세요.</p>
      </aside>
    )
  }
  return (
    <aside className="interface-detail-panel">
      <h3>{item.title}</h3>
      <dl>
        <dt>source</dt>
        <dd>{(item.sources?.length ? item.sources : [item.source]).filter(Boolean).map(sourceLabel).join(', ')}</dd>
        <dt>full type</dt>
        <dd>{item.fullType ?? '-'}</dd>
        <dt>package</dt>
        <dd>{item.packageName ?? '-'}</dd>
        <dt>import</dt>
        <dd>{item.importAvailable === null ? '-' : item.importAvailable ? 'import됨' : 'import 안됨'}</dd>
        <dt>build</dt>
        <dd>{item.rebuildRequired ? 'build 필요' : '빌드 반영/대기'}</dd>
        <dt>server</dt>
        <dd>{item.serverAvailable === null ? '-' : item.serverAvailable ? '서버 있음' : '서버 없음'}</dd>
        <dt>callable</dt>
        <dd>{item.callable === null ? '-' : item.callable ? '실행 가능' : item.reason ?? '실행 불가'}</dd>
        {item.error && (
          <>
            <dt>error</dt>
            <dd>{item.error}</dd>
          </>
        )}
      </dl>
      <CollapsibleJson title="상태 상세" value={item.status ?? {}} />
      <CollapsibleJson title="parsed / schema" value={item.parsed ?? item.schema ?? {}} />
      <CollapsibleText title="raw_text" value={item.raw_text ?? ''} />
      {item.kind === 'message' && (
        <TopicWorkspaceDetail
          activeContinuousPublish={activeContinuousPublish}
          executing={executing}
          inlineResult={inlineResult}
          item={item}
          messageValues={messageValues}
          onHistorySelect={onHistorySelect}
          onMessageChange={onMessageChange}
          onPublish={onTopicPublish}
          onContinuousStart={onTopicContinuousStart}
          onContinuousStop={onTopicContinuousStop}
          onReset={onTopicReset}
          onSubscribeStart={onTopicSubscribeStart}
          onSubscribeStop={onTopicSubscribeStop}
          selectedHistoryItem={selectedHistoryItem}
          selectPublishGraphTopic={selectPublishGraphTopic}
          setTopicPublishName={setTopicPublishName}
          setTopicPublishHz={setTopicPublishHz}
          setTopicSubscribeName={setTopicSubscribeName}
          topicPublishName={topicPublishName}
          topicPublishHz={topicPublishHz}
          publishGraphTopics={publishGraphTopics}
          topicPublishWarning={topicPublishWarning}
          topicSubscribeName={topicSubscribeName}
        />
      )}
      {(item.kind === 'service' || item.kind === 'callable_service') && (
        <ServiceWorkspaceDetail
          executing={executing}
          inlineResult={inlineResult}
          item={item}
          onExecute={onServiceExecute}
          onHistorySelect={onHistorySelect}
          onRequestChange={onRequestChange}
          requestValues={requestValues}
          selectedHistoryItem={selectedHistoryItem}
          setTimeoutSec={setTimeoutSec}
          timeoutSec={timeoutSec}
        />
      )}
      {(item.kind === 'action' || item.kind === 'callable_action') && (
        <ActionWorkspaceDetail
          cancelingGoal={cancelingGoal}
          executing={executing}
          goalTimeoutSec={goalTimeoutSec}
          goalValues={goalValues}
          inlineResult={inlineResult}
          item={item}
          onExecute={onActionExecute}
          onCancel={onActionCancel}
          onGoalChange={onGoalChange}
          onHistorySelect={onHistorySelect}
          selectedHistoryItem={selectedHistoryItem}
          setGoalTimeoutSec={setGoalTimeoutSec}
        />
      )}
    </aside>
  )
}
