import { Fragment } from 'react'

import { InlineWorkspace } from './workspace/InlineWorkspace.jsx'
import { InterfaceCard } from './workspace/WorkspaceCards.jsx'

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

export function InterfaceLabWorkspaceBrowser({
  activeGroup,
  controller,
  onGroupChange,
  onHistorySelect,
  onRelatedSelect,
  onSelect,
  relatedItems,
  selectedDetail,
  selectedHistoryItem,
  workspaceItems,
}) {
  return (
    <section className="interface-lab-layout">
      <div className="interface-registry-browser">
        <div className="interface-tabs">
          {GROUPS.map((group) => (
            <button
              className={activeGroup === group.id ? 'active' : ''}
              key={group.id}
              onClick={() => onGroupChange(group.id)}
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
                onClick={() => onSelect(item)}
                selected={selectedDetail?.id === item.id}
              />
              {selectedDetail?.id === item.id && (
                <InlineWorkspace
                  activeContinuousPublish={controller.activeContinuousPublish}
                  cancelingGoal={controller.cancelingGoal}
                  executing={controller.executing}
                  goalTimeoutSec={controller.goalTimeoutSec}
                  goalValues={controller.goalValues}
                  inlineResult={controller.result}
                  item={selectedDetail}
                  messageValues={controller.messageValues}
                  onActionCancel={controller.cancelAction}
                  onActionExecute={controller.executeAction}
                  onGoalChange={controller.setGoalValues}
                  onHistorySelect={onHistorySelect}
                  onMessageChange={controller.setMessageValues}
                  onRelatedSelect={onRelatedSelect}
                  onRequestChange={controller.setRequestValues}
                  onServiceExecute={controller.executeService}
                  onTopicContinuousStart={controller.startContinuousTopic}
                  onTopicContinuousStop={controller.stopContinuousTopic}
                  onTopicPublish={controller.publishTopic}
                  onTopicReset={controller.resetTopicHistories}
                  onTopicSubscribeStart={controller.startTopicSubscribe}
                  onTopicSubscribeStop={controller.stopTopicSubscribe}
                  publishGraphTopics={controller.publishGraphTopics}
                  relatedItems={relatedItems}
                  requestValues={controller.requestValues}
                  selectedHistoryItem={selectedHistoryItem}
                  selectPublishGraphTopic={controller.selectPublishGraphTopic}
                  setGoalTimeoutSec={controller.setGoalTimeoutSec}
                  setTimeoutSec={controller.setTimeoutSec}
                  setTopicPublishHz={controller.setTopicPublishHz}
                  setTopicPublishName={controller.updateTopicPublishName}
                  setTopicSubscribeName={controller.setTopicSubscribeName}
                  timeoutSec={controller.timeoutSec}
                  topicPublishHz={controller.topicPublishHz}
                  topicPublishName={controller.topicPublishName}
                  topicPublishWarning={controller.topicPublishWarning}
                  topicSubscribeName={controller.topicSubscribeName}
                />
              )}
            </Fragment>
          ))}
          {!workspaceItems.length && <p className="muted">표시할 항목이 없습니다.</p>}
        </div>
      </div>
    </section>
  )
}
