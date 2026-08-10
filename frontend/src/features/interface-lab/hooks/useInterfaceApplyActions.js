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
            ? `부분 적용: 파일 생성 또는 CMake 등록이 완료되지 않았습니다. 상세 상태를 확인하세요. (${notApplied[0].file_name ?? 'registry'}: ${notApplied[0].reason})`
            : '부분 적용: import 재확인이 완료되지 않았습니다.',
        })
      setReloadPhase('idle')
      await loadApplyStatus()
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'warning', text: `서버는 다시 연결됐지만 import 재확인에 실패했습니다: ${error.message}` })
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
    setFeedback({ tone: 'warning', text: '빌드 중...' })
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
            ? '빌드는 성공했지만 현재 backend 프로세스에서 import 확인에 실패했습니다.'
            : notApplied.length
              ? `부분 적용: 파일 생성 또는 CMake 등록이 완료되지 않았습니다. 상세 상태를 확인하세요. (${notApplied[0].file_name ?? 'registry'}: ${notApplied[0].reason})`
              : payload.message || '빌드 실패. CMakeLists.txt, package.xml, interface 의존성을 확인하세요.',
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
