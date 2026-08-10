import {
  deleteInterfacePackage,
  deleteInterfaceRegistryEntry,
  deleteManualDefinition,
  fetchInterfaceApplyStatus,
  fetchInterfacePackages,
  fetchInterfaceRegistry,
} from '../../../api/interfaceManagement.js'
import { registryRowKey } from '../model/interfaceUploadModel.js'

export function useInterfaceDeleteActions({
  editingManualDefinition,
  onStateChanged,
  setApplyStatus,
  setBuildLogTail,
  setBusy,
  setEditingManualDefinition,
  setFeedback,
  setPackages,
  setRecentDeletedRegistry,
  setRegistry,
}) {
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

  return { removeManualDefinition, removePackage, removeRegistryEntry }
}
