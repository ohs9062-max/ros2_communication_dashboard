export function receiveWorkspaceViewProps(state) {
  return {
    action: resourceProps(state, 'Action'),
    expanded: state.expanded,
    mode: state.receiveMode,
    onModeChange: state.selectReceiveMode,
    onClose: state.onClose,
    onToggleExpanded: state.onToggleExpanded,
    open: state.open,
    service: resourceProps(state, 'Service'),
    topic: {
      allMessages: state.callableMessages,
      allTopics: state.availableTopics,
      domainIds: state.domainIds,
      filteredTopics: state.filteredReceiveTopics,
      importableOnly: state.topicImportableOnly,
      onDomainChange: state.onReceiveTopicDomainChange ?? state.selectTopicDomain,
      onImportableOnlyChange: state.setTopicImportableOnly,
      onMessageSelect: state.setSelectedMessageKey,
      onRefresh: state.loadReceiveState,
      onQosModeChange: state.setTopicQosMode,
      onQosProfileChange: state.setTopicQosProfile,
      modeLinked: state.topicQosModeLinked,
      onModeLinkChange: state.setTopicQosModeLinked,
      onResetAll: state.resetAllTopicReceiveHistory,
      onResetSelected: state.resetSelectedTopicReceiveHistory,
      onSearchChange: state.setReceiveTopicSearch,
      onStart: state.startSelectedTopicReceive,
      onStop: state.stopSelectedTopicReceive,
      onTopicNameChange: state.setSelectedReceiveTopic,
      receiveHistory: state.visibleReceiveTopicHistory,
      receiving: state.selectedTopicReceiving,
      receivingTopics: state.receiveTopics,
      qosMode: state.topicQosMode,
      qosProfile: state.topicQosProfile,
      search: state.receiveTopicSearch,
      selectedMessage: state.selectedMessage,
      selectedMessageKey: state.selectedMessageKey,
      selectedTopic: state.selectedReceiveTopic,
      selectedDomainId: state.selectedReceiveTopicDomainId ?? state.topicDomainId,
      visibleMessages: state.visibleCallableMessages,
    },
  }
}

function resourceProps(state, kind) {
  const isAction = kind === 'Action'
  const qosControls = isAction
    ? state.actionQosControls
    : [{
        key: 'service-response',
        label: 'Service 수신 QoS · Response',
        mode: state.serviceResponseQosMode,
        onModeChange: state.setServiceResponseQosMode,
        onProfileChange: state.setServiceResponseQosProfile,
        profile: state.serviceResponseQosProfile,
      }]
  return {
    activeKey: isAction ? state.activeReceiveActionKey : state.activeReceiveServiceKey,
    domainIds: state.domainIds,
    history: isAction ? state.visibleReceiveActionHistory : state.visibleReceiveServiceHistory,
    items: isAction ? state.callableActions : state.callableServices,
    onDomainChange: isAction ? state.onReceiveActionDomainChange : state.onReceiveServiceDomainChange,
    onRefresh: state.loadReceiveState,
    onResetAll: () => (isAction ? state.resetReceiveActions(false) : state.resetReceiveServices(false)),
    onResetSelected: () => (isAction ? state.resetReceiveActions(true) : state.resetReceiveServices(true)),
    onSearchChange: isAction ? state.setReceiveActionSearch : state.setReceiveServiceSearch,
    onSelect: isAction ? state.setSelectedActionKey : state.setSelectedServiceKey,
    onStart: isAction ? state.startSelectedActionReceive : state.startSelectedServiceReceive,
    onStop: isAction ? state.stopSelectedActionReceive : state.stopSelectedServiceReceive,
    qosControls,
    modeLinked: isAction ? state.actionQosModeLinked : state.serviceQosModeLinked,
    onModeLinkChange: isAction ? state.setActionQosModeLinked : state.setServiceQosModeLinked,
    search: isAction ? state.receiveActionSearch : state.receiveServiceSearch,
    selectedDomainId: isAction ? state.actionDomainId : state.serviceDomainId,
    selectedKey: isAction ? state.selectedReceiveActionKey : state.selectedReceiveServiceKey,
    visibleItems: isAction ? state.filteredReceiveActions : state.filteredReceiveServices,
  }
}
