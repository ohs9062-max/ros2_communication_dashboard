export function applyStatusLabel(status, rebuildRequired = false) {
  if (rebuildRequired) return '등록 변경됨 · 빌드 필요'
  const value = status?.status ?? status?.build_status ?? 'idle'
  const labels = {
    failed: '빌드 실패',
    idle: '대기 중',
    import_failed: '빌드 성공 · import 확인 실패',
    partial: '일부 적용 필요',
    rebuild_required: '재빌드 필요',
    running: '빌드 진행 중',
    success: '적용 완료',
  }
  return labels[value] ?? value
}
