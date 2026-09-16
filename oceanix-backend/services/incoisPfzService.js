import { createEvidenceRecord } from '../../shared/orcaEvidence.js'

export const INCOIS_PFZ_WFS_ENDPOINT =
  'https://incois.gov.in/geoserver/PFZ_Automation/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application/json'

const INCOIS_PFZ_SOURCE = 'INCOIS PFZ WFS'

function unavailableResult(retrievedAt, reason, error = null) {
  return {
    status: 'unavailable',
    isLive: false,
    source: {
      provider: 'INCOIS',
      name: INCOIS_PFZ_SOURCE,
      endpoint: INCOIS_PFZ_WFS_ENDPOINT,
    },
    retrievedAt,
    advisoryDate: null,
    validUntil: null,
    sector: null,
    data: null,
    evidence: [createEvidenceRecord({
      provider: 'INCOIS',
      source: INCOIS_PFZ_SOURCE,
      endpoint: INCOIS_PFZ_WFS_ENDPOINT,
      parameter: 'pfz',
      value: null,
      retrievedAt,
      status: 'unavailable',
      isLive: false,
      validation: 'missing',
      quality: {
        sourceDataStatus: 'unavailable',
        sourceError: error,
      },
    })],
    provenance: {
      provider: 'INCOIS',
      endpoint: INCOIS_PFZ_WFS_ENDPOINT,
      retrievedAt,
      format: 'application/geo+json',
      reason,
    },
    reason,
  }
}

function dateFromJulianDay(year, julianDay) {
  const numericYear = Number(year)
  const numericDay = Number(julianDay)
  if (
    !Number.isInteger(numericYear) ||
    !Number.isInteger(numericDay) ||
    numericDay < 1 ||
    numericDay > 366
  ) {
    return null
  }

  const date = new Date(Date.UTC(numericYear, 0, numericDay))
  return date.toISOString().slice(0, 10)
}

function normalizeFeatureCollection(payload) {
  if (
    !payload ||
    payload.type !== 'FeatureCollection' ||
    !Array.isArray(payload.features)
  ) {
    return null
  }

  const features = payload.features.filter((feature) =>
    feature &&
    feature.type === 'Feature' &&
    feature.geometry &&
    feature.properties &&
    typeof feature.properties === 'object'
  )

  return features.length > 0
    ? { type: 'FeatureCollection', features }
    : null
}

function metadataFor(data) {
  const dates = [...new Set(
    data.features
      .map((feature) => dateFromJulianDay(
        feature.properties.Year,
        feature.properties.Julian_day
      ))
      .filter(Boolean)
  )].sort()

  const states = [...new Set(
    data.features
      .map((feature) => feature.properties.State_Name)
      .filter((value) => typeof value === 'string' && value.trim())
  )].sort()

  const sectorBoundaries = [...new Set(
    data.features
      .map((feature) => feature.properties.SECTORBOUN ?? feature.properties.SECTORBO_1)
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map(String)
  )].sort()

  return {
    advisoryDate: dates.length === 1 ? dates[0] : null,
    advisoryDates: dates,
    sector: {
      states,
      boundaries: sectorBoundaries,
    },
  }
}

export function buildPfzEvidence(result) {
  const available = result?.status === 'available' && result.data
  return createEvidenceRecord({
    provider: result?.source?.provider ?? 'INCOIS',
    source: result?.source?.name ?? INCOIS_PFZ_SOURCE,
    endpoint: result?.source?.endpoint ?? INCOIS_PFZ_WFS_ENDPOINT,
    parameter: 'pfz',
    value: available ? result.data : null,
    observationTime: result?.advisoryDate ?? null,
    retrievedAt: result?.retrievedAt ?? null,
    status: available ? 'available' : 'unavailable',
    isLive: false,
    validation: available ? 'valid' : 'missing',
    quality: {
      sourceDataStatus: available ? 'official_pfz' : 'unavailable',
      featureCount: available ? result.data.features.length : 0,
      validUntil: result?.validUntil ?? null,
      sector: result?.sector ?? null,
    },
  })
}

export async function fetchIncoisPfz({
  fetchImpl = globalThis.fetch,
  retrievedAt = new Date().toISOString(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return unavailableResult(retrievedAt, 'source_unavailable')
  }

  try {
    const response = await fetchImpl(INCOIS_PFZ_WFS_ENDPOINT)
    if (!response?.ok) {
      return unavailableResult(retrievedAt, 'source_unavailable', {
        status: response?.status ?? null,
      })
    }

    const payload = await response.json()
    const data = normalizeFeatureCollection(payload)
    if (!data) {
      return unavailableResult(retrievedAt, 'malformed_response')
    }

    const metadata = metadataFor(data)
    const result = {
      status: 'available',
      isLive: false,
      source: {
        provider: 'INCOIS',
        name: INCOIS_PFZ_SOURCE,
        endpoint: INCOIS_PFZ_WFS_ENDPOINT,
      },
      retrievedAt,
      advisoryDate: metadata.advisoryDate,
      validUntil: null,
      sector: metadata.sector,
      data,
      provenance: {
        provider: 'INCOIS',
        endpoint: INCOIS_PFZ_WFS_ENDPOINT,
        retrievedAt,
        format: 'application/geo+json',
        featureCount: data.features.length,
        advisoryDates: metadata.advisoryDates,
        validUntil: null,
      },
    }

    return {
      ...result,
      evidence: [buildPfzEvidence(result)],
    }
  } catch (error) {
    return unavailableResult(retrievedAt, 'source_unavailable', {
      message: error.message,
    })
  }
}
