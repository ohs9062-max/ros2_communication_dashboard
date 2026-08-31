import { useCallback, useMemo, useState } from 'react'

import {
  fetchActionServers,
  fetchServiceServers,
  stopActionServer,
  stopServiceServer,
} from '../../../api/interfaceExecution.js'
import { mergeRunningServers, stopRunningServer } from '../model/serverListModel.js'

export function useServerListController({ onStateChanged, setFeedback }) {
  const [actionServers, setActionServers] = useState([])
  const [serviceServers, setServiceServers] = useState([])
  const [stoppingKey, setStoppingKey] = useState('')
  const [error, setError] = useState('')
  const servers = useMemo(
    () => mergeRunningServers(serviceServers, actionServers),
    [actionServers, serviceServers],
  )

  const refresh = useCallback(async () => {
    const [services, actions] = await Promise.all([fetchServiceServers(), fetchActionServers()])
    setServiceServers(services.data ?? [])
    setActionServers(actions.data ?? [])
    setError('')
    return { actions: actions.data ?? [], services: services.data ?? [] }
  }, [])

  const load = useCallback(async () => refresh(), [refresh])

  const stop = useCallback(async (server) => {
    setStoppingKey(server.identityKey)
    setError('')
    try {
      await stopRunningServer(server, {
        stopAction: stopActionServer,
        stopService: stopServiceServer,
      })
      await refresh()
      setFeedback?.({ tone: 'info', text: `${server.kindLabel} 서버 [${server.name}]를 종료했습니다.` })
      onStateChanged?.()
    } catch (stopError) {
      setError(stopError.message)
    } finally {
      setStoppingKey('')
    }
  }, [onStateChanged, refresh, setFeedback])

  return {
    busy: Boolean(stoppingKey),
    error,
    load,
    refresh,
    servers,
    stop,
    stoppingKey,
  }
}
