const VALID_STATUSES = new Set([
  'available',
  'simulated',
  'unavailable',
  'stale',
  'invalid',
])

const NUMERIC_PARAMETERS = new Set([
  'waveHeight',
  'windSpeed',
  'visibility',
  'lightningRiskPercent',
])

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function stablePart(value) {
  return String(value ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'unknown'
}

export function buildEvidenceId({
  provider,
  source,
  endpoint,
  parameter,
  observationTime,
  forecastTime,
} = {}) {
  return [
    'evidence',
    provider,
    source,
    endpoint,
    parameter,
    observationTime,
    forecastTime,
  ].map(stablePart).join(':')
}

export function validateEvidenceValue(parameter, value) {
  if (NUMERIC_PARAMETERS.has(parameter)) {
    return typeof value === 'number' && Number.isFinite(value)
      ? { valid: true }
      : { valid: false, reason: 'Numeric evidence must be a finite number' }
  }

  if (parameter === 'cyclone') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, reason: 'Cyclone evidence must be an object' }
    }
    if (typeof value.active !== 'boolean') {
      return { valid: false, reason: 'Cyclone active must be boolean' }
    }
    if (value.active && (typeof value.category !== 'string' || !value.category.trim())) {
      return { valid: false, reason: 'Active cyclone category must be a non-empty string' }
    }
    return { valid: true }
  }

  return { valid: value !== null && value !== undefined }
    ? { valid: true }
    : { valid: false, reason: 'Evidence value is missing' }
}

function normalizedLocation(location) {
  if (!Array.isArray(location) || location.length < 2) return null
  const latitude = finiteNumber(location[0])
  const longitude = finiteNumber(location[1])
  if (latitude === null || longitude === null) return null
  return { latitude, longitude }
}

export function createEvidenceRecord({
  provider = 'unknown',
  source = null,
  endpoint = null,
  parameter,
  value = null,
  unit = null,
  location = null,
  observationTime = null,
  forecastTime = null,
  retrievedAt = new Date().toISOString(),
  status = 'available',
  isLive = false,
  validation = 'valid',
  quality = {},
} = {}) {
  if (!parameter) {
    throw new TypeError('Evidence parameter is required')
  }

  const normalizedStatus = VALID_STATUSES.has(status) ? status : 'invalid'
  const valueValidation = validateEvidenceValue(parameter, value)
  const hasValue = valueValidation.valid
  const normalizedValidation = hasValue
    ? validation
    : validation === 'missing' || value === null || value === undefined
      ? 'missing'
      : 'invalid'
  const evidenceId = buildEvidenceId({
    provider,
    source,
    endpoint,
    parameter,
    observationTime,
    forecastTime,
  })

  return {
    evidenceId,
    provider,
    source,
    endpoint,
    parameter,
    value: hasValue ? value : null,
    unit,
    location: normalizedLocation(location),
    observationTime,
    forecastTime,
    retrievedAt,
    status: hasValue && normalizedStatus === 'available'
      ? normalizedStatus
      : hasValue && normalizedStatus === 'simulated'
        ? normalizedStatus
        : hasValue
          ? normalizedStatus
          : 'unavailable',
    isLive: Boolean(isLive) && normalizedStatus === 'available' && hasValue,
    validation: normalizedValidation,
    quality: {
      completeness: hasValue ? 1 : 0,
      ...quality,
    },
  }
}

function scenarioSource(scenario) {
  return {
    provider: scenario?.meta?.source ?? scenario?.source?.provider ?? 'simulated-scenario',
    source: scenario?.meta?.source ?? scenario?.source?.provider ?? 'mockOcean.js',
    endpoint: scenario?.meta?.scenario ?? scenario?.id ?? null,
    isLive: scenario?.meta?.isLive === true || scenario?.source?.isLive === true,
  }
}

function scenarioValue(scenario, path) {
  return path.reduce((current, key) => current?.[key], scenario)
}

export function buildScenarioEvidence(scenario, { retrievedAt = new Date().toISOString() } = {}) {
  const source = scenarioSource(scenario)
  const location = scenario?.harbour?.coordinates ?? scenario?.coordinates
  const definitions = [
    ['waveHeight', ['oceanConditions', 'waveHeight'], 'm'],
    ['windSpeed', ['oceanConditions', 'windSpeed'], 'knots'],
    ['visibility', ['oceanConditions', 'visibility'], 'NM'],
    ['lightningRiskPercent', ['oceanConditions', 'lightningRiskPercent'], '%'],
  ]

  const evidence = definitions.map(([parameter, path, unit]) => {
    const value = finiteNumber(scenarioValue(scenario, path))
    const available = value !== null
    return createEvidenceRecord({
      ...source,
      parameter,
      value,
      unit,
      location,
      retrievedAt,
      status: available ? (source.isLive ? 'available' : 'simulated') : 'unavailable',
      isLive: source.isLive,
      validation: available ? 'valid' : 'missing',
      quality: { completeness: available ? 1 : 0 },
    })
  })

  const cyclone = scenario?.cyclone
  const cycloneAvailable = Boolean(cyclone) &&
    typeof cyclone.active === 'boolean' &&
    typeof cyclone.category === 'string'

  evidence.push(createEvidenceRecord({
    ...source,
    parameter: 'cyclone',
    value: cycloneAvailable
      ? { active: cyclone.active, category: cyclone.category }
      : null,
    location,
    retrievedAt,
    status: cycloneAvailable ? (source.isLive ? 'available' : 'simulated') : 'unavailable',
    isLive: source.isLive,
    validation: cycloneAvailable ? 'valid' : 'missing',
    quality: { completeness: cycloneAvailable ? 1 : 0 },
  }))

  return evidence
}
