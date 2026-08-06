import { useCallback, useState } from 'react'

import {
  applyInterfaces,
  checkInterfaceImports,
  deleteInterfacePackage,
  deleteInterfaceRegistryEntry,
  deleteManualDefinition,
  fetchInterfaceApplyStatus,
  fetchInterfacePackages,
  fetchInterfaceRegistry,
  rebuildUploadedInterfacesCmake,
  registerManualType,
  uploadInterface,
  uploadInterfacePackage,
  uploadInterfacePackageFolder,
  updateManualDefinition,
  validateManualDefinition,
  writeManualDefinition,
} from '../../../api/interfaceManagement.js'
import { interfaceCounts, registryRowKey } from '../InterfaceUploadParts.jsx'

export const MANUAL_INTERFACE_PACKAGE = 'uploaded_interfaces'

const ACCEPTED_EXTENSIONS = ['.msg', '.srv', '.action']

export function useInterfaceManagementController({ onCloseExecutionPanels, onStateChanged }) {
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [reloadPhase, setReloadPhase] = useState('idle')
  const [feedback, setFeedback] = useState(null)
  const [registry, setRegistry] = useState(null)
  const [recentDeletedRegistry, setRecentDeletedRegistry] = useState([])
  const [applyStatus, setApplyStatus] = useState(null)
  const [showRegistry, setShowRegistry] = useState(false)
  const [showPackages, setShowPackages] = useState(false)
  const [showBuildLog, setShowBuildLog] = useState(false)
  const [buildLogTail, setBuildLogTail] = useState('')
  const [replacePackage, setReplacePackage] = useState(false)
  const [packages, setPackages] = useState([])
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualMode, setManualMode] = useState('type')
  const [manualType, setManualType] = useState('')
  const [manualKind, setManualKind] = useState('srv')
  const [manualTypeName, setManualTypeName] = useState('')
  const [manualDefinition, setManualDefinition] = useState('')
  const [editingManualDefinition, setEditingManualDefinition] = useState(null)

  const startEditingManualDefinition = (item) => {
    setShowManualInput(true)
    setManualMode('definition')
    setManualKind(item.file_kind)
    setManualTypeName(item.type_name)
    setManualDefinition(item.raw_text ?? '')
    setEditingManualDefinition({ kind: item.file_kind, typeName: item.type_name })
  }

  const loadApplyStatus = useCallback(async () => {
    const payload = await fetchInterfaceApplyStatus()
    setApplyStatus(payload.data)
    setBuildLogTail(payload.data?.log_tail ?? '')
    return payload.data
  }, [])

  const loadPackages = async (keepOpen = false) => {
    setBusy(true)
    try {
      const payload = await fetchInterfacePackages()
      setPackages(payload.data ?? [])
      setShowPackages(true)
      if (!keepOpen) {
        setShowRegistry(false)
        setShowBuildLog(false)
        onCloseExecutionPanels()
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const loadRegistry = async (keepOpen = false) => {
    setBusy(true)
    try {
      const payload = await fetchInterfaceRegistry()
      setRegistry(payload.data)
      setShowRegistry(true)
      if (!keepOpen) {
        setShowPackages(false)
        setShowBuildLog(false)
        onCloseExecutionPanels()
      }
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const uploadFiles = async (files, sourceLabel) => {
    const supportedFiles = files.filter((file) =>
      ACCEPTED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension)))
    if (!supportedFiles.length) {
      setFeedback({ tone: 'error', text: `${sourceLabel}에 .msg, .srv, .action 파일이 없습니다.` })
      return
    }
    setBusy(true)
    setFeedback(null)
    const succeeded = []
    const warned = []
    const failed = []
    try {
      for (const file of supportedFiles) {
        try {
          const payload = await uploadInterface(file)
          const item = payload.data
          if (payload.success && !item.parsed_error) succeeded.push(item.file_name)
          else warned.push(`${item.file_name}${item.parsed_error ? ` (${item.parsed_error})` : ''}`)
        } catch (error) {
          failed.push(`${file.name} (${error.message})`)
        }
      }
      const summary = [`${sourceLabel}: ${supportedFiles.length}개 처리`, `성공 ${succeeded.length}`, warned.length ? `경고 ${warned.length}` : null, failed.length ? `실패 ${failed.length}` : null].filter(Boolean).join(' · ')
      const details = failed[0] ?? warned[0]
      setFeedback({ tone: failed.length ? 'error' : warned.length ? 'warning' : 'success', text: details ? `${summary} · ${details}` : `${summary} · ${succeeded.join(', ')}` })
      const refreshResults = await Promise.allSettled([fetchInterfaceRegistry(), fetchInterfaceApplyStatus()])
      if (refreshResults[0].status === 'fulfilled') {
        setRegistry(refreshResults[0].value.data)
      }
      if (refreshResults[1].status === 'fulfilled') {
        setApplyStatus(refreshResults[1].value.data)
        setBuildLogTail(refreshResults[1].value.data?.log_tail ?? '')
      }
      const refreshFailure = refreshResults.find((result) => result.status === 'rejected')
      if (refreshFailure && succeeded.length) {
        setFeedback({
          tone: 'warning',
          text: `${summary} · 등록은 완료됐지만 일부 상태 갱신에 실패했습니다. 상태 새로고침을 눌러 다시 확인하세요. · ${refreshFailure.reason.message}`,
        })
      }
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'error', text: `${sourceLabel} 처리 중 오류가 발생했습니다. · ${error.message}` })
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length) await uploadFiles(files, '파일 업로드')
  }

  const uploadPackage = async (files, folder) => {
    setBusy(true)
    setFeedback(null)
    try {
      const payload = folder
        ? await uploadInterfacePackageFolder(files, { replace: replacePackage })
        : await uploadInterfacePackage(files[0], { replace: replacePackage })
      const item = payload.data
      const counts = interfaceCounts(item.interfaces)
      setFeedback({ tone: 'success', text: `${item.name} package${folder ? ' 폴더' : ''} 업로드 완료 · msg ${counts.msg}, srv ${counts.srv}, action ${counts.action} · 적용하기로 build/import를 진행하세요.` })
      await loadPackages(true)
      await loadApplyStatus()
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const handlePackageFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setFeedback({ tone: 'error', text: 'interface package는 .zip 파일만 가능합니다.' })
      return
    }
    await uploadPackage([file], false)
  }

  const handlePackageFolder = async (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    const packageFiles = files.filter((file) => {
      const path = file.webkitRelativePath || file.name
      return /(^|\/)(package\.xml|CMakeLists\.txt)$/.test(path) || /\/(msg|srv|action)\/[^/]+\.(msg|srv|action)$/.test(path)
    })
    if (!packageFiles.length) {
      setFeedback({ tone: 'error', text: 'package.xml, CMakeLists.txt, msg/srv/action 파일이 있는 ROS2 package 폴더를 선택하세요.' })
      return
    }
    await uploadPackage(packageFiles, true)
  }

  const submitManualType = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      const payload = await registerManualType({ full_type: manualType, allowlisted: true })
      const entry = payload.data ?? payload.entry
      setFeedback({
        tone: entry?.build?.import_available ? 'success' : 'warning',
        text: entry?.build?.import_available
          ? `${entry.full_type} 기존 빌드 타입 등록 완료 · import됨`
          : `${entry?.full_type ?? manualType} 기존 빌드 타입 등록 완료 · import 안됨: ${entry?.build?.import_error ?? '환경/source 확인 필요'}`,
      })
      await loadRegistry(true)
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const submitManualDefinition = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      const payload = editingManualDefinition
        ? await updateManualDefinition({ kind: editingManualDefinition.kind, typeName: editingManualDefinition.typeName, definition: manualDefinition })
        : await writeManualDefinition({ package: MANUAL_INTERFACE_PACKAGE, kind: manualKind, type_name: manualTypeName, definition: manualDefinition })
      const entry = payload.data ?? payload.entry
      setFeedback({ tone: 'success', text: `${entry.full_type} 직접 작성 ${editingManualDefinition ? '수정' : '저장'} 완료 · 적용하기로 build/import를 진행하세요.` })
      setEditingManualDefinition(null)
      await loadRegistry(true)
      await loadApplyStatus()
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'error', text: `문법 오류가 있어 파일을 생성/수정하지 않았습니다. CMakeLists.txt도 수정하지 않았습니다. · ${error.message}` })
    } finally {
      setBusy(false)
    }
  }

  const validateCurrentManualDefinition = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      await validateManualDefinition({ package: MANUAL_INTERFACE_PACKAGE, kind: manualKind, type_name: manualTypeName, definition: manualDefinition })
      setFeedback({ tone: 'success', text: '문법 검증 통과 · 아직 파일/CMake/registry는 수정하지 않았습니다.' })
    } catch (error) {
      setFeedback({ tone: 'error', text: `문법 오류가 있어 파일을 생성하지 않았습니다. CMakeLists.txt도 수정하지 않았습니다. · ${error.message}` })
    } finally {
      setBusy(false)
    }
  }

  const regenerateUploadedInterfacesCmake = async () => {
    setBusy(true)
    try {
      const payload = await rebuildUploadedInterfacesCmake()
      setFeedback({ tone: 'success', text: `CMakeLists.txt 재생성 완료 · ${payload.data?.interfaces?.length ?? 0}개 interface 반영 · 적용하기를 다시 실행하세요.` })
      await loadApplyStatus()
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const refreshManagedListsAfterDelete = async () => {
    const [registryPayload, packagesPayload, statusPayload] = await Promise.all([
      fetchInterfaceRegistry(),
      fetchInterfacePackages(),
      fetchInterfaceApplyStatus(),
    ])
    setRegistry(registryPayload.data)
    setPackages(packagesPayload.data ?? [])
    setApplyStatus(statusPayload.data)
    setBuildLogTail(statusPayload.data?.log_tail ?? '')
  }

  const removeManualDefinition = async (item, refreshExecutionCandidates) => {
    setBusy(true)
    setFeedback(null)
    try {
      await deleteManualDefinition({ kind: item.file_kind, typeName: item.type_name })
      setFeedback({
        tone: 'warning',
        text: `${item.full_type ?? item.file_name} 파일 삭제 및 CMakeLists.txt 재생성 완료 · 적용하기로 build 상태를 다시 반영하세요.`,
      })
      if (editingManualDefinition?.kind === item.file_kind && editingManualDefinition?.typeName === item.type_name) {
        setEditingManualDefinition(null)
      }
      await refreshManagedListsAfterDelete()
      await refreshExecutionCandidates?.()
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const removePackage = async (packageName, refreshExecutionCandidates) => {
    setBusy(true)
    try {
      await deleteInterfacePackage(packageName)
      setFeedback({
        tone: 'warning',
        text: `${packageName} package를 삭제했습니다. 적용하기로 build 상태를 갱신하세요.`,
      })
      await refreshManagedListsAfterDelete()
      await refreshExecutionCandidates?.()
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const removeRegistryEntry = async (item, refreshExecutionCandidates) => {
    setBusy(true)
    try {
      const payload = await deleteInterfaceRegistryEntry({
        kind: item.file_kind,
        fileName: item.file_name,
        source: item.source,
        fullType: item.full_type,
      })
      const deletedItem = { ...item, deletedAt: Date.now(), deletedMarker: true }
      setRecentDeletedRegistry((current) => [
        deletedItem,
        ...current.filter((entry) => registryRowKey(entry) !== registryRowKey(item)),
      ].slice(0, 3))
      setFeedback({
        tone: 'warning',
        text: payload.data?.file_deleted
          ? `${item.file_name} 파일과 등록을 삭제하고 package metadata를 재생성했습니다.`
          : `${item.file_name} 등록을 삭제했습니다. 생성된 파일은 삭제하지 않았습니다.`,
      })
      await refreshManagedListsAfterDelete()
      await refreshExecutionCandidates?.()
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

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
  }, [loadApplyStatus, onStateChanged])

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

  return {
    applyStatus, applyUploadedInterfaces, applying, buildLogTail, busy,
    editingManualDefinition, feedback,
    handleFile, handlePackageFile, handlePackageFolder, loadApplyStatus, loadPackages,
    loadRegistry, regenerateUploadedInterfacesCmake, removeManualDefinition,
    removePackage, removeRegistryEntry, runImportCheck,
    manualDefinition, manualKind, manualMode, manualType, manualTypeName,
    packages, recentDeletedRegistry, registry, reloadPhase, replacePackage,
    setApplyStatus, setBuildLogTail, setBusy, setEditingManualDefinition,
    setFeedback, setManualDefinition, setManualKind, setManualMode, setManualType,
    setManualTypeName, setPackages, setRegistry,
    setReloadPhase, setReplacePackage, setShowBuildLog, setShowManualInput,
    setShowPackages, setShowRegistry, showBuildLog, showManualInput, showPackages,
    showRegistry, startEditingManualDefinition, submitManualDefinition,
    submitManualType, validateCurrentManualDefinition,
  }
}
