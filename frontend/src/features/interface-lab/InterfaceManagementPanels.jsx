import {
  PackageRegistry,
  RegistryGroup,
  deletedRegistryItemsFor,
} from './InterfaceUploadParts.jsx'

export function BuildFailurePanel({
  applying,
  buildLogTail,
  busy,
  onApply,
  onRegenerate,
  onToggle,
  open,
}) {
  if (!buildLogTail) return null
  const disabled = busy || applying
  return (
    <>
      <button className="interface-error-toggle" onClick={onToggle} type="button">
        {open ? '상세 오류 숨기기' : '상세 오류 보기'}
      </button>
      {open && (
        <div className="interface-build-log-panel">
          <div className="interface-registry-heading"><strong>상세 오류</strong></div>
          <div className="interface-receive-actions">
            <button className="interface-receive-action-button ghost" disabled={disabled} onClick={onRegenerate} type="button">CMake 재생성</button>
            <button className="interface-receive-action-button primary" disabled={disabled} onClick={onApply} type="button">적용 다시 실행</button>
          </div>
          <pre className="interface-build-log">{buildLogTail}</pre>
        </div>
      )}
    </>
  )
}

export function RegisteredInterfacesPanel({
  onDelete,
  onDeleteManual,
  onEditManual,
  recentDeletedRegistry,
  registry,
}) {
  return (
    <div className="interface-registry-panel">
      <div className="interface-registry-heading"><strong>등록된 타입</strong></div>
      <RegistryGroup deletedItems={deletedRegistryItemsFor('msg', recentDeletedRegistry)} items={registry?.messages} label="Message" onDelete={onDelete} onDeleteManual={onDeleteManual} onEditManual={onEditManual} />
      <RegistryGroup deletedItems={deletedRegistryItemsFor('srv', recentDeletedRegistry)} items={registry?.services} label="Service" onDelete={onDelete} onDeleteManual={onDeleteManual} onEditManual={onEditManual} />
      <RegistryGroup deletedItems={deletedRegistryItemsFor('action', recentDeletedRegistry)} items={registry?.actions} label="Action" onDelete={onDelete} onDeleteManual={onDeleteManual} onEditManual={onEditManual} />
    </div>
  )
}

export function UploadedPackagesPanel({ expanded, onDelete, onToggleExpanded, packages }) {
  return (
    <div className="interface-package-panel">
      <div className="interface-registry-heading interface-panel-heading">
        <strong>Uploaded Interface Packages</strong>
        <button aria-pressed={expanded} className="interface-panel-expand-button" onClick={onToggleExpanded} type="button">
          {expanded ? '목록보기' : '크게보기'}
        </button>
      </div>
      <p className="interface-package-help">장비가 실제 사용하는 원본 interface package를 패키지명 그대로 등록합니다.</p>
      <PackageRegistry packages={packages} onDelete={onDelete} />
    </div>
  )
}
