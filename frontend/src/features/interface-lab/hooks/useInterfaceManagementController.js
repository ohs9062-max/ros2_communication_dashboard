import { useCallback, useState } from 'react'

import {
  fetchInterfaceApplyStatus,
  fetchInterfacePackages,
  fetchInterfaceRegistry,
} from '../../../api/interfaceManagement.js'
import {
  MANUAL_INTERFACE_PACKAGE,
  useManualInterfaceController,
} from './useManualInterfaceController.js'
import { useInterfaceUploadActions } from './useInterfaceUploadActions.js'
import { useInterfaceDeleteActions } from './useInterfaceDeleteActions.js'
import { useInterfaceApplyActions } from './useInterfaceApplyActions.js'

export { MANUAL_INTERFACE_PACKAGE }

export function useInterfaceManagementController({ onStateChanged }) {
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
      }
      return true
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
      return false
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
      }
      return true
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
      return false
    } finally {
      setBusy(false)
    }
  }

  const upload = useInterfaceUploadActions({
    loadApplyStatus,
    loadPackages,
    onStateChanged,
    replacePackage,
    setApplyStatus,
    setBuildLogTail,
    setBusy,
    setFeedback,
    setRegistry,
  })
  const {
    handleFile,
    handlePackageFile,
    handlePackageFolder,
    regenerateUploadedInterfacesCmake,
  } = upload

  const manual = useManualInterfaceController({
    loadApplyStatus,
    loadRegistry,
    onStateChanged,
    setBusy,
    setFeedback,
  })
  const {
    editingManualDefinition,
    manualDefinition,
    manualKind,
    manualMode,
    manualType,
    manualTypeName,
    setEditingManualDefinition,
    setManualDefinition,
    setManualKind,
    setManualMode,
    setManualType,
    setManualTypeName,
    setShowManualInput,
    showManualInput,
    startEditingManualDefinition,
    submitManualDefinition,
    submitManualType,
    validateCurrentManualDefinition,
  } = manual

  const deletion = useInterfaceDeleteActions({
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
  })
  const { removeManualDefinition, removePackage, removeRegistryEntry } = deletion

  const apply = useInterfaceApplyActions({
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
  })
  const { applyUploadedInterfaces, runImportCheck } = apply

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
