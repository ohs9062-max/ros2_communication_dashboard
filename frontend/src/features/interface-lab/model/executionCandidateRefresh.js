export async function refreshExecutionCandidates(loaders = []) {
  await Promise.all(loaders.map((load) => load()))
}

export function removeWithExecutionRefresh(remove, target, refresh) {
  return remove(target, refresh)
}
