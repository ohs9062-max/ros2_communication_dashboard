import {
  fetchInterfaceApplyStatus,
  fetchInterfaceRegistry,
  rebuildUploadedInterfacesCmake,
  uploadInterface,
  uploadInterfacePackage,
  uploadInterfacePackageFolder,
} from '../../../api/interfaceManagement.js'
import { interfaceCounts } from '../model/interfaceUploadModel.js'

const ACCEPTED_EXTENSIONS = ['.msg', '.srv', '.action']

export function useInterfaceUploadActions({
  loadApplyStatus,
  loadPackages,
  onStateChanged,
  replacePackage,
  setApplyStatus,
  setBuildLogTail,
  setBusy,
  setFeedback,
  setRegistry,
}) {
  const uploadFiles = async (files, sourceLabel) => {
    const supportedFiles = files.filter((file) =>
      ACCEPTED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension)))
    if (!supportedFiles.length) {
      setFeedback({ tone: 'error', text: `No .msg, .srv, or .action file was found in ${sourceLabel}.` })
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
      const hasIssue = failed.length > 0 || warned.length > 0
      const summary = hasIssue
        ? [`${sourceLabel}: ${supportedFiles.length} processed`, `${succeeded.length} succeeded`, warned.length ? `${warned.length} warning(s)` : null, failed.length ? `${failed.length} failed` : null].filter(Boolean).join(' · ')
        : `${supportedFiles.length}개 파일 처리 · 성공 ${succeeded.length}`
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
          text: `${summary} · Registration completed, but some status data failed to refresh. Refresh the status and try again. · ${refreshFailure.reason.message}`,
        })
      }
      onStateChanged?.()
    } catch (error) {
      setFeedback({ tone: 'error', text: `Failed to process ${sourceLabel}. · ${error.message}` })
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length) await uploadFiles(files, 'file upload')
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
      setFeedback({ tone: 'error', text: 'The interface package must be a .zip file.' })
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
      setFeedback({ tone: 'error', text: 'Select a ROS2 package folder containing package.xml, CMakeLists.txt, and msg, srv, or action files.' })
      return
    }
    await uploadPackage(packageFiles, true)
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

  return {
    handleFile,
    handlePackageFile,
    handlePackageFolder,
    regenerateUploadedInterfacesCmake,
  }
}
