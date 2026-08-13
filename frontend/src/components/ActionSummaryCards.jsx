import { SummaryCard } from './SummaryCard.jsx'
import { actionPresentation } from '../features/actions/actionPresentation.js'

export function ActionSummaryCards({
  actions = [],
  activeActions = [],
  meta = {},
}) {
  const presentations = actions.map(actionPresentation)
  const runningCount = presentations.filter((item) => item.isRunning).length
  const succeededCount = presentations.filter((item) => item.isSucceeded).length
  const failedCanceledCount = presentations.filter(
    (item) => item.isFailedOrCanceled,
  ).length
  return (
    <div className="summary-grid action-summary-grid">
      <SummaryCard label="전체 Action" value={meta.count ?? 0} />
      <SummaryCard label="주요 Action" value={activeActions.length} tone="good" />
      <SummaryCard label="실행 중" value={runningCount} />
      <SummaryCard label="성공" value={succeededCount} tone="good" />
      <SummaryCard
        label="실패/취소"
        tone={failedCanceledCount ? 'bad' : 'default'}
        value={failedCanceledCount}
      />
    </div>
  )
}
