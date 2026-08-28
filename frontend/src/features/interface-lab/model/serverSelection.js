export function configuredServerDomainIds(response) {
  const ids = response?.data?.configured_domain_ids
  return Array.isArray(ids)
    ? [...new Set(ids.filter((id) => Number.isInteger(id)))].sort((left, right) => left - right)
    : []
}

export function serverTypesForDomain(items = [], domainId, typeField) {
  return items
    .filter((item) => (
      item.domain_id === domainId
      && item.import_available === true
      && item.server_creatable === true
      && Boolean(item[typeField])
    ))
    .sort((left, right) => String(left[typeField]).localeCompare(String(right[typeField])))
}

export function suggestServerResourceName({
  domainId,
  nameField,
  resources = [],
  resourceType,
  typeField,
}) {
  const graphResource = resources.find((item) => (
    item.domain_id === domainId
    && item[typeField] === resourceType
    && String(item[nameField] ?? '').trim()
  ))
  if (graphResource) return String(graphResource[nameField]).trim()
  const typeName = String(resourceType ?? '').split('/').filter(Boolean).at(-1)
  return typeName ? `/${typeName}` : ''
}
