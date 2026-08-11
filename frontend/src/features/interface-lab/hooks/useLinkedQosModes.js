import { useCallback, useState } from 'react'

export function useLinkedQosModes({
  executionMode,
  executionProfiles = {},
  receiveMode,
  receiveProfiles = {},
  setExecutionMode,
  setExecutionProfile,
  setReceiveMode,
  setReceiveProfile,
}) {
  const [linked, setLinked] = useState(false)
  const changeExecutionMode = useCallback((mode) => {
    setExecutionMode(mode)
    if (linked) setReceiveMode(mode)
  }, [linked, setExecutionMode, setReceiveMode])
  const changeReceiveMode = useCallback((mode) => {
    setReceiveMode(mode)
    if (linked) setExecutionMode(mode)
  }, [linked, setExecutionMode, setReceiveMode])
  const changeExecutionProfile = useCallback((key, profile) => {
    setExecutionProfile?.(key, profile)
    if (linked) setReceiveProfile?.(key, profile)
  }, [linked, setExecutionProfile, setReceiveProfile])
  const changeReceiveProfile = useCallback((key, profile) => {
    setReceiveProfile?.(key, profile)
    if (linked) setExecutionProfile?.(key, profile)
  }, [linked, setExecutionProfile, setReceiveProfile])
  const linkFromExecution = useCallback((checked) => {
    setLinked(checked)
    if (checked) {
      setReceiveMode(executionMode)
      Object.entries(executionProfiles).forEach(([key, profile]) => {
        setReceiveProfile?.(key, profile)
      })
    }
  }, [executionMode, executionProfiles, setReceiveMode, setReceiveProfile])
  const linkFromReceive = useCallback((checked) => {
    setLinked(checked)
    if (checked) {
      setExecutionMode(receiveMode)
      Object.entries(receiveProfiles).forEach(([key, profile]) => {
        setExecutionProfile?.(key, profile)
      })
    }
  }, [receiveMode, receiveProfiles, setExecutionMode, setExecutionProfile])

  return {
    changeExecutionMode,
    changeExecutionProfile,
    changeReceiveMode,
    changeReceiveProfile,
    linkFromExecution,
    linkFromReceive,
    linked,
  }
}
