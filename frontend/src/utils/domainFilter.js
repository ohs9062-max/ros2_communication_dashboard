export function matchesDomainFilter(resource, selectedDomainId) {
  return selectedDomainId === null || resource?.domain_id === selectedDomainId
}
