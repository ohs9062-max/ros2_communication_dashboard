// Compatibility facade: existing callers keep this stable import while features
// can depend on the narrower modules below during the staged refactor.
export { API_BASE_URL, monitorWebSocketUrl } from './client.js'
export * from './monitoring.js'
export * from './preferences.js'
export * from './interfaceManagement.js'
export * from './interfaceExecution.js'
