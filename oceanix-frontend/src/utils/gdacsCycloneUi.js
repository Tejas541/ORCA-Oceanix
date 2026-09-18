export function getCanonicalCycloneEvidence(locationDecision) {
  return locationDecision?.evidence?.find(
    (record) => record?.parameter === 'cyclone'
  ) ?? null
}

function isValidCycloneValue(value) {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.active === 'boolean' &&
    (!value.active || (typeof value.category === 'string' && value.category.trim()))
}

export function getGdacsCycloneDisplay(evidence) {
  if (
    !evidence ||
    evidence.status !== 'available' ||
    evidence.validation === 'missing' ||
    evidence.validation === 'invalid' ||
    !isValidCycloneValue(evidence.value)
  ) {
    return {
      state: 'unavailable',
      title: 'GDACS CYCLONE STATUS',
      message: 'GDACS cyclone data unavailable',
      provider: null,
      status: null,
      eventName: null,
      category: null,
    }
  }

  const value = evidence.value
  return {
    state: value.active ? 'active' : 'inactive',
    title: 'GDACS CYCLONE STATUS',
    message: value.active ? null : 'No current relevant cyclone',
    provider: evidence.provider ?? null,
    status: evidence.quality?.sourceDataStatus === 'event_status'
      ? 'Event status'
      : null,
    eventName: value.active && typeof value.name === 'string' ? value.name : null,
    category: value.active && typeof value.category === 'string' ? value.category : null,
  }
}
