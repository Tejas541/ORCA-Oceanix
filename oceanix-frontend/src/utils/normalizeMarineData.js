/**
 * ORCA marine-data normalizer.
 *
 * Converts a raw scenario (currently mockOcean.js) into a predictable
 * ORCA marine-data object. Pure, deterministic, no I/O, no UI logic.
 *
 * Field set is limited to values already present in the demo scenarios.
 * Conceptual groupings (`ocean`, `weather`, `geospatial`) are views of
 * those same fields so a future API source can map into this shape
 * without changing pages.
 */

export const ORCA_MARINE_SCHEMA_VERSION = 1

function toStringValue(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function toFiniteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toBoolean(value, fallback = false) {
  if (value === true || value === false) return value
  return fallback
}

function toLatLng(value) {
  if (!Array.isArray(value) || value.length < 2) return null
  const lat = toFiniteNumber(value[0])
  const lng = toFiniteNumber(value[1])
  if (lat === null || lng === null) return null
  return [lat, lng]
}

function toLatLngList(value) {
  if (!Array.isArray(value)) return []
  return value.map(toLatLng).filter(Boolean)
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeMeta(raw, scenarioId) {
  const meta = asObject(raw)
  return {
    source: toStringValue(meta.source, 'simulated-edil-demo'),
    isLive: toBoolean(meta.isLive, false),
    generatedFor: toStringValue(meta.generatedFor),
    bulletinId: toStringValue(meta.bulletinId),
    bulletinDate: toStringValue(meta.bulletinDate),
    disclaimer: toStringValue(meta.disclaimer),
    scenario: toStringValue(meta.scenario, scenarioId),
  }
}

function normalizeHarbour(raw) {
  const harbour = asObject(raw)
  return {
    name: toStringValue(harbour.name),
    coordinates: toLatLng(harbour.coordinates),
  }
}

function normalizeOceanConditions(raw) {
  const oceanConditions = asObject(raw)
  return {
    waveHeight: toFiniteNumber(oceanConditions.waveHeight),
    windSpeed: toFiniteNumber(oceanConditions.windSpeed),
    windDirection: toStringValue(oceanConditions.windDirection),
    seaState: toStringValue(oceanConditions.seaState),
    visibility: toFiniteNumber(oceanConditions.visibility),
    lightningRiskPercent: toFiniteNumber(oceanConditions.lightningRiskPercent),
  }
}

function normalizeOceanParameters(raw) {
  const oceanParameters = asObject(raw)
  return {
    sst: toFiniteNumber(oceanParameters.sst),
    chlorophyll: toFiniteNumber(oceanParameters.chlorophyll),
    sstGradient: toFiniteNumber(oceanParameters.sstGradient),
    currentSpeed: toFiniteNumber(oceanParameters.currentSpeed),
    currentDirection: toStringValue(oceanParameters.currentDirection),
    cloudCoverPercent: toFiniteNumber(oceanParameters.cloudCoverPercent),
  }
}

function normalizeRiskFactors(value) {
  if (!Array.isArray(value)) return []
  return value.map((factor, index) => {
    const item = asObject(factor)
    return {
      id: toStringValue(item.id, `factor-${index}`),
      label: toStringValue(item.label),
      severity: toStringValue(item.severity),
      note: toStringValue(item.note),
    }
  })
}

function normalizeRisk(raw) {
  const risk = asObject(raw)
  return {
    safetyScore: toFiniteNumber(risk.safetyScore),
    riskLevel: toStringValue(risk.riskLevel),
    ventureStatusLabel: toStringValue(risk.ventureStatusLabel),
    officialDirective: toStringValue(risk.officialDirective),
    riskFactors: normalizeRiskFactors(risk.riskFactors),
  }
}

function normalizePfzZone(raw, { isPrimary = false } = {}) {
  const zone = asObject(raw)
  const normalized = {
    name: toStringValue(zone.name),
    targetSpecies: toStringValue(zone.targetSpecies),
    coordinates: toLatLng(zone.coordinates),
    radius: toFiniteNumber(zone.radius),
    depthMeters: toFiniteNumber(zone.depthMeters),
    confidence: toFiniteNumber(zone.confidence),
    reason: toStringValue(zone.reason),
  }

  if (isPrimary) {
    normalized.bearingFromHarbourDeg = toFiniteNumber(zone.bearingFromHarbourDeg)
    normalized.distanceFromHarbourKm = toFiniteNumber(zone.distanceFromHarbourKm)
    normalized.additionalZones = Array.isArray(zone.additionalZones)
      ? zone.additionalZones.map((item) => normalizePfzZone(item))
      : []
  }

  return normalized
}

function normalizeImbl(raw) {
  const imbl = asObject(raw)
  return {
    name: toStringValue(imbl.name),
    bufferNm: toFiniteNumber(imbl.bufferNm),
    distanceFromHarbourNm: toFiniteNumber(imbl.distanceFromHarbourNm),
    coordinates: toLatLngList(imbl.coordinates),
    restrictedAccess: toBoolean(imbl.restrictedAccess, false),
    alertMessage: toStringValue(imbl.alertMessage),
  }
}

function normalizeMpa(raw) {
  const mpa = asObject(raw)
  return {
    name: toStringValue(mpa.name),
    description: toStringValue(mpa.description),
    coordinates: toLatLngList(mpa.coordinates),
  }
}

function normalizeCyclone(raw) {
  const cyclone = asObject(raw)
  return {
    name: toStringValue(cyclone.name),
    category: toStringValue(cyclone.category),
    basin: toStringValue(cyclone.basin),
    status: toStringValue(cyclone.status),
    active: toBoolean(cyclone.active, false),
    note: toStringValue(cyclone.note),
    track: toLatLngList(cyclone.track),
  }
}

function normalizeTrawlerRoute(raw) {
  const route = asObject(raw)
  return {
    vesselId: toStringValue(route.vesselId),
    status: toStringValue(route.status),
    start: toLatLng(route.start),
    destination: toLatLng(route.destination),
    coordinates: toLatLngList(route.coordinates),
  }
}

function normalizeAdvisory(raw) {
  const advisory = asObject(raw)
  return {
    languageDefault: toStringValue(advisory.languageDefault, 'English'),
    summaryEn: toStringValue(advisory.summaryEn),
    queryHints: Array.isArray(advisory.queryHints)
      ? advisory.queryHints.map((hint) => toStringValue(hint)).filter(Boolean)
      : [],
  }
}

function normalizeSatelliteHealth(raw) {
  const health = asObject(raw)
  const out = {}
  for (const [key, value] of Object.entries(health)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    out[key] = {
      title: toStringValue(value.title),
      latency: toStringValue(value.latency),
      health: toStringValue(value.health),
    }
  }
  return out
}

/**
 * @param {object} [rawScenario]
 * @returns {object} Normalized ORCA marine-data object
 */
export function normalizeMarineData(rawScenario) {
  const raw = asObject(rawScenario)
  const harbour = normalizeHarbour(raw.harbour)
  const id = toStringValue(raw.id)
  const label = toStringValue(raw.label, harbour.name || id)
  const region = toStringValue(raw.region)
  const oceanConditions = normalizeOceanConditions(raw.oceanConditions)
  const oceanParameters = normalizeOceanParameters(raw.oceanParameters)
  const cyclone = normalizeCyclone(raw.cyclone)
  const pfz = normalizePfzZone(raw.pfz, { isPrimary: true })
  const imbl = normalizeImbl(raw.imbl)
  const mpa = normalizeMpa(raw.mpa)
  const trawlerRoute = normalizeTrawlerRoute(raw.trawlerRoute)
  const risk = normalizeRisk(raw.risk)
  const advisory = normalizeAdvisory(raw.advisory)
  const meta = normalizeMeta(raw.meta, id)
  const satelliteHealth = normalizeSatelliteHealth(raw.satelliteHealth)

  return {
    schemaVersion: ORCA_MARINE_SCHEMA_VERSION,

    id,
    name: label,
    label,
    location: region,
    region,
    coordinates: harbour.coordinates,
    harbour,
    meta,
    source: {
      type: meta.isLive ? 'live' : 'simulated',
      isLive: meta.isLive,
      provider: meta.source,
    },

    oceanConditions,
    oceanParameters,
    ocean: {
      waveHeight: oceanConditions.waveHeight,
      seaState: oceanConditions.seaState,
      sst: oceanParameters.sst,
      chlorophyll: oceanParameters.chlorophyll,
      sstGradient: oceanParameters.sstGradient,
      currentSpeed: oceanParameters.currentSpeed,
      currentDirection: oceanParameters.currentDirection,
    },
    weather: {
      windSpeed: oceanConditions.windSpeed,
      windDirection: oceanConditions.windDirection,
      visibility: oceanConditions.visibility,
      lightningRiskPercent: oceanConditions.lightningRiskPercent,
      cloudCoverPercent: oceanParameters.cloudCoverPercent,
    },
    cyclone,

    pfz,
    imbl,
    mpa,
    trawlerRoute,
    vessel: trawlerRoute,
    geospatial: {
      pfz,
      imbl,
      mpa,
      vessel: trawlerRoute,
      route: trawlerRoute.coordinates,
    },

    risk,
    advisory,
    satelliteHealth,
  }
}
