export async function runSingleFlight(lockRef, task) {
  if (lockRef.current) return false

  lockRef.current = true
  try {
    await task()
    return true
  } finally {
    lockRef.current = false
  }
}

export async function runSharedFlight(promiseRef, task) {
  if (promiseRef.current) return promiseRef.current

  const promise = Promise.resolve().then(task)
  promiseRef.current = promise
  try {
    return await promise
  } finally {
    if (promiseRef.current === promise) promiseRef.current = null
  }
}
