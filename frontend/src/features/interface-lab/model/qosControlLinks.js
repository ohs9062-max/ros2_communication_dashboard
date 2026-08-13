export function qosProfilesByKey(controls = []) {
  return Object.fromEntries(controls.map((control) => [control.key, control.profile]))
}

export function firstQosMode(controls = []) {
  return controls[0]?.mode ?? 'auto'
}

export function changeFirstQosMode(controls = [], mode) {
  controls[0]?.onModeChange?.(mode)
}

export function changeQosProfile(controls = [], key, profile) {
  controls.find((control) => control.key === key)?.onProfileChange?.(profile)
}

export function linkedQosControls(controls = [], qosLink, direction) {
  const modeHandler = direction === 'receive'
    ? qosLink.changeReceiveMode
    : qosLink.changeExecutionMode
  const profileHandler = direction === 'receive'
    ? qosLink.changeReceiveProfile
    : qosLink.changeExecutionProfile

  return controls.map((control) => ({
    ...control,
    onModeChange: modeHandler,
    onProfileChange: (profile) => profileHandler(control.key, profile),
  }))
}
