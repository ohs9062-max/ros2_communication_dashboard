import { StatusBadge } from '../StatusBadge.jsx'
import { nodeConnectionCount } from '../../utils/graphTransform.js'

export function VisualizationNodePicker({ error, loading, nodes, onSelect }) {
  return (
    <>
      {loading && (
        <section className="notice-text visualization-mode-warning">
          데이터를 불러오는 중입니다.
        </section>
      )}
      {error && (
        <section className="notice-text warning visualization-mode-warning">
          ROS2 데이터를 불러오지 못했습니다. 백엔드 실행 상태와 API 주소를 확인하세요.
        </section>
      )}
      <section className="topic-section visualization-node-picker">
        <div className="section-heading">
          <div>
            <h2>Node 선택</h2>
            <p className="muted">
              Node를 선택하면 해당 Node와 직접 연결된 Topic, Service, Action 관계를 표시합니다.
            </p>
          </div>
        </div>
        <div className="visualization-node-list">
          {nodes.map((node) => {
            const name = node.full_name ?? node.name
            return (
              <button
                className="visualization-node-option"
                key={name}
                onClick={() => onSelect(name)}
                type="button"
              >
                <span>
                  <strong>{name}</strong>
                  <small>{node.namespace ?? '/'}</small>
                </span>
                <StatusBadge value={node.status ?? 'unknown'} />
                <em>{nodeConnectionCount(node)} 연결</em>
              </button>
            )
          })}
          {!nodes.length && (
            <div className="empty-state compact">검색 조건에 맞는 Node가 없습니다.</div>
          )}
        </div>
      </section>
    </>
  )
}
