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
        text: `Deleted ${item.full_type ?? item.file_name} and regenerated CMakeLists.txt. Run Apply to refresh the build status.`,
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
        text: `Deleted the ${packageName} package. Run Apply to refresh the build status.`,
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
          ? `Deleted ${item.file_name} and its registry entry, then regenerated the package metadata.`
          : `Deleted the registry entry for ${item.file_name}. The generated file was not deleted.`,
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
