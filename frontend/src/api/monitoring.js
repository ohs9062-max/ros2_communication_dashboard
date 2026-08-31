import { requestJson, requestWithJsonBody } from './client.js'

export const fetchHealth = () => requestJson('/health')
export const fetchTopics = () => requestJson('/ros/topics')
const domainQuery = (domainId) => Number.isInteger(domainId) ? `&domain_id=${domainId}` : ''
export const fetchTopicLatest = (name, domainId) => requestJson(`/ros/topics/latest?name=${encodeURIComponent(name)}${domainQuery(domainId)}`)
export const fetchTopicHz = (name, domainId) => requestJson(`/ros/topics/hz?name=${encodeURIComponent(name)}${domainQuery(domainId)}`)
export const fetchTopicImagePreview = (name, domainId) => requestJson(`/ros/topics/image-preview?name=${encodeURIComponent(name)}${domainQuery(domainId)}`)
export const stopTopicImagePreview = (name, domainId) => requestJson(`/ros/topics/image-preview?name=${encodeURIComponent(name)}${domainQuery(domainId)}`, { method: 'DELETE' })
export const fetchTopicHistory = (name, limit = 100, domainId) =>
  requestJson(`/ros/topics/history?name=${encodeURIComponent(name)}&limit=${limit}${domainQuery(domainId)}`)
export const fetchAlerts = () => requestJson('/ros/alerts')
export const fetchAlertHistory = ({ name = '', page = 1 } = {}) => {
  const query = new URLSearchParams({ page: String(page) })
  if (name) query.set('name', name)
  return requestJson(`/ros/alerts/history?${query.toString()}`)
}
export const resetAlertHistory = () => requestJson('/ros/alerts/history/reset', { method: 'POST' })
export const resetCurrentAlerts = () => requestJson('/ros/alerts/current/reset', { method: 'POST' })
export const diagnoseAlert = (alert) =>
  requestWithJsonBody('/ros/alerts/ai-diagnosis', 'POST', { alert })
export const fetchServices = ({ includeHidden = false } = {}) =>
  requestJson(`/ros/services${includeHidden ? '?include_hidden=true' : ''}`)
export const fetchActions = () => requestJson('/ros/actions')
export const fetchServiceHistory = (name, serviceType, limit = 30, domainId) => {
  const query = new URLSearchParams({ name, limit: String(limit) })
  if (serviceType) query.set('service_type', serviceType)
  if (Number.isInteger(domainId)) query.set('domain_id', String(domainId))
  return requestJson(`/ros/services/history?${query.toString()}`)
}
export const fetchActionHistory = (name, actionType, limit = 100, domainId) => {
  const query = new URLSearchParams({ name, limit: String(limit) })
  if (actionType) query.set('action_type', actionType)
  if (Number.isInteger(domainId)) query.set('domain_id', String(domainId))
  return requestJson(`/ros/actions/history?${query.toString()}`)
}
export const fetchNodes = () => requestJson('/ros/nodes')
export const fetchDomains = () => requestJson('/ros/domains')
export const updateDomains = (domainIds) =>
  requestWithJsonBody('/ros/domains', 'PUT', { domain_ids: domainIds })
export const addDomain = (domainId) => requestJson(`/ros/domains/${domainId}`, { method: 'POST' })
export const removeDomain = (domainId) => requestJson(`/ros/domains/${domainId}`, { method: 'DELETE' })
