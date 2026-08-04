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
