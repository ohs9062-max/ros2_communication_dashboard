import { useInlineServiceActionController } from './useInlineServiceActionController.js'
import { useInlineTopicController } from './useInlineTopicController.js'

export function useInlineWorkspaceController({
  continuousTopicPublishes,
  refresh,
  selectedDetail,
  topics,
  updateSnapshotField,
}) {
  const serviceAction = useInlineServiceActionController({ refresh, selectedDetail })
  const topic = useInlineTopicController({
    continuousTopicPublishes,
    refresh,
    selectedDetail,
    topics,
    updateSnapshotField,
  })
  const topicSelected = selectedDetail?.kind === 'message'

  const reset = () => {
    serviceAction.reset()
    topic.reset()
  }

  return {
    activeContinuousPublish: topic.activeContinuousPublish,
    cancelAction: serviceAction.cancelAction,
    cancelingGoal: serviceAction.cancelingGoal,
    executeAction: serviceAction.executeAction,
    executeService: serviceAction.executeService,
    executing: topicSelected ? topic.executing : serviceAction.executing,
    goalTimeoutSec: serviceAction.goalTimeoutSec,
    goalValues: serviceAction.goalValues,
    messageValues: topic.messageValues,
    publishGraphTopics: topic.publishGraphTopics,
    publishTopic: topic.publish,
    requestValues: serviceAction.requestValues,
    reset,
    resetTopicHistories: topic.resetHistories,
    result: topicSelected ? topic.result : serviceAction.result,
    selectPublishGraphTopic: topic.selectPublishGraphTopic,
    setGoalTimeoutSec: serviceAction.setGoalTimeoutSec,
    setGoalValues: serviceAction.setGoalValues,
    setMessageValues: topic.setMessageValues,
    setRequestValues: serviceAction.setRequestValues,
    setTimeoutSec: serviceAction.setTimeoutSec,
    setTopicPublishHz: topic.setPublishHz,
    setTopicSubscribeName: topic.setSubscribeName,
    startContinuousTopic: topic.startContinuous,
    startTopicSubscribe: topic.startSubscribe,
    stopContinuousTopic: topic.stopContinuous,
    stopTopicSubscribe: topic.stopSubscribe,
    timeoutSec: serviceAction.timeoutSec,
    topicPublishHz: topic.publishHz,
    topicPublishName: topic.publishName,
    topicPublishWarning: topic.publishWarning,
    topicSubscribeName: topic.subscribeName,
    updateTopicPublishName: topic.updatePublishName,
  }
}
