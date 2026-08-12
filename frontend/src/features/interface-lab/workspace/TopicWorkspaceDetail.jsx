import { firstType } from '../model/workspacePresentation.js'
import { TopicPublishPanel } from './TopicPublishPanel.jsx'
import { TopicSubscribePanel } from './TopicSubscribePanel.jsx'
import { CollapsibleJson, ConnectionList, HistoryList, LastResultBlock, SectionTitle } from './WorkspaceShared.jsx'

export function TopicWorkspaceDetail(props) {
  const { inlineResult, item, onHistorySelect, onReset, selectedHistoryItem, view } = props
  return (
    <>
      {view === 'execute' && <><TopicPublishPanel {...props} /><LastResultBlock fallback={item.lastRun} result={inlineResult} title="최근 실행 결과" /></>}
      {view === 'receive' && <TopicSubscribePanel {...props} />}
      {view === 'history' && <HistoryList
        empty="최근 Topic Publish/Subscribe 이력이 없습니다."
        items={item.history}
        onSelect={onHistorySelect}
        onReset={onReset}
        selected={selectedHistoryItem}
        type="topic"
      />}
      {(view === 'details' || view === 'advanced') && <>
        <SectionTitle title="Graph 연결" />
        <ConnectionList empty="Graph에서 이 Message full_type으로 열린 Topic이 없습니다." items={item.connectedTopics} render={(topic) => [topic.name, firstType(topic.type ?? topic.types) ?? '-', `publishers ${topic.publisher_count ?? 0}`, `subscribers ${topic.subscriber_count ?? 0}`].join(' · ')} />
        {(item.graphConflicts ?? []).length > 0 && <CollapsibleJson title="같은 Topic 이름의 다른 type 경고" value={item.graphConflicts} />}
      </>}
    </>
  )
}
