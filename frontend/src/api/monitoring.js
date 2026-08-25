import { requestJson } from './client.js'

export const fetchHealth = () => requestJson('/health')
export const fetchTopics = () => requestJson('/ros/topics')
export const fetchTopicLatest = (name) => requestJson(`/ros/topics/latest?name=${encodeURIComponent(name)}`)
export const fetchTopicHz = (name) => requestJson(`/ros/topics/hz?name=${encodeURIComponent(name)}`)
export const fetchTopicImagePreview = (name) => requestJson(`/ros/topics/image-preview?name=${encodeURIComponent(name)}`)
export const fetchTopicHistory = (name, limit = 100) =>
  requestJson(`/ros/topics/history?name=${encodeURIComponent(name)}&limit=${limit}`)
export const fetchAlerts = () => requestJson('/ros/alerts')
export const fetchAlertHistory = ({ name = '', page = 1 } = {}) => {
  const query = new URLSearchParams({ page: String(page) })
  if (name) query.set('name', name)
  return requestJson(`/ros/alerts/history?${query.toString()}`)
}
export const resetAlertHistory = () => requestJson('/ros/alerts/history/reset', { method: 'POST' })
export const resetCurrentAlerts = () => requestJson('/ros/alerts/current/reset', { method: 'POST' })
export const fetchServices = ({ includeHidden = false } = {}) =>
  requestJson(`/ros/services${includeHidden ? '?include_hidden=true' : ''}`)
export const fetchActions = () => requestJson('/ros/actions')
export const fetchServiceHistory = (name, serviceType, limit = 30) => {
  const query = new URLSearchParams({ name, limit: String(limit) })
  if (serviceType) query.set('service_type', serviceType)
  return requestJson(`/ros/services/history?${query.toString()}`)
}
export const fetchActionHistory = (name, actionType, limit = 30) => {
  const query = new URLSearchParams({ name, limit: String(limit) })
  if (actionType) query.set('action_type', actionType)
  return requestJson(`/ros/actions/history?${query.toString()}`)
}
export const fetchNodes = () => requestJson('/ros/nodes')
