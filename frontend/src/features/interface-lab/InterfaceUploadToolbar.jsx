export function InterfaceUploadToolbar({
  applying,
  busy,
  disabled,
  feedback,
  inputRef,
  onApply,
  onFile,
  onOpenAction,
  onOpenActionServer,
  onOpenPackages,
  onOpenRegistry,
  onOpenService,
  onOpenServiceServer,
  onOpenTopic,
  onPackageFile,
  onPackageFolder,
  onReplaceChange,
  onToggleManual,
  packageFolderInputRef,
  packageInputRef,
  reloadPhase,
  replacePackage,
  websocketStatus,
}) {
  const openPackage = () => packageInputRef.current?.click()
  return (
    <>
      <input accept=".msg,.srv,.action" className="interface-file-input" onChange={onFile} ref={inputRef} type="file" />
      <input accept=".zip" className="interface-file-input" onChange={onPackageFile} ref={packageInputRef} type="file" />
      <input className="interface-file-input" directory="" multiple onChange={onPackageFolder} ref={packageFolderInputRef} type="file" webkitdirectory="" />
      <div className="interface-management-toolbar-main">
        <div className="interface-management-groups">
          <section><strong>등록</strong><div>
            <button className="interface-type-entry-badge" disabled={disabled} onClick={onToggleManual} type="button">타입 직접 등록</button>
            <button className="interface-upload-button" disabled={disabled} onClick={() => inputRef.current?.click()} type="button">{busy ? '처리 중…' : '파일 업로드'}</button>
            <button className="interface-package-button" disabled={disabled} onClick={openPackage} type="button">Package 업로드</button>
          </div></section>
          <section><strong>적용</strong><div>
            <button className="interface-apply-button" disabled={disabled} onClick={onApply} type="button">{applying ? '빌드 중…' : '변경사항 적용'}</button>
          </div></section>
          <section><strong>관리</strong><div>
            <button className="interface-registry-button" disabled={disabled} onClick={onOpenRegistry} type="button">등록 목록</button>
            <button className="interface-package-list-button" disabled={disabled} onClick={onOpenPackages} type="button">Package 목록</button>
          </div></section>
          <section><strong>클라이언트 실행</strong><div>
            <button className="interface-topic-button" disabled={disabled} onClick={onOpenTopic} type="button">Topic 발행</button>
            <button className="interface-service-button" disabled={disabled} onClick={onOpenService} type="button">Service 호출</button>
            <button className="interface-action-button" disabled={disabled} onClick={onOpenAction} type="button">Action Goal</button>
          </div></section>
          <section><strong>서버 개설</strong><div>
            <button className="interface-service-button" disabled={disabled} onClick={onOpenServiceServer} type="button">Service 개설</button>
            <button className="interface-action-button" disabled={disabled} onClick={onOpenActionServer} type="button">Action 개설</button>
          </div></section>
        </div>
        <div className="interface-management-advanced-container">
          <details className="interface-management-advanced"><summary>업로드 고급 옵션</summary>
            <label className="interface-package-replace"><input checked={replacePackage} disabled={disabled} onChange={(event) => onReplaceChange(event.target.checked)} type="checkbox" /><span>기존 Package 교체</span></label>
            <button className="interface-package-folder-button" disabled={disabled} onClick={() => packageFolderInputRef.current?.click()} type="button">Package 폴더로 업로드</button>
          </details>
        </div>
      </div>
      {reloadPhase !== 'idle' && (
        <span className="interface-reload-state" role="status">{websocketStatus === 'connected' ? 'reload 대기' : '서버 재연결 중'}</span>
      )}
      {feedback && <span className={`interface-upload-feedback ${feedback.tone}`} role="status">{feedback.text}</span>}
    </>
  )
}
