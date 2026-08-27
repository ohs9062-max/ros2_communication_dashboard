export function isInternalNode(node) {
  const name = String(node.name ?? '')
  const fullName = String(node.full_name ?? '')
  return (
    node.is_internal === true ||
    name.includes('ros2cli_daemon') ||
    fullName.includes('ros2cli_daemon')
  )
}

export function isPrimaryNode(node) {
  return node.is_primary === true
}

export function isRunningNode(node) {
  if (node?.graph_present != null) return node.graph_present === true
  return String(node?.status ?? '').toLowerCase() === 'active'
}

export function isIssueNode(node) {
  return !isRunningNode(node)
}
