import { InterfaceUploadControl } from '../../components/InterfaceUploadControl.jsx'
import { SummaryCard } from './workspace/WorkspaceCards.jsx'
import { applyStatusLabel } from './workspace/workspaceStatus.js'

export function InterfaceLabManagementOverview({
  applyStatus,
  error,
  executionRequest,
  lastRefreshedAt,
  onRefresh,
  onReset,
  onStateChanged,
  onTopicWorkspaceExpandedChange,
  refreshing,
  refreshSignal,
  summary,
  websocket,
  workbenchResetKey,
}) {
  const registeredCount = summary.messages + summary.services + summary.actions
  const callableCount = summary.callableMessages + summary.callableServices + summary.callableActions
  const errorCount = summary.errors ?? 0
  return (
    <>
      <section className="interface-lab-hero">
        <div>
          <p className="eyebrow">Interface Lab</p>
          <h2>Interface 등록 및 통신 테스트</h2>
          <p>목록에서 Interface를 선택해 Publish, Receive, Service Call 또는 Action Goal을 실행합니다.</p>
          <details className="interface-lab-cautions">
            <summary>사용 전 주의사항</summary>
            <p>단일 타입 등록은 없는 package나 의존 파일 생성 및 colcon build 성공을 보장하지 않습니다. 패키지 전체가 필요하면 Package 업로드를 사용하세요.</p>
            <p>Dashboard 내부 실행 Node는 통신 탭의 외부 Node 수에서 제외되며 실행 이력은 Interface Lab에 기록됩니다.</p>
          </details>
        </div>
        <div className="interface-lab-actions">
          <button
            className="interface-refresh-button"
            disabled={refreshing}
            onClick={onRefresh}
            type="button"
          >
            {refreshing ? '새로고침 중…' : '상태 새로고침'}
          </button>
          <button className="interface-reset-button compact" disabled={refreshing} onClick={onReset} type="button">화면 초기화</button>
          <span className="interface-refresh-meta" role="status">
            {refreshing
              ? 'registry / apply / callable 상태를 다시 읽는 중'
              : lastRefreshedAt
              ? `마지막 갱신 ${lastRefreshedAt.toLocaleTimeString()}`
              : '아직 갱신 전'}
          </span>
        </div>
      </section>

      <section className="interface-summary-grid">
        <SummaryCard label="등록 Interface" value={registeredCount} />
        <SummaryCard label="실행 가능" value={callableCount} tone="success" />
        <SummaryCard label="build 필요" value={summary.rebuildRequired} tone={summary.rebuildRequired ? 'warning' : 'success'} />
        <SummaryCard label="오류" value={errorCount} tone={errorCount ? 'warning' : 'success'} />
      </section>

      <section className="interface-workbench-card interface-management-details interface-management-fixed">
        <div className="interface-management-heading">
          <span>Interface 관리</span>
          <span className={applyStatus?.real_apply_success && !summary.rebuildRequired ? 'status-pill success' : 'status-pill warning'}>{applyStatusLabel(applyStatus, summary.rebuildRequired > 0)}</span>
        </div>
        <InterfaceUploadControl executionRequest={executionRequest} key={workbenchResetKey} onStateChanged={onStateChanged} onTopicWorkspaceExpandedChange={onTopicWorkspaceExpandedChange} refreshSignal={refreshSignal} websocket={websocket} />
        {error && <p className="interface-lab-error">{error.message}</p>}
      </section>
    </>
  )
}
