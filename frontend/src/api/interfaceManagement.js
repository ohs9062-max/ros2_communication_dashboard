import { requestJson, requestWithJsonBody } from './client.js'

export const fetchInterfaceRegistry = () => requestJson('/ros/interfaces/registry')
export const fetchInterfacePackages = () => requestJson('/ros/interfaces/packages')
export const fetchInterfaceApplyStatus = () => requestJson('/ros/interfaces/apply/status')
export const applyInterfaces = () => requestJson('/ros/interfaces/apply', { method: 'POST' })
export const checkInterfaceImports = () => requestJson('/ros/interfaces/import-check', { method: 'POST' })
export const rebuildUploadedInterfacesCmake = () =>
  requestJson('/ros/interfaces/uploaded-interfaces/rebuild-cmake', { method: 'POST' })
export const registerManualType = (payload) =>
  requestWithJsonBody('/ros/interfaces/manual-type', 'POST', payload)
export const writeManualDefinition = (payload) =>
  requestWithJsonBody('/ros/interfaces/manual-definition', 'POST', payload)
export const validateManualDefinition = (payload) =>
  requestWithJsonBody('/ros/interfaces/manual-definition/validate', 'POST', payload)

export function updateManualDefinition({ definition, kind, typeName }) {
  return requestWithJsonBody(
    `/ros/interfaces/manual-definition/${encodeURIComponent(kind)}/${encodeURIComponent(typeName)}`,
    'PUT',
    { definition },
  )
}

export function deleteManualDefinition({ kind, typeName }) {
  return requestJson(
    `/ros/interfaces/manual-definition/${encodeURIComponent(kind)}/${encodeURIComponent(typeName)}`,
    { method: 'DELETE' },
  )
}

export async function uploadInterface(file) {
  const formData = new FormData()
  formData.append('file', file)
  return requestJson('/ros/interfaces/upload', { method: 'POST', body: formData })
}

export async function uploadInterfacePackage(file, { replace = false } = {}) {
  const formData = new FormData()
  formData.append('file', file)
  return requestJson(`/ros/interfaces/packages/upload${replace ? '?replace=true' : ''}`, {
    method: 'POST',
    body: formData,
  })
}

export async function uploadInterfacePackageFolder(files, { replace = false } = {}) {
  const formData = new FormData()
  files.forEach((file) => {
    const relativePath = file.webkitRelativePath || file.relativePath || file.name
    formData.append('files', file, relativePath)
    formData.append('relative_path', relativePath)
  })
  return requestJson(`/ros/interfaces/packages/folder-upload${replace ? '?replace=true' : ''}`, {
    method: 'POST',
    body: formData,
  })
}

export const deleteInterfacePackage = (packageName) => requestJson(
  `/ros/interfaces/packages/${encodeURIComponent(packageName)}`,
  { method: 'DELETE' },
)

export function deleteInterfaceRegistryEntry({ fileName, fullType, kind, source }) {
  const query = new URLSearchParams()
  if (source) query.set('source', source)
  if (fullType) query.set('full_type', fullType)
  const suffix = query.toString() ? `?${query}` : ''
  return requestJson(
    `/ros/interfaces/registry/${encodeURIComponent(kind)}/${encodeURIComponent(fileName)}${suffix}`,
    { method: 'DELETE' },
  )
}
