import { useRef } from 'react'

export function useStableGraph(nextGraph) {
  const previous = useRef({ graph: nextGraph, signature: '' })
  const signature = graphSignature(nextGraph)
  if (previous.current.signature === signature) return previous.current.graph
  previous.current = { graph: nextGraph, signature }
  return nextGraph
}

function graphSignature(graph) {
  const nodeSignature = graph.nodes.map((node) => [
    node.id,
    node.data.kind,
    node.data.label,
    node.data.status,
    node.data.type,
    node.position.x,
    node.position.y,
  ].join('|')).join('::')
  const edgeSignature = graph.edges.map((edge) => [
    edge.id,
    edge.source,
    edge.target,
    edge.label,
  ].join('|')).join('::')
  return `${nodeSignature}###${edgeSignature}`
}
