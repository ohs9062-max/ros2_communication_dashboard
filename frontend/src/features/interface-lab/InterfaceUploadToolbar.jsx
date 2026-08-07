export function InterfaceUploadToolbar({
  applying,
  busy,
  disabled,
  feedback,
  inputRef,
  onApply,
  onFile,
  onOpenAction,
  onOpenPackages,
  onOpenReceive,
  onOpenRegistry,
  onOpenService,
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
  return (
    <>
      <input accept=".msg,.srv,.action" className="interface-file-input" onChange={onFile} ref={inputRef} type="file" />
      <input accept=".zip" className="interface-file-input" onChange={onPackageFile} ref={packageInputRef} type="file" />
      <input className="interface-file-input" directory="" multiple onChange={onPackageFolder} ref={packageFolderInputRef} type="file" webkitdirectory="" />
      <button className="interface-type-entry-badge" disabled={disabled} onClick={onToggleManual} type="button">타입 기입</button>
      <button className="interface-upload-button" disabled={disabled} onClick={() => inputRef.current?.click()} type="button">
        {busy ? '처리 중…' : '타입 업로드'}
      </button>
      <button className="interface-package-button" disabled={disabled} onClick={() => packageInputRef.current?.click()} type="button">Package zip 업로드</button>
      <button className="interface-package-folder-button" disabled={disabled} onClick={() => packageFolderInputRef.current?.click()} type="button">Package 폴더 업로드</button>
      <label className="interface-package-replace">
        <input checked={replacePackage} disabled={disabled} onChange={(event) => onReplaceChange(event.target.checked)} type="checkbox" />
        <span>replace</span>
      </label>
      <button className="interface-apply-button" disabled={disabled} onClick={onApply} type="button">{applying ? '빌드 중…' : '적용하기'}</button>
      <button className="interface-registry-button" disabled={disabled} onClick={onOpenRegistry} type="button">등록 목록</button>
      <button className="interface-package-list-button" disabled={disabled} onClick={onOpenPackages} type="button">Package 목록</button>
      <button className="interface-topic-button" disabled={disabled} onClick={onOpenTopic} type="button">Topic 실행</button>
      <button className="interface-service-button" disabled={disabled} onClick={onOpenService} type="button">Service 실행</button>
      <button className="interface-action-button" disabled={disabled} onClick={onOpenAction} type="button">Action 실행</button>
      <button className="interface-receive-button" disabled={disabled} onClick={onOpenReceive} type="button">수신</button>
      {reloadPhase !== 'idle' && (
        <span className="interface-reload-state" role="status">{websocketStatus === 'connected' ? 'reload 대기' : '서버 재연결 중'}</span>
      )}
      {feedback && <span className={`interface-upload-feedback ${feedback.tone}`} role="status">{feedback.text}</span>}
    </>
  )
}
