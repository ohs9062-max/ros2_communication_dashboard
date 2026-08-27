import { useMemo } from 'react'

import { fetchDomains } from '../api/rosApi.js'
import { DASHBOARD_POLL_INTERVAL_MS } from '../config/polling.js'
import { usePolling } from './usePolling.js'

/** Domains API는 user_preferences.yaml의 등록 목록을 Backend를 통해 공개한다. */
export function useConfiguredDomains({ enabled = true } = {}) {
  const domains = usePolling(fetchDomains, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: {} },
  })
  const domainIds = useMemo(() => {
    const ids = domains.data?.data?.configured_domain_ids
    return Array.isArray(ids)
      ? [...new Set(ids.filter((id) => Number.isInteger(id)))].sort((left, right) => left - right)
      : []
  }, [domains.data])

  return { domainIds, error: domains.error }
}
