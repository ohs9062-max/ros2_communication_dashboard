import { ReceiveHistory } from '../InterfaceExecutionShared.jsx'
import { ActionQosControl } from '../execution/ActionQosControl.jsx'
import { QosModeControl } from '../execution/QosModeControl.jsx'
import { actionKey, serviceKey } from '../model/interfaceUploadModel.js'

const CONFIG = {
  action: {
    historyTitle: 'Action feedback/result receive history',
    key: actionKey,
    label: 'Action',
    name: (item) => item.action_name || item.file_name,
    placeholder: 'Action 이름 또는 type 검색',
    type: (item) => item.action_type,
  },
  service: {
    historyTitle: 'Service response receive history',
    key: serviceKey,
    label: 'Service',
    name: (item) => item.service_name || item.file_name,
    placeholder: 'Service 이름 또는 type 검색',
    type: (item) => item.service_type,
  },
}

export function ResourceReceivePanel({
  activeKey,
  domainIds = [],
  history,
  items,
  kind,
  modeLinked,
  onDomainChange = () => {},
  qosControls = [],
  onRefresh,
  onModeLinkChange,
  onResetAll,
  onResetSelected,
  onSearchChange,
  onSelect,
  onStart,
  onStop,
  search,
  selectedDomainId = null,
  selectedKey,
  visibleItems,
}) {
  const config = CONFIG[kind]
  const receiving = Boolean(selectedKey && activeKey === selectedKey)
  return (
    <div className="interface-receive-grid">
      <label className="interface-service-field">
        <span>Domain</span>
        <select onChange={(event) => onDomainChange(event.target.value === '' ? null : Number(event.target.value))} value={selectedDomainId ?? ''}>
          <option value="">Domain 선택</option>
          {domainIds.map((domainId) => <option key={domainId} value={domainId}>D{domainId}</option>)}
        </select>
      </label>
      <label className="interface-service-field">
        <span>항목 검색</span>
        <input placeholder={config.placeholder} value={search} onChange={(event) => onSearchChange(event.target.value)} />
      </label>
      <label className="interface-service-field">
        <span>{config.label} · D{selectedDomainId ?? '-'} · {visibleItems.length}/{items.length}</span>
        <select value={selectedKey} onChange={(event) => onSelect(event.target.value)}>
          {visibleItems.map((item) => (
            <option key={config.key(item)} value={config.key(item)}>
              {config.name(item)} · D{item.domain_id} · {config.type(item)}
            </option>
          ))}
        </select>
        {!visibleItems.length && <small>검색 결과가 없습니다.</small>}
      </label>
      {kind === 'action' && (
        <ActionQosControl controls={qosControls} modeLinked={modeLinked} onModeLinkChange={onModeLinkChange} />
      )}
      {kind !== 'action' && qosControls.map((control) => (
        <QosModeControl
          groups={[{ key: control.key, label: control.label, onChange: control.onProfileChange, profile: control.profile }]}
          key={control.key}
          mode={control.mode}
          modeLinked={modeLinked}
          onModeChange={control.onModeChange}
          onModeLinkChange={onModeLinkChange}
        />
      ))}
      <ReceiveActions
        onRefresh={onRefresh}
        onResetAll={onResetAll}
        onResetSelected={onResetSelected}
        onStart={onStart}
        onStop={onStop}
        receiving={receiving}
        selected={Boolean(selectedKey)}
      />
      <ReceiveHistory title={config.historyTitle} items={history} />
    </div>
  )
}

function ReceiveActions({ onRefresh, onResetAll, onResetSelected, onStart, onStop, receiving, selected }) {
  return (
    <div className="interface-receive-actions">
      <button className={receiving ? 'interface-receive-action-button receiving' : 'interface-receive-action-button primary'} disabled={!selected || receiving} onClick={onStart} type="button">
        {receiving ? '수신 중' : '수신 시작'}
      </button>
      <button className="interface-receive-action-button" onClick={onStop} type="button">수신 중지</button>
      <button className="interface-receive-action-button warning" onClick={onResetSelected} type="button">선택 이력 리셋</button>
      <button className="interface-receive-action-button warning" onClick={onResetAll} type="button">전체 이력 리셋</button>
      <button className="interface-receive-action-button ghost" onClick={onRefresh} type="button">새로고침</button>
    </div>
  )
}
