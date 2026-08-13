import { useCallback } from 'react'

import {
  applyInterfaces,
  checkInterfaceImports,
  fetchInterfacePackages,
} from '../../../api/interfaceManagement.js'

export function useInterfaceApplyActions({
  loadApplyStatus,
  loadPackages,
  loadRegistry,
  onStateChanged,
  setApplying,
  setApplyStatus,
  setBuildLogTail,
  setFeedback,
  setPackages,
  setRegistry,
  setReloadPhase,
  setShowBuildLog,
  setShowPackages,
  setShowRegistry,
}) {
  const runImportCheck = useCallback(async () => {
    try {
      const payload = await checkInterfaceImports()
      setRegistry(payload.data)
      setShowRegistry(true)
      const packagePayload = await fetchInterfacePackages()
      setPackages(packagePayload.data ?? [])
      setShowPackages(true)
      const notApplied = payload.summary?.not_applied ?? payload.not_applied ?? []
      setFeedback(payload.real_apply_success
        ? { tone: 'success', text: '적용 완료. 새 interface 타입을 사용할 수 있습니다.' }
        : {
          tone: 'warning',
          text: notApplied.length
            ? `Partial apply: file creation or CMake registration did not complete. Check the detailed status. (${notApplied[0].file_name ?? 'registry'}: ${notApplied[0].reason})`
            : 'Partial apply: the import recheck did not complete.',
        })
      setReloadPhase('idle')
      await loadApplyStatus()
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'warning', text: `The server reconnected, but the import recheck failed: ${error.message}` })
    }
  }, [
    loadApplyStatus,
    onStateChanged,
    setFeedback,
    setPackages,
    setRegistry,
    setReloadPhase,
    setShowPackages,
    setShowRegistry,
  ])

  const applyUploadedInterfaces = async () => {
    setApplying(true)
    setBuildLogTail('')
    setShowBuildLog(false)
    setFeedback({ tone: 'warning', text: 'Build in progress...' })
    try {
      const payload = await applyInterfaces()
      const status = payload.data ?? {}
      setApplyStatus(status)
      setBuildLogTail(status.log_tail ?? '')
      if (payload.real_apply_success) {
        setReloadPhase('scheduled')
        setFeedback({ tone: 'success', text: '적용 완료. 새 interface 타입을 사용할 수 있습니다.' })
      } else {
        const notApplied = payload.not_applied ?? status.not_applied ?? []
        const importFailed = payload.status === 'import_failed'
        setReloadPhase('idle')
        setFeedback({
          tone: payload.status === 'partial' || importFailed ? 'warning' : 'error',
          text: importFailed
            ? 'The build succeeded, but the interface import check failed in the current Monitor process.'
            : notApplied.length
              ? `Partial apply: file creation or CMake registration did not complete. Check the detailed status. (${notApplied[0].file_name ?? 'registry'}: ${notApplied[0].reason})`
              : payload.message || 'The build failed. Check CMakeLists.txt, package.xml, and interface dependencies.',
        })
      }
      await loadApplyStatus()
      await loadRegistry(true)
      await loadPackages(true)
      onStateChanged?.()
    } catch (error) {
      setReloadPhase('idle')
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setApplying(false)
    }
  }

  return { applyUploadedInterfaces, runImportCheck }
}
