import { useState } from 'react'

import {
  registerManualType,
  updateManualDefinition,
  validateManualDefinition,
  writeManualDefinition,
} from '../../../api/interfaceManagement.js'

export const MANUAL_INTERFACE_PACKAGE = 'uploaded_interfaces'

export function useManualInterfaceController({
  loadApplyStatus,
  loadRegistry,
  onStateChanged,
  setBusy,
  setFeedback,
}) {
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
        ? await updateManualDefinition({
          kind: editingManualDefinition.kind,
          typeName: editingManualDefinition.typeName,
          definition: manualDefinition,
        })
        : await writeManualDefinition({
          package: MANUAL_INTERFACE_PACKAGE,
          kind: manualKind,
          type_name: manualTypeName,
          definition: manualDefinition,
        })
      const entry = payload.data ?? payload.entry
      setFeedback({
        tone: 'success',
        text: `${entry.full_type} 직접 작성 ${editingManualDefinition ? '수정' : '저장'} 완료 · 적용하기로 build/import를 진행하세요.`,
      })
      setEditingManualDefinition(null)
      await loadRegistry(true)
      await loadApplyStatus()
      onStateChanged?.()
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: `문법 오류가 있어 파일을 생성/수정하지 않았습니다. CMakeLists.txt도 수정하지 않았습니다. · ${error.message}`,
      })
    } finally {
      setBusy(false)
    }
  }

  const validateCurrentManualDefinition = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      await validateManualDefinition({
        package: MANUAL_INTERFACE_PACKAGE,
        kind: manualKind,
        type_name: manualTypeName,
        definition: manualDefinition,
      })
      setFeedback({
        tone: 'success',
        text: '문법 검증 통과 · 아직 파일/CMake/registry는 수정하지 않았습니다.',
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: `문법 오류가 있어 파일을 생성하지 않았습니다. CMakeLists.txt도 수정하지 않았습니다. · ${error.message}`,
      })
    } finally {
      setBusy(false)
    }
  }

  return {
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
  }
}
