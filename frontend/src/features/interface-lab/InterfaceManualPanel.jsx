import { ExecutionPanelHeading } from './execution/ExecutionPanelHeading.jsx'

const MANUAL_DEFINITION_EXAMPLES = {
  msg: '예:\nuint8 cmd\nbool success\nstring message',
  srv: '예:\nuint8 cmd\n---\nbool success\nstring message',
  action: '예:\nuint8 command\n---\nbool success\n---\nstring status',
}

export function ManualInterfacePanel({
  disabled,
  editingManualDefinition,
  expanded,
  manualDefinition,
  manualKind,
  manualMode,
  manualType,
  manualTypeName,
  onCancelEdit,
  onDefinitionChange,
  onKindChange,
  onModeChange,
  onClose,
  onSubmitDefinition,
  onSubmitType,
  onTypeChange,
  onTypeNameChange,
  onToggleExpanded,
  onValidateDefinition,
}) {
  return (
    <div className="interface-manual-panel">
      <ExecutionPanelHeading
        expanded={expanded}
        onClose={onClose}
        onToggleExpanded={onToggleExpanded}
        showExpand
        title="타입 직접 등록"
      />
      <div className="interface-manual-tabs">
        <button className={manualMode === 'type' ? 'active' : ''} onClick={() => onModeChange('type')} type="button">
          기존 빌드 타입 등록
        </button>
        <button className={manualMode === 'definition' ? 'active' : ''} onClick={() => onModeChange('definition')} type="button">
          인터페이스 직접 작성
        </button>
      </div>
      {manualMode === 'type' ? (
        <div className="interface-manual-form">
          <p className="interface-package-help">
            다른 ROS2 워크스페이스에서 이미 빌드되어 현재 환경에서 import 가능한 인터페이스 타입을 등록합니다.
            .msg, .srv, .action 파일을 새로 생성하거나 colcon build를 수행하지 않습니다.
          </p>
          <label className="interface-service-field">
            <span>full type</span>
            <input placeholder="예: rths_interfaces/srv/ScheduleCrud" value={manualType} onChange={(event) => onTypeChange(event.target.value)} />
          </label>
          <button className="interface-service-call-button" disabled={disabled} onClick={onSubmitType} type="button">타입 등록</button>
        </div>
      ) : (
        <div className="interface-manual-form">
          <p className="interface-package-help">
            .msg/.srv/.action 파일을 uploaded_interfaces 패키지에 직접 생성합니다. 저장 전 문법 검증을 수행하며, 저장 후 적용하기 build가 필요합니다.
          </p>
          {editingManualDefinition && (
            <div className="interface-service-state warning">Editing: {editingManualDefinition.kind}/{editingManualDefinition.typeName}</div>
          )}
          <div className="interface-manual-fixed-path">
            저장 위치: ros2_ws/src/uploaded_interfaces/generated_interfaces/{manualKind}/{manualTypeName || 'TypeName'}.{manualKind}
          </div>
          <label className="interface-service-field">
            <span>kind</span>
            <select value={manualKind} onChange={(event) => onKindChange(event.target.value)}>
              <option value="msg">msg</option><option value="srv">srv</option><option value="action">action</option>
            </select>
          </label>
          <label className="interface-service-field">
            <span>type name</span>
            <input placeholder="예: MyControl" value={manualTypeName} onChange={(event) => onTypeNameChange(event.target.value)} />
          </label>
          <label className="interface-service-field">
            <span>definition</span>
            <textarea placeholder={MANUAL_DEFINITION_EXAMPLES[manualKind]} rows="8" value={manualDefinition} onChange={(event) => onDefinitionChange(event.target.value)} />
          </label>
          <div className="interface-receive-actions">
            <button className="interface-receive-action-button ghost" disabled={disabled} onClick={onValidateDefinition} type="button">문법 검증</button>
            <button className="interface-receive-action-button primary" disabled={disabled} onClick={onSubmitDefinition} type="button">
              {editingManualDefinition ? '인터페이스 수정 저장' : '인터페이스 저장'}
            </button>
            {editingManualDefinition && <button className="interface-receive-action-button" disabled={disabled} onClick={onCancelEdit} type="button">수정 취소</button>}
          </div>
        </div>
      )}
    </div>
  )
}
