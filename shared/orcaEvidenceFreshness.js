export const EVIDENCE_FRESHNESS_STATES = Object.freeze({
  CURRENT: 'CURRENT',
  HISTORICAL: 'HISTORICAL',
  FORECAST: 'FORECAST',
  STALE: 'STALE',
  UNKNOWN: 'UNKNOWN',
})

const HISTORICAL_STATUSES = new Set(['historical', 'historical_external'])
const FORECAST_STATUSES = new Set(['forecast'])

function resolveCurrentTime(now) {
  const value = typeof now === 'function' ? now() : now
  const time = value instanceof Date ? value : new Date(value)
  return Number.isNaN(time.getTime()) ? null : time
}

function parseTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return { present: false, valid: false, milliseconds: null }
  }

  const time = new Date(value)
  return {
    present: true,
    valid: !Number.isNaN(time.getTime()),
    milliseconds: Number.isNaN(time.getTime()) ? null : time.getTime(),
  }
}

function sourceDataStatus(evidence) {
  return evidence?.quality?.sourceDataStatus ??
    evidence?.sourceDataStatus ??
    null
}

function baseResult(evidence, currentTime, overrides = {}) {
  return {
    state: EVIDENCE_FRESHNESS_STATES.UNKNOWN,
    ageMs: null,
    isFuture: false,
    timestamp: null,
    timestampField: null,
    timestampSource: null,
    sourceDataStatus: sourceDataStatus(evidence),
    now: currentTime?.toISOString() ?? null,
    timestamps: {
      observationTime: evidence?.observationTime ?? null,
      forecastTime: evidence?.forecastTime ?? null,
      retrievedAt: evidence?.retrievedAt ?? null,
    },
    ...overrides,
  }
}

export function classifyEvidenceFreshness(evidence, { now = new Date() } = {}) {
  const currentTime = resolveCurrentTime(now)
  if (!currentTime) return baseResult(evidence, null)

  const forecast = parseTimestamp(evidence?.forecastTime)
  const observation = parseTimestamp(evidence?.observationTime)
  const retrieved = parseTimestamp(evidence?.retrievedAt)
  const sourceStatus = sourceDataStatus(evidence)

  if (
    (forecast.present && !forecast.valid) ||
    (observation.present && !observation.valid)
  ) {
    return baseResult(evidence, currentTime, {
      invalidTimestamp: forecast.present && !forecast.valid
        ? 'forecastTime'
        : 'observationTime',
    })
  }

  let selected = null
  let timestampField = null
  let timestampSource = null

  if (forecast.valid) {
    selected = forecast.milliseconds
    timestampField = 'forecastTime'
    timestampSource = 'forecastTime'
  } else if (observation.valid) {
    selected = observation.milliseconds
    timestampField = 'observationTime'
    timestampSource = 'observationTime'
  } else if (!forecast.present && !observation.present && retrieved.valid) {
    selected = retrieved.milliseconds
    timestampField = 'retrievedAt'
    timestampSource = 'retrievedAt'
  }

  if (selected === null) {
    return baseResult(evidence, currentTime)
  }

  const ageMs = currentTime.getTime() - selected
  const isFuture = ageMs < 0
  let state = EVIDENCE_FRESHNESS_STATES.CURRENT

  if (evidence?.status === 'stale') {
    state = EVIDENCE_FRESHNESS_STATES.STALE
  } else if (
    timestampField === 'forecastTime' ||
    isFuture ||
    FORECAST_STATUSES.has(sourceStatus)
  ) {
    state = EVIDENCE_FRESHNESS_STATES.FORECAST
  } else if (HISTORICAL_STATUSES.has(sourceStatus)) {
    state = EVIDENCE_FRESHNESS_STATES.HISTORICAL
  }

  return baseResult(evidence, currentTime, {
    state,
    ageMs,
    isFuture,
    timestamp: new Date(selected).toISOString(),
    timestampField,
    timestampSource,
  })
}

export function calculateEvidenceFreshness(evidence, options = {}) {
  return classifyEvidenceFreshness(evidence, options)
}
