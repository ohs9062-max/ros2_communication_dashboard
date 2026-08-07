import { formatChartValue, resourceTotal } from './overviewSummary.js'

export function OverviewColumnChart({
  items,
  onNavigate,
  onValueModeChange,
  valueMode,
}) {
  return (
    <section className="overview-column-chart">
      <div className="overview-chart-area">
        <div className="overview-chart-title">
          <h2>상태 분포</h2>
          <span className="muted">Node / Topic / Service / Action / Alert</span>
        </div>
        <div className="chart-plot">
          <span className="chart-axis-label y-axis">비율</span>
          <div className="chart-grid-lines" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
          <div className="chart-columns">
            {items.map((item) => (
              <button
                className="chart-column-button"
                key={item.id}
                onClick={() => onNavigate(item.id)}
                type="button"
              >
                <StackedColumn summary={item.summary} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <span className="chart-axis-label x-axis">리소스</span>
        </div>
      </div>
      <div className="overview-chart-side">
        <div className="chart-value-toggle" role="group" aria-label="상태분포 표시 방식">
          <button
            className={valueMode === 'percent' ? 'active' : ''}
            onClick={() => onValueModeChange('percent')}
            type="button"
          >백분율</button>
          <button
            className={valueMode === 'count' ? 'active' : ''}
            onClick={() => onValueModeChange('count')}
            type="button"
          >개수</button>
        </div>
        <div className="chart-legend">
          <span><i className="green" />정상</span>
          <span><i className="yellow" />주의</span>
          <span><i className="red" />오류/비활성</span>
        </div>
        <p className="overview-inactive-note">
          비활성은 현재 실행 중이 아니거나 관찰되지 않은 상태이며, 항상 장애를 의미하지는 않습니다.
        </p>
        <table className="chart-summary-table">
          <thead>
            <tr><th>구분</th><th>정상</th><th>주의</th><th>오류</th><th>합계</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <th>{item.label}</th>
                <td>{formatChartValue(item.summary.green, item.summary, valueMode)}</td>
                <td>{formatChartValue(item.summary.yellow, item.summary, valueMode)}</td>
                <td>{formatChartValue(item.summary.red, item.summary, valueMode)}</td>
                <td>{resourceTotal(item.summary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function StackedColumn({ summary }) {
  const total = resourceTotal(summary)
  if (total === 0) return <span className="chart-column empty" />

  return (
    <span className="chart-column">
      <span className="chart-column-segment green" style={{ height: `${(summary.green / total) * 100}%` }} />
      <span className="chart-column-segment yellow" style={{ height: `${(summary.yellow / total) * 100}%` }} />
      <span className="chart-column-segment red" style={{ height: `${(summary.red / total) * 100}%` }} />
    </span>
  )
}
