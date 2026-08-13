import { CollapsibleList } from '../CollapsibleList.jsx'
import { ConnectionNodeList } from '../ConnectionNodeList.jsx'
import {
  actionPresentation,
  goalStatusLabel,
  resultStatusLabel,
} from '../../features/actions/actionPresentation.js'
import { servicePresentation } from '../../features/services/servicePresentation.js'

export function VisualizationKindDetails({ data }) {
  const entity = data.entity ?? {}
  if (data.kind === 'node') return <NodeDetails entity={entity} />
  if (data.kind === 'topic') return <TopicDetails data={data} entity={entity} />
  if (data.kind === 'service') return <ServiceDetails data={data} entity={entity} />
  return <ActionDetails data={data} entity={entity} />
}

function NodeDetails({ entity }) {
  return (
    <>
      <DetailLine label="발행 수" value={entity.publisher_count} />
      <DetailLine label="구독 수" value={entity.subscriber_count} />
      <DetailLine label="응답 Service 수" value={entity.service_server_count} />
      <DetailLine label="요청 Service 수" value={entity.service_client_count} />
      <DetailLine label="Goal 실행 Action 수" value={entity.action_server_count} />
      <DetailLine label="Goal 요청 Action 수" value={entity.action_client_count} />
      <EntityList emptyMessage="관련 Topic 없음" items={[...(entity.topic_publishers ?? []), ...(entity.topic_subscribers ?? [])]} title="관련 Topic" />
      <EntityList emptyMessage="관련 Service 없음" items={[...(entity.service_servers ?? []), ...(entity.service_clients ?? [])]} title="관련 Service" />
      <EntityList emptyMessage="관련 Action 없음" items={[...(entity.action_servers ?? []), ...(entity.action_clients ?? [])]} title="관련 Action" />
    </>
  )
}

function TopicDetails({ data, entity }) {
  return (
    <>
      <DetailLine label="발행자" value={entity.publisher_count} />
      <DetailLine label="구독자" value={entity.subscriber_count} />
      <DetailLine label="Hz" value={entity.hz ?? entity.frequency_hz} />
      <p className="detail-help-text">표시된 Node 목록은 ROS2 Graph에서 확인된 Node 기준입니다.</p>
      <ConnectionNodeList emptyText="발행자 Node 없음" items={data.participants?.publishers ?? []} title="발행자 Node" />
      <ConnectionNodeList emptyText="구독자 Node 없음" items={data.participants?.subscribers ?? []} title="구독자 Node" />
    </>
  )
}

function ServiceDetails({ data, entity }) {
  const presentation = servicePresentation(entity)
  return (
    <>
      <DetailLine label="서버 수" value={presentation.serverNodeCount} />
      <DetailLine label="클라이언트 수" value={presentation.clientNodeCount} />
      <DetailLine label="최근 호출 결과" value={presentation.callLabel} />
      <p className="detail-help-text">요청자 Node는 요청을 보내고, 응답자 Node는 요청을 받아 응답합니다.</p>
      <ConnectionNodeList emptyText="응답자 Node 없음" items={data.participants?.servers ?? []} title="응답자 Node" />
      <ConnectionNodeList emptyText="요청자 Node 없음" items={data.participants?.clients ?? []} title="요청자 Node" />
    </>
  )
}

function ActionDetails({ data, entity }) {
  const presentation = actionPresentation(entity)
  return (
    <>
      <DetailLine label="서버 수" value={entity.server_count} />
      <DetailLine label="클라이언트 수" value={entity.client_count} />
      <DetailLine label="마지막 Goal 상태" value={goalStatusLabel(presentation.goalStatus)} />
      <DetailLine label="결과 상태" value={resultStatusLabel(presentation.result.value)} />
      <DetailLine label="관찰 Goal 수" value={presentation.observedGoalCount} />
      <p className="detail-help-text">Goal 요청자 Node는 Goal을 보내고, Goal 실행자 Node는 Goal을 받아 실행합니다.</p>
      <ConnectionNodeList emptyText="Goal 실행자 Node 없음" items={data.participants?.servers ?? []} title="Goal 실행자 Node" />
      <ConnectionNodeList emptyText="Goal 요청자 Node 없음" items={data.participants?.clients ?? []} title="Goal 요청자 Node" />
    </>
  )
}

function DetailLine({ label, value }) {
  return <div className="detail-line"><span>{label}</span><strong>{value ?? '-'}</strong></div>
}

function EntityList({ emptyMessage, items = [], title }) {
  return (
    <CollapsibleList
      emptyText={emptyMessage}
      items={items}
      renderItem={(item) => <><strong>{item.name}</strong><span>{item.type ?? item.types?.[0] ?? '-'}</span></>}
      title={title}
    />
  )
}
