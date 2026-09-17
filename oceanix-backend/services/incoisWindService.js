import { aggregateEvidence } from '../../shared/orcaEvidenceAggregator.js'
import { createEvidenceRecord } from '../../shared/orcaEvidence.js'
import { evaluateOrcaDecision } from '../../shared/orcaDecisionEngine.js'

export const INCOIS_OSF_PAGE_ENDPOINT =
  'https://www.incois.gov.in/oceanservices/osfforecast.jsp'

export const INCOIS_OSF_WMS_BASE =
  'https://www.incois.gov.in/thredds/wms/osf/ww3/'

const INCOIS_WIND_SOURCE = 'INCOIS Ocean State Forecast WW3'

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function unavailableResult({
  retrievedAt,
  reason,
  source = null,
  endpoint = null,
  location = null,
  error = null,
  coordinateRole = 'browser_gps',
  coordinatePolicy = 'direct_coordinate_request_no_snapping',
} = {}) {
  const requestContext = { coordinateRole, coordinatePolicy }
  const evidence = createEvidenceRecord({
    provider: 'INCOIS',
    source: source ?? INCOIS_WIND_SOURCE,
    endpoint,
    parameter: 'windSpeed',
    value: null,
    unit: 'm/s',
    location,
    retrievedAt,
    status: 'unavailable',
    isLive: false,
    validation: 'missing',
    quality: {
      sourceDataStatus: 'unavailable',
      ...(error ? { sourceError: error } : {}),
    },
  })
  const aggregated = aggregateEvidence([evidence])

  return {
    status: 'unavailable',
    isLive: false,
    source: {
      provider: 'INCOIS',
      name: source ?? INCOIS_WIND_SOURCE,
      endpoint,
    },
    retrievedAt,
    location,
    data: null,
    evidence: aggregated.evidence,
    aggregation: aggregated.aggregation,
    decision: evaluateOrcaDecision({ evidence: aggregated.evidence }),
    provenance: {
      provider: 'INCOIS',
      endpoint,
      retrievedAt,
      sourceDataStatus: 'unavailable',
      reason,
    },
    reason,
    requestContext,
  }
}

function validateCoordinates(latitude, longitude) {
  if (
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    const error = new Error('Valid latitude and longitude are required')
    error.code = 'INVALID_COORDINATES'
    error.status = 400
    throw error
  }
}

function parseOsfPage(html) {
  const datasetMatch = html.match(
    /var\s+rsmc_combined_ww3\s*=\s*"([^"]+)"/
  )
  const issueDateMatch = html.match(
    /var\s+forecast_issue_date\s*=\s*"([^"]+)"/
  )
  if (!datasetMatch) return null

  return {
    dataset: datasetMatch[1],
    forecastIssueDate: issueDateMatch?.[1] ?? null,
  }
}

function buildWindTimeseriesUrl({
  dataset,
  latitude,
  longitude,
  time,
  timeStart,
  timeEnd,
}) {
  const url = new URL(`${INCOIS_OSF_WMS_BASE}${dataset}`)
  url.searchParams.set('REQUEST', 'GetTimeseries')
  url.searchParams.set('LAYERS', 'UWND:VWND-mag')
  url.searchParams.set('QUERY_LAYERS', 'UWND:VWND-mag')
  url.searchParams.set(
    'BBOX',
    `${longitude},${latitude},${longitude},${latitude}`
  )
  url.searchParams.set('SRS', 'CRS:84')
  url.searchParams.set('FEATURE_COUNT', '5')
  url.searchParams.set('HEIGHT', '1')
  url.searchParams.set('WIDTH', '1')
  url.searchParams.set('X', '0')
  url.searchParams.set('Y', '0')
  url.searchParams.set('ELEVATION', '0')
  url.searchParams.set('VERSION', '1.1.1')
  url.searchParams.set('INFO_FORMAT', 'text/csv')

  if (time) {
    url.searchParams.set('TIME', time)
  } else if (timeStart || timeEnd) {
    url.searchParams.set('TIME', `${timeStart ?? ''}/${timeEnd ?? ''}`)
  }

  return url.toString()
}

function parseWindCsv(csv) {
  const lines = String(csv)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const latitudeMatch = lines.join('\n').match(/#\s*Latitude:\s*([-+]?\d+(?:\.\d+)?)/i)
  const longitudeMatch = lines.join('\n').match(/#\s*Longitude:\s*([-+]?\d+(?:\.\d+)?)/i)
  const headerIndex = lines.findIndex((line) => {
    const normalized = line.toLowerCase()
    return normalized.includes('wind') &&
      (normalized.includes('speed') || normalized.includes('magnitude'))
  })
  if (headerIndex === -1) return null

  const header = lines[headerIndex].split(',')
  const valueIndex = header.findIndex((column) => {
    const normalized = column.toLowerCase()
    return normalized.includes('wind') &&
      (normalized.includes('speed') || normalized.includes('magnitude'))
  })
  if (valueIndex === -1) return null
  const unitMatch = header[valueIndex].match(/\(([^)]+)\)/)

  for (const line of lines.slice(headerIndex + 1)) {
    if (line.startsWith('#')) continue
    const columns = line.split(',')
    const forecastTime = columns[0]?.trim()
    const value = Number(columns[valueIndex]?.trim())
    if (forecastTime && isFiniteNumber(value)) {
      return {
        windSpeed: value,
        forecastTime,
        latitude: latitudeMatch ? Number(latitudeMatch[1]) : null,
        longitude: longitudeMatch ? Number(longitudeMatch[1]) : null,
        unit: unitMatch?.[1] ?? 'm/s',
      }
    }
  }

  return null
}

async function fetchText(fetchImpl, url) {
  const response = await fetchImpl(url)
  if (!response?.ok) {
    return {
      ok: false,
      status: response?.status ?? null,
    }
  }

  return {
    ok: true,
    text: await response.text(),
  }
}

export async function fetchIncoisWind({
  latitude,
  longitude,
  time,
  timeStart,
  timeEnd,
  fetchImpl = globalThis.fetch,
  retrievedAt = new Date().toISOString(),
  coordinateRole = 'browser_gps',
  coordinatePolicy = 'direct_coordinate_request_no_snapping',
} = {}) {
  validateCoordinates(latitude, longitude)
  const location = [latitude, longitude]
  const requestContext = { coordinateRole, coordinatePolicy }

  if (typeof fetchImpl !== 'function') {
    return unavailableResult({
      retrievedAt,
      reason: 'source_unavailable',
      endpoint: INCOIS_OSF_PAGE_ENDPOINT,
      location,
      coordinateRole,
      coordinatePolicy,
    })
  }

  try {
    const page = await fetchText(fetchImpl, INCOIS_OSF_PAGE_ENDPOINT)
    if (!page.ok) {
      return unavailableResult({
        retrievedAt,
        reason: 'source_unavailable',
        endpoint: INCOIS_OSF_PAGE_ENDPOINT,
        location,
        coordinateRole,
        coordinatePolicy,
        error: { status: page.status },
      })
    }

    const metadata = parseOsfPage(page.text)
    if (!metadata) {
      return unavailableResult({
        retrievedAt,
        reason: 'malformed_source_metadata',
        endpoint: INCOIS_OSF_PAGE_ENDPOINT,
        location,
        coordinateRole,
        coordinatePolicy,
      })
    }

    const endpoint = buildWindTimeseriesUrl({
      dataset: metadata.dataset,
      latitude,
      longitude,
      time,
      timeStart,
      timeEnd,
    })
    const dataResponse = await fetchText(fetchImpl, endpoint)
    if (!dataResponse.ok) {
      return unavailableResult({
        retrievedAt,
        reason: 'source_unavailable',
        source: INCOIS_WIND_SOURCE,
        endpoint,
        location,
        coordinateRole,
        coordinatePolicy,
        error: { status: dataResponse.status },
      })
    }

    const parsed = parseWindCsv(dataResponse.text)
    if (!parsed) {
      return unavailableResult({
        retrievedAt,
        reason: 'wind_value_unavailable',
        source: INCOIS_WIND_SOURCE,
        endpoint,
        location,
        coordinateRole,
        coordinatePolicy,
      })
    }

    const sourceLocation = [
      parsed.latitude ?? latitude,
      parsed.longitude ?? longitude,
    ]
    const evidence = createEvidenceRecord({
      provider: 'INCOIS',
      source: INCOIS_WIND_SOURCE,
      endpoint,
      parameter: 'windSpeed',
      value: parsed.windSpeed,
      unit: parsed.unit,
      location: sourceLocation,
      forecastTime: parsed.forecastTime,
      retrievedAt,
      status: 'available',
      isLive: false,
      validation: 'valid',
      quality: {
        coordinateRole,
        coordinatePolicy,
        sourceDataStatus: 'forecast',
        sourcePage: INCOIS_OSF_PAGE_ENDPOINT,
        forecastIssueDate: metadata.forecastIssueDate,
        dataset: metadata.dataset,
      },
    })
    const aggregated = aggregateEvidence([evidence])

    return {
      status: 'available',
      isLive: false,
      source: {
        provider: 'INCOIS',
        name: INCOIS_WIND_SOURCE,
        endpoint,
      },
      retrievedAt,
      location: sourceLocation,
      data: {
        windSpeed: parsed.windSpeed,
        unit: parsed.unit,
        forecastTime: parsed.forecastTime,
        forecastIssueDate: metadata.forecastIssueDate,
        dataset: metadata.dataset,
      },
      evidence: aggregated.evidence,
      aggregation: aggregated.aggregation,
      decision: evaluateOrcaDecision({ evidence: aggregated.evidence }),
      provenance: {
        provider: 'INCOIS',
        sourcePage: INCOIS_OSF_PAGE_ENDPOINT,
        endpoint,
        retrievedAt,
        sourceDataStatus: 'forecast',
        forecastIssueDate: metadata.forecastIssueDate,
        dataset: metadata.dataset,
        coordinateRole,
        coordinatePolicy,
      },
      requestContext,
    }
  } catch (error) {
    return unavailableResult({
      retrievedAt,
      reason: 'source_unavailable',
      endpoint: INCOIS_OSF_PAGE_ENDPOINT,
      location,
      error: {
        code: error.code ?? 'INCOIS_WIND_REQUEST_FAILED',
        message: error.message,
      },
    })
  }
}

export { buildWindTimeseriesUrl, parseOsfPage, parseWindCsv }
