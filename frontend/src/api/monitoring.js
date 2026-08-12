import { requestJson } from './client.js'

export const fetchHealth = () => requestJson('/health')
export const fetchTopics = () => requestJson('/ros/topics')
export const fetchTopicLatest = (name) => requestJson(`/ros/topics/latest?name=${encodeURIComponent(name)}`)
export const fetchTopicHz = (name) => requestJson(`/ros/topics/hz?name=${encodeURIComponent(name)}`)
export const fetchTopicImagePreview = (name) => requestJson(`/ros/topics/image-preview?name=${encodeURIComponent(name)}`)
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
export const fetchNodes = () => requestJson('/ros/nodes')
