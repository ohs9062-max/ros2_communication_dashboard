import { requestJson, requestWithJsonBody } from './client.js'

export const fetchUserPriorities = () => requestJson('/ros/preferences/priority')

export function updateUserPriority(kind, name, enabled) {
  return requestWithJsonBody(
    `/ros/preferences/priority/${encodeURIComponent(kind)}`,
    enabled ? 'PUT' : 'DELETE',
    { name },
  )
}
