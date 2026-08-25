import { formatMs, formatRelativeTime, formatTime } from '../utils/format.js'
import { withExecutionNode } from '../utils/participants.js'
import { displayText } from '../utils/displayText.js'
import { ConnectionNodeList } from './ConnectionNodeList.jsx'
import { CommunicationHistory } from './CommunicationHistory.jsx'
import { DetailSection } from './DetailSection.jsx'
import { QosDetails } from './QosDetails.jsx'
import { QosSummaryNotice } from './QosSummary.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { servicePresentation } from '../features/services/servicePresentation.js'

export function ServiceDetailPanel({ onClose, participants, service, qosFocusRequest }) {
  if (!service) {
    return (
      <aside className="detail-panel">
        <div className="empty-state">
          발견된 Service가 있으면 상세 정보가 표시됩니다
        </div>
      </aside>
    )
  }

  const presentation = servicePresentation(service)
  const callSummary = presentation.summary

  return (
    <aside className="detail-panel">
      <div className="panel-heading">
        <span>Service 상세</span>
        <div className="detail-panel-heading-actions">
          <StatusBadge
            label={presentation.statusLabel}
            value={presentation.effectiveStatus}
          />
          <button className="detail-panel-close" onClick={onClose} type="button">닫기 ×</button>
        </div>
      </div>
      <h2>{service.name}</h2>
      <p className="muted">{service.type ?? '-'}</p>

      <QosSummaryNotice
        kind="service"
        qos={service}
      />

      {service.hidden_by_default === true && (
        <p className="notice-text">
          이 Service는 ROS2 내부/파라미터/Action 내부 Service로 기본 화면에서는
          숨겨집니다.
        </p>
      )}

      <DetailSection title="상태 요약">
        <DetailLine label="이름" value={service.name} />
        <DetailLine label="타입" value={service.type ?? '-'} />
        <DetailLine label="분류" value={displayText(service.category)} />
        <DetailLine
          label="기본 숨김"
          value={service.hidden_by_default ? '예' : '아니오'}
        />
        <DetailLine
          label="서버 상태"
          tone={presentation.serverStatusTone}
          value={presentation.serverStatusLabel}
        />
        <DetailLine
          label="최근 호출 결과"
          tone={presentation.callTone}
          value={presentation.callLabel}
        />
        <DetailLine label="상태 이유" value={displayText(service.reason)} />
        <DetailLine label="마지막 갱신" value={formatTime(service.last_updated)} />
      </DetailSection>

      <QosDetails
        focusRequest={qosFocusRequest?.name === service.name ? qosFocusRequest : null}
        qos={service}
        title="Service QoS"
      />

      <DetailSection collapsible title="연결 정보">
        <DetailLine
          label="Server Node 수 (Dashboard 제외)"
          value={presentation.serverNodeCount}
        />
        <DetailLine
          label="Client Node 수 (Dashboard 제외)"
          value={presentation.clientNodeCount}
        />
        <DetailLine
          label="Server Endpoint 수"
          value={presentation.serverEndpointCount}
        />
        <DetailLine
          label="Client Endpoint 수"
          value={presentation.clientEndpointCount}
        />
        <p className="detail-help-text">
          요청자 Node는 요청을 보내고, 응답자 Node는 요청을 받아 응답합니다.
          Dashboard가 Interface Lab 호출을 위해 만든 Client는 외부 Node 수에서
          제외하고, 요청자 목록에는 내부 실행 주체로 구분해 표시합니다.
          Endpoint 수는 Dashboard 통신을 포함한 Graph 원본 진단값입니다.
        </p>
        <ConnectionNodeList
          emptyText="응답자 Node 없음"
          items={participants?.servers ?? []}
          title="응답자 Node"
        />
        <ConnectionNodeList
          emptyText="요청자 Node 없음"
          items={withExecutionNode(
            participants?.clients ?? [],
            service.dashboard_communication?.execution_node,
          )}
          title="요청자 Node"
        />
      </DetailSection>

      <DetailSection collapsible title="사용자 Service Call">
        <DetailLine
          label="호출 가능"
          tone={service.callable ? 'good' : service.allowlisted ? 'warn' : 'muted'}
          value={service.callable ? '예' : service.allowlisted ? '등록됨' : '아니오'}
        />
        <DetailLine
          label="마지막 호출"
          value={formatRelativeTime(presentation.lastCalledAt)}
        />
        <DetailLine
          label="마지막 호출 상태"
          tone={presentation.callTone}
          value={presentation.callLabel}
        />
        <DetailLine
          label="서버 전송"
          tone={presentation.sentToServer === false ? 'warn' : 'muted'}
          value={
            callSummary
              ? presentation.sentToServer ? '예' : '아니오'
              : '-'
          }
        />
        {callSummary?.error_type === 'validation_error' && (
          <p className="notice-text warning">
            The payload does not match the Service type. No request was sent to the server.
          </p>
        )}
        <DetailLine
          label="호출 응답 시간"
          value={formatMs(presentation.responseTimeMs)}
        />
        <DetailLine label="마지막 호출 오류" value={presentation.callError ?? '-'} />
        <DetailLine label="호출 수" value={service.call_count ?? 0} />
        <DetailLine label="성공/실패" value={`${service.success_count ?? 0}/${service.failure_count ?? 0}`} />
      </DetailSection>

      <CommunicationHistory
        domainId={service.domain_id}
        kind="service"
        name={service.name}
        resourceType={service.type}
      />

      <DetailSection collapsible title="상세 데이터">
        <details>
          <summary>마지막 요청 JSON</summary>
          <pre className="preview-json">
            {presentation.requestPreview
              ? JSON.stringify(presentation.requestPreview, null, 2)
              : '데이터 없음'}
          </pre>
        </details>
        <details>
          <summary>마지막 응답 JSON</summary>
          <pre className="preview-json">
            {presentation.responsePreview
              ? JSON.stringify(presentation.responsePreview, null, 2)
              : '데이터 없음'}
          </pre>
        </details>
        <details>
          <summary>최근 호출 History JSON</summary>
          <pre className="preview-json">
            {callSummary?.history
              ? JSON.stringify(callSummary.history, null, 2)
              : '데이터 없음'}
          </pre>
        </details>
      </DetailSection>
    </aside>
  )
}

function DetailLine({ label, tone, value }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      <strong className={tone ? `detail-value-${tone}` : undefined}>
        {value}
      </strong>
    </div>
  )
}
