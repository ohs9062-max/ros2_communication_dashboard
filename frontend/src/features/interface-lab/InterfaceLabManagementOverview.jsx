import { InterfaceUploadControl } from '../../components/InterfaceUploadControl.jsx'
import { SummaryCard } from './workspace/WorkspaceCards.jsx'
import { applyStatusLabel } from './workspace/workspaceStatus.js'

export function InterfaceLabManagementOverview({
  applyStatus,
  error,
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
  return (
    <>
      <section className="interface-lab-hero">
        <div>
          <p className="eyebrow">Interface Lab</p>
          <h2>타입 등록, 빌드 적용, Service/Action 테스트</h2>
          <p>
            타입 등록은 “사용자가 이 타입을 쓰겠다”는 선언입니다.
            이미 설치되어 import됐고 Graph에 서버가 있는 타입만 실행 후보가 됩니다.
            Service request와 Action Goal은 사용자가 버튼을 누를 때만 전송됩니다.
          </p>
          <p className="interface-lab-note">
            단일 타입 등록만으로 없는 package, CMakeLists.txt, package.xml, 의존 msg 파일을 자동 생성하거나
            colcon build 성공을 보장하지 않습니다. 패키지 전체가 필요하면 Package zip/폴더 업로드를 사용하세요.
          </p>
          <p className="interface-lab-note">
            Interface Lab이 Publish·Receive·Service Call·Action Goal을 위해 만든
            Dashboard 내부 통신은 각 통신 탭의 Node 수에서 제외되며, 실행 이력은
            Interface Lab에 그대로 기록됩니다.
          </p>
        </div>
        <div className="interface-lab-actions">
          <button
            className="interface-reset-button"
            disabled={refreshing}
            onClick={onReset}
            type="button"
          >
            초기화
          </button>
          <button
            className="interface-refresh-button"
            disabled={refreshing}
            onClick={onRefresh}
            type="button"
          >
            {refreshing ? '새로고침 중…' : '상태 새로고침'}
          </button>
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
        <SummaryCard label="Message" value={summary.messages} />
        <SummaryCard label="Message import됨" value={summary.callableMessages} />
        <SummaryCard label="Service" value={summary.services} />
        <SummaryCard label="Action" value={summary.actions} />
        <SummaryCard label="import됨" value={summary.importable} />
        <SummaryCard label="build 필요" value={summary.rebuildRequired} tone={summary.rebuildRequired ? 'warning' : 'success'} />
        <SummaryCard label="Package" value={summary.packages} />
        <SummaryCard label="실행 가능 Service" value={summary.callableServices} />
        <SummaryCard label="실행 가능 Action" value={summary.callableActions} />
      </section>

      <section className="interface-workbench-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Upload / Apply / Run</p>
            <h2>인터페이스 작업 도구</h2>
          </div>
          <span className={applyStatus?.real_apply_success && !summary.rebuildRequired ? 'status-pill success' : 'status-pill warning'}>
            {applyStatusLabel(applyStatus, summary.rebuildRequired > 0)}
          </span>
        </div>
        <InterfaceUploadControl
          key={workbenchResetKey}
          onStateChanged={onStateChanged}
          onTopicWorkspaceExpandedChange={onTopicWorkspaceExpandedChange}
          refreshSignal={refreshSignal}
          websocket={websocket}
        />
        {error && <p className="interface-lab-error">{error.message}</p>}
      </section>
    </>
  )
}
