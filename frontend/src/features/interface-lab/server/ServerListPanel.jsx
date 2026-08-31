import { useEffect } from 'react'

import { ExecutionPanelHeading } from '../execution/ExecutionPanelHeading.jsx'

export function ServerListPanel({
  error = '',
  onClose,
  onRefresh = async () => {},
  onStop = () => {},
  servers = [],
  stoppingKey = '',
}) {
  useEffect(() => {
    const timer = window.setInterval(() => onRefresh().catch(() => {}), 1000)
    return () => window.clearInterval(timer)
  }, [onRefresh])

  return (
    <div className="interface-service-panel interface-execution-panel interface-server-panel interface-server-list-panel">
      <ExecutionPanelHeading onClose={onClose} title="개설 목록" />
      <p className="muted interface-server-list-help">
        Interface Lab Runtime에 현재 살아 있는 Service/Action Server만 표시합니다.
      </p>
      {error && <p className="error-text interface-server-list-message">{error}</p>}
      {!error && servers.length === 0 && (
        <p className="muted interface-server-list-message">현재 개설된 Server가 없습니다.</p>
      )}
      {servers.length > 0 && (
        <div className="interface-server-list-scroll">
          <div className="interface-server-list">
            <div className="interface-server-list-header" role="row">
              <span>Type</span>
              <span>Domain</span>
              <span>Name</span>
              <span>Interface Type</span>
              <span>상태</span>
              <span>관리</span>
            </div>
            {servers.map((server) => (
              <div className="interface-server-list-row" key={server.identityKey}>
                <span className={`interface-server-kind ${server.kind}`}>{server.kindLabel}</span>
                <strong>D{server.domainId}</strong>
                <code>{server.name}</code>
                <code>{server.interfaceType}</code>
                <span className="domains-status good"><span className="dot" />실행 중</span>
                <button
                  disabled={Boolean(stoppingKey)}
                  onClick={() => onStop(server)}
                  type="button"
                >
                  {stoppingKey === server.identityKey ? '종료 중…' : '종료'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
