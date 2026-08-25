export function parseDomainIdsInput(value) {
  const source = String(value ?? '').trim()
  if (!source) return { domainIds: [] }

  const domainIds = []
  for (const token of source.split(',')) {
    const normalized = token.trim()
    if (!/^\d+$/.test(normalized)) {
      return { error: 'ROS Domain ID는 쉼표로 구분한 0~232 정수만 입력할 수 있습니다.' }
    }
    const domainId = Number(normalized)
    if (!Number.isInteger(domainId) || domainId < 0 || domainId > 232) {
      return { error: 'ROS Domain ID는 0~232 범위여야 합니다.' }
    }
    domainIds.push(domainId)
  }

  return { domainIds: [...new Set(domainIds)].sort((left, right) => left - right) }
}

export function domainIdsText(domainIds) {
  return Array.isArray(domainIds) ? domainIds.join(', ') : ''
}
