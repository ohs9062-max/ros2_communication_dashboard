import { useEffect, useState } from 'react'

export function useDomainFilter(domainIds = []) {
  const [selectedDomainId, setSelectedDomainId] = useState(null)

  useEffect(() => {
    if (selectedDomainId !== null && !domainIds.includes(selectedDomainId)) {
      setSelectedDomainId(null)
    }
  }, [domainIds, selectedDomainId])

  return { selectedDomainId, setSelectedDomainId }
}
