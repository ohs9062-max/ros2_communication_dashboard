import { PackageRelatedItems } from './PackageRelatedItems.jsx'
import { WorkspaceDetailPanel } from './WorkspaceDetailPanel.jsx'

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
        <PackageRelatedItems item={item} onSelect={onRelatedSelect} relatedItems={relatedItems} />
      )}
      {showDetail && (
        <WorkspaceDetailPanel
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
