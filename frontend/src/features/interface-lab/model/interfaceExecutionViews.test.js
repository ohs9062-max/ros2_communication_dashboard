import assert from 'node:assert/strict'
import test from 'node:test'

import { interfaceExecutionViews } from './interfaceExecutionViews.js'

function fixture(receiveMode = 'action') {
  const noop = () => {}
  const action = {
    actions: [{ action_name: '/navigate' }], busy: false, execute: noop,
    goalValues: { pose: {} }, history: [{ id: 'goal' }], importableOnly: true,
    result: { accepted: true }, selected: { action_name: '/navigate' }, selectedKey: 'action-key',
    select: noop, setGoalValues: noop, setImportableOnly: noop, setTimeoutSec: noop,
    timeoutSec: 10, visibleActions: [{ action_name: '/navigate' }],
  }
  const service = {
    services: [{ service_name: '/control' }], busy: false, execute: noop,
    history: [{ id: 'call' }], importableOnly: false, requestQosMode: 'auto',
    requestQosProfile: { depth: 10 }, requestValues: { command: 1 }, responseQosMode: 'manual',
    responseQosProfile: { depth: 4 }, result: { success: true }, select: noop,
    selected: { service_name: '/control' }, selectedKey: 'service-key', setImportableOnly: noop,
    setRequestValues: noop, setTimeoutSec: noop, timeoutSec: 2,
    visibleServices: [{ service_name: '/control' }],
  }
  const topic = {
    activeContinuousPublish: null, busy: false, changePublishName: noop,
    importableOnly: false, messageValues: { data: 'hello' }, messages: [{ message_type: 'std_msgs/msg/String' }],
    publish: noop, publishGraphTopics: ['/chatter'], publishHz: 1, publishName: '/chatter',
    publishWarning: null, qosMode: 'auto', qosProfile: { depth: 10 }, resetHistory: noop,
    result: { success: true }, select: noop, selected: { message_type: 'std_msgs/msg/String' },
    selectedKey: 'topic-key', setImportableOnly: noop, setMessageValues: noop, setPublishHz: noop,
    startContinuous: noop, stopContinuous: noop, visibleHistory: [{ id: 'publish' }],
    visibleMessages: [{ message_type: 'std_msgs/msg/String' }],
  }
  const receive = {
    actionSearch: '', activeActionKey: 'active-action', activeServiceKey: 'active-service',
    changeTopic: noop, filteredActions: action.actions, filteredServices: service.services,
    filteredTopics: ['/chatter'], load: noop, mode: receiveMode, qosMode: 'manual',
    qosProfile: { depth: 3 }, resetActions: noop, resetAllTopics: noop,
    resetSelectedTopic: noop, resetServices: noop, selectedTopic: '/chatter',
    selectedTopicReceiving: true, serviceSearch: '', setActionSearch: noop,
    setServiceSearch: noop, setTopicSearch: noop, startAction: noop, startService: noop,
    startTopic: noop, stopAction: noop, stopService: noop, stopTopic: noop, topicSearch: '',
    topics: ['/chatter'], visibleActionHistory: [], visibleServiceHistory: [], visibleTopicHistory: [],
  }
  const panel = {
    closeExecutionPanels: noop, closeReceivePanel: noop, expanded: false,
    selectReceiveMode: noop, showCallableActions: true, showCallableServices: true,
    showCallableTopics: true, showReceivePanel: true, toggleWorkspaceExpanded: noop,
  }
  const actionQosLink = {
    changeExecutionMode: noop, changeExecutionProfile: noop, changeReceiveMode: noop,
    changeReceiveProfile: noop, linkFromExecution: noop, linkFromReceive: noop, linked: true,
  }
  const serviceQosLink = { ...actionQosLink, linked: false }
  const topicQosLink = { ...actionQosLink, linked: true }

  return {
    action,
    availableTopics: ['/chatter'],
    panel,
    qos: {
      actionQosLink,
      linkedActionExecutionQosControls: [{ key: 'goal' }],
      linkedActionReceiveQosControls: [{ key: 'feedback' }],
      serviceQosLink,
      topicQosLink,
    },
    receive,
    selectedReceiveActionKey: 'receive-action-key',
    selectedReceiveServiceKey: 'receive-service-key',
    service,
    topic,
  }
}

test('maps controller state to the existing execution and receive View contracts', () => {
  const state = fixture()
  const views = interfaceExecutionViews(state)

  assert.equal(views.actionExecution.actions, state.action.actions)
  assert.equal(views.actionExecution.onExecute, state.action.execute)
  assert.equal(views.actionExecution.qosControls, state.qos.linkedActionExecutionQosControls)
  assert.equal(views.serviceExecution.services, state.service.services)
  assert.equal(views.serviceExecution.requestValues, state.service.requestValues)
  assert.equal(views.topicExecution.messages, state.topic.messages)
  assert.equal(views.topicExecution.publishName, '/chatter')
  assert.equal(views.receive.mode, 'action')
  assert.equal(views.receive.action.qosControls, state.qos.linkedActionReceiveQosControls)
  assert.equal(views.receive.topic.selectedTopic, '/chatter')
})

test('shows the expand affordance only for the execution panel matching the receive mode', () => {
  const actionViews = interfaceExecutionViews(fixture('action'))
  assert.equal(actionViews.actionExecution.showExpand, true)
  assert.equal(actionViews.serviceExecution.showExpand, false)
  assert.equal(actionViews.topicExecution.showExpand, false)

  const topicViews = interfaceExecutionViews(fixture('topic'))
  assert.equal(topicViews.actionExecution.showExpand, false)
  assert.equal(topicViews.serviceExecution.showExpand, false)
  assert.equal(topicViews.topicExecution.showExpand, true)
})
