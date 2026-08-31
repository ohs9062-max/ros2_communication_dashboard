export function runningServerIdentity(server) {
  return JSON.stringify([
    server.kind,
    server.domainId,
    server.name,
    server.interfaceType,
  ])
}

export function mergeRunningServers(serviceServers = [], actionServers = []) {
  return [
    ...serviceServers.map((server) => ({
      domainId: server.domain_id,
      interfaceType: server.service_type,
      kind: 'service',
      kindLabel: 'Service',
      name: server.service_name,
    })),
    ...actionServers.map((server) => ({
      domainId: server.domain_id,
      interfaceType: server.action_type,
      kind: 'action',
      kindLabel: 'Action',
      name: server.action_name,
    })),
  ]
    .filter((server) => (
      Number.isInteger(server.domainId)
      && Boolean(server.name)
      && Boolean(server.interfaceType)
    ))
    .map((server) => ({ ...server, identityKey: runningServerIdentity(server) }))
    .sort((left, right) => (
      left.domainId - right.domainId
      || left.kind.localeCompare(right.kind)
      || left.name.localeCompare(right.name)
      || left.interfaceType.localeCompare(right.interfaceType)
    ))
}

export function runningServerStopPayload(server) {
  if (server.kind === 'service') {
    return {
      domain_id: server.domainId,
      service_name: server.name,
      service_type: server.interfaceType,
    }
  }
  return {
    action_name: server.name,
    action_type: server.interfaceType,
    domain_id: server.domainId,
  }
}

export async function stopRunningServer(server, { stopAction, stopService }) {
  const payload = runningServerStopPayload(server)
  return server.kind === 'service' ? stopService(payload) : stopAction(payload)
}
