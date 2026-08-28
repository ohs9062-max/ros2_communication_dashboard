import { requestJson, requestWithJsonBody } from './client.js'

export const fetchCallableServices = () => requestJson('/ros/interfaces/callable-services')
export const fetchCallableActions = () => requestJson('/ros/interfaces/callable-actions')
export const fetchCallableMessages = () => requestJson('/ros/interfaces/callable-messages')
export const fetchMessageSchema = (fullType) =>
  requestJson(`/ros/interfaces/message-schema?full_type=${encodeURIComponent(fullType)}`)
export const fetchServiceCallHistory = () => requestJson('/ros/interfaces/service-call/history')
export const fetchActionGoalHistory = () => requestJson('/ros/interfaces/action-goal/history')
export const resetServiceCallHistory = (payload = {}) => requestWithJsonBody('/ros/interfaces/service-call/history/reset', 'POST', payload)
export const resetActionGoalHistory = (payload = {}) => requestWithJsonBody('/ros/interfaces/action-goal/history/reset', 'POST', payload)
export const callRegisteredService = (payload) =>
  requestWithJsonBody('/ros/interfaces/service-call', 'POST', payload)
export const sendActionGoal = (payload) =>
  requestWithJsonBody('/ros/interfaces/action-goal', 'POST', payload)
export const cancelActionGoal = (payload) =>
  requestWithJsonBody('/ros/interfaces/action-goal/cancel', 'POST', payload)
export const fetchServiceServerTypes = () => requestJson('/ros/interfaces/service-servers/types')
export const fetchServiceServers = () => requestJson('/ros/interfaces/service-servers')
export const fetchServiceServerHistory = () => requestJson('/ros/interfaces/service-servers/history')
export const startServiceServer = (payload) =>
  requestWithJsonBody('/ros/interfaces/service-servers/start', 'POST', payload)
export const stopServiceServer = (payload) =>
  requestWithJsonBody('/ros/interfaces/service-servers/stop', 'POST', payload)
export const fetchActionServerTypes = () => requestJson('/ros/interfaces/action-servers/types')
export const fetchActionServers = () => requestJson('/ros/interfaces/action-servers')
export const fetchActionServerHistory = () => requestJson('/ros/interfaces/action-servers/history')
export const startActionServer = (payload) =>
  requestWithJsonBody('/ros/interfaces/action-servers/start', 'POST', payload)
export const stopActionServer = (payload) =>
  requestWithJsonBody('/ros/interfaces/action-servers/stop', 'POST', payload)
export const publishTopicMessage = (payload) =>
  requestWithJsonBody('/ros/interfaces/topic-publish', 'POST', payload)
export const startContinuousTopicPublish = (payload) =>
  requestWithJsonBody('/ros/interfaces/topic-publish/continuous/start', 'POST', payload)
export const stopContinuousTopicPublish = (payload) =>
  requestWithJsonBody('/ros/interfaces/topic-publish/continuous/stop', 'POST', payload)
export const fetchContinuousTopicPublishes = () =>
  requestJson('/ros/interfaces/topic-publish/continuous')

export function fetchTopicPublishHistory({ limit = 100 } = {}) {
  const query = new URLSearchParams()
  if (limit) query.set('limit', String(limit))
  return requestJson(`/ros/interfaces/topic-publish/history${query.size ? `?${query}` : ''}`)
}

export const resetTopicPublishHistory = (payload = {}) =>
  requestWithJsonBody('/ros/interfaces/topic-publish/history/reset', 'POST', payload)
export const startReceiveTopic = (payload) =>
  requestWithJsonBody('/ros/interfaces/receive/topics/start', 'POST', payload)
export const stopReceiveTopic = (payload) =>
  requestWithJsonBody('/ros/interfaces/receive/topics/stop', 'POST', payload)
export const fetchReceiveTopics = () => requestJson('/ros/interfaces/receive/topics')

export function fetchReceiveTopicHistory(topicName = '', { limit = 500, topicType = '' } = {}) {
  const query = new URLSearchParams()
  if (topicName) query.set('topic_name', topicName)
  if (topicType) query.set('topic_type', topicType)
  if (limit) query.set('limit', String(limit))
  return requestJson(`/ros/interfaces/receive/topics/history${query.size ? `?${query}` : ''}`)
}

export function resetReceiveTopicHistory(topicName = '', topicType = '', domainId = null) {
  const payload = {}
  if (topicName) payload.topic_name = topicName
  if (topicType) payload.topic_type = topicType
  if (domainId !== null && domainId !== undefined) payload.domain_id = domainId
  return requestWithJsonBody('/ros/interfaces/receive/topics/history/reset', 'POST', payload)
}

export const fetchReceiveServiceHistory = () => requestJson('/ros/interfaces/receive/services/history')
export const resetReceiveServiceHistory = (payload = {}) =>
  requestWithJsonBody('/ros/interfaces/receive/services/history/reset', 'POST', payload)
export const fetchReceiveActionHistory = () => requestJson('/ros/interfaces/receive/actions/history')
export const resetReceiveActionHistory = (payload = {}) =>
  requestWithJsonBody('/ros/interfaces/receive/actions/history/reset', 'POST', payload)
