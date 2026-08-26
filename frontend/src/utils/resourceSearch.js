export function matchesResourceSearch(resource, search, values = []) {
  const normalizedSearch = String(search ?? '').trim().toLowerCase()
  if (!normalizedSearch) return true

  const domainMatch = normalizedSearch.match(/^d(\d+)$/)
  if (domainMatch) {
    const domainId = Number(resource?.domain_id)
    return Number.isInteger(domainId) && domainId === Number(domainMatch[1])
  }

  return values.some((value) =>
    String(value ?? '').toLowerCase().includes(normalizedSearch))
}
