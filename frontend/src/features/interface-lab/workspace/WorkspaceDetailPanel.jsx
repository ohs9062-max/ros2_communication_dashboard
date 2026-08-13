import { useEffect, useState } from 'react'

import { sourceLabel } from '../model/workspacePresentation.js'
import {
  communicationSnapshot,
  connectionCount,
  defaultDetailView,
  detailTabs,
} from '../model/workspaceDetailModel.js'
import { ActionWorkspaceDetail } from './ActionWorkspaceDetail.jsx'
import { ServiceWorkspaceDetail } from './ServiceWorkspaceDetail.jsx'
import { TopicWorkspaceDetail } from './TopicWorkspaceDetail.jsx'
import { CollapsibleJson, CollapsibleText } from './WorkspaceShared.jsx'

export function WorkspaceDetailPanel({
  activeContinuousPublish,
  actionQosControls,
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
  onOpenExecution,
  onMessageChange,
  onRequestChange,
  onServiceExecute,
  onServiceRequestQosModeChange,
  onServiceRequestQosProfileChange,
  onServiceResponseQosModeChange,
  onServiceResponseQosProfileChange,
  onTopicPublish,
  onTopicContinuousStart,
  onTopicContinuousStop,
  onTopicReset,
  onServiceActionReset,
  onTopicSubscribeStart,
  onTopicSubscribeStop,
  onTopicPublishQosModeChange,
  onTopicPublishQosProfileChange,
  onTopicSubscribeQosModeChange,
  onTopicSubscribeQosProfileChange,
  messageValues,
  requestValues,
  selectedHistoryItem,
  serviceRequestQosMode,
  serviceRequestQosProfile,
  serviceResponseQosMode,
  serviceResponseQosProfile,
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
  topicPublishQosMode,
  topicPublishQosProfile,
  topicSubscribeQosMode,
  topicSubscribeQosProfile,
  topicSubscribeName,
  timeoutSec,
}) {
  const [activeView, setActiveView] = useState(() => defaultDetailView(item?.kind))
  useEffect(() => setActiveView(defaultDetailView(item?.kind)), [item?.id, item?.kind])

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
      <div className="interface-basic-status">
        <span>{item.callable ? '실행 가능' : item.rebuildRequired ? 'build 필요' : item.error ? '오류' : '등록됨'}</span>
        <p>{item.reason ?? item.error ?? 'Interface를 선택했습니다.'}</p>
      </div>
      <div className="interface-detail-tabs" role="tablist" aria-label="상세 기능">
        {detailTabs(item.kind).map((tab) => (
          <button className={activeView === tab.id ? 'active' : ''} key={tab.id} onClick={() => tab.id === 'open-execution' ? onOpenExecution() : setActiveView(tab.id)} role="tab" type="button">{tab.label}</button>
        ))}
      </div>
      {activeView === 'details' && (
        <section className="interface-communication-details">
          <h4>통신 및 QoS 상세</h4>
          <dl>
            <dt>타입</dt><dd>{item.fullType ?? '-'}</dd>
            <dt>Graph 연결</dt><dd>{connectionCount(item)}개</dd>
            <dt>서버 상태</dt><dd>{item.serverAvailable === null ? '해당 없음' : item.serverAvailable ? '서버 있음' : '서버 없음'}</dd>
            <dt>실행 상태</dt><dd>{item.callable === null ? '확인 필요' : item.callable ? '실행 가능' : item.reason ?? '실행 불가'}</dd>
          </dl>
          <details className="interface-detail-block" open>
            <summary>Endpoint QoS</summary>
            <pre>{JSON.stringify(communicationSnapshot(item), null, 2)}</pre>
          </details>
        </section>
      )}
      {activeView === 'advanced' && (
        <div className="interface-advanced-info">
          <h4>진단 정보</h4>
          <dl>
            <dt>source</dt><dd>{(item.sources?.length ? item.sources : [item.source]).filter(Boolean).map(sourceLabel).join(', ') || '-'}</dd>
            <dt>package</dt><dd>{item.packageName ?? '-'}</dd>
            <dt>import</dt><dd>{item.importAvailable === null ? '-' : item.importAvailable ? 'import됨' : 'import 안됨'}</dd>
            <dt>build</dt><dd>{item.rebuildRequired ? 'build 필요' : '빌드 반영/대기'}</dd>
            <dt>server</dt><dd>{item.serverAvailable === null ? '-' : item.serverAvailable ? '서버 있음' : '서버 없음'}</dd>
          </dl>
          <CollapsibleJson title="상태·Graph 상세" value={item.status ?? {}} />
          <CollapsibleJson title="Interface schema" value={item.parsed ?? item.schema ?? {}} />
          <CollapsibleText title="Interface raw text" value={item.raw_text ?? ''} />
        </div>
      )}
      {item.kind === 'message' && (
        <TopicWorkspaceDetail
          activeContinuousPublish={activeContinuousPublish}
          executing={executing}
          inlineResult={inlineResult}
          item={item}
          view={activeView}
          messageValues={messageValues}
          onHistorySelect={onHistorySelect}
          onMessageChange={onMessageChange}
          onPublish={onTopicPublish}
          onPublishQosModeChange={onTopicPublishQosModeChange}
          onPublishQosProfileChange={onTopicPublishQosProfileChange}
          onSubscribeQosModeChange={onTopicSubscribeQosModeChange}
          onSubscribeQosProfileChange={onTopicSubscribeQosProfileChange}
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
          publishQosMode={topicPublishQosMode}
          publishQosProfile={topicPublishQosProfile}
          subscribeQosMode={topicSubscribeQosMode}
          subscribeQosProfile={topicSubscribeQosProfile}
          topicSubscribeName={topicSubscribeName}
        />
      )}
      {(item.kind === 'service' || item.kind === 'callable_service') && (
        <ServiceWorkspaceDetail
          executing={executing}
          inlineResult={inlineResult}
          item={item}
          view={activeView}
          onExecute={onServiceExecute}
          onHistorySelect={onHistorySelect}
          onReset={onServiceActionReset}
          onRequestChange={onRequestChange}
          onRequestQosModeChange={onServiceRequestQosModeChange}
          onRequestQosProfileChange={onServiceRequestQosProfileChange}
          onResponseQosModeChange={onServiceResponseQosModeChange}
          onResponseQosProfileChange={onServiceResponseQosProfileChange}
          requestQosMode={serviceRequestQosMode}
          requestQosProfile={serviceRequestQosProfile}
          responseQosMode={serviceResponseQosMode}
          responseQosProfile={serviceResponseQosProfile}
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
          view={activeView}
          onExecute={onActionExecute}
          onCancel={onActionCancel}
          onGoalChange={onGoalChange}
          qosControls={actionQosControls}
          onHistorySelect={onHistorySelect}
          onReset={onServiceActionReset}
          selectedHistoryItem={selectedHistoryItem}
          setGoalTimeoutSec={setGoalTimeoutSec}
        />
      )}
    </aside>
  )
}
