import { aggregateEvidence } from '../../shared/orcaEvidenceAggregator.js'
import { createEvidenceRecord } from '../../shared/orcaEvidence.js'
import { evaluateOrcaDecision } from '../../shared/orcaDecisionEngine.js'

export const INCOIS_OSF_PAGE_ENDPOINT =
  'https://www.incois.gov.in/oceanservices/osfforecast.jsp'

export const INCOIS_OSF_WMS_BASE =
  'https://www.incois.gov.in/thredds/wms/osf/ww3/'

const INCOIS_WAVE_SOURCE = 'INCOIS Ocean State Forecast'

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
    source: source ?? INCOIS_WAVE_SOURCE,
    endpoint,
    parameter: 'waveHeight',
    value: null,
    unit: 'm',
    location,
    retrievedAt,
    status: 'unavailable',
    isLive: false,
    validation: 'missing',
    quality: {
      coordinateRole,
      coordinatePolicy,
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
      name: source ?? INCOIS_WAVE_SOURCE,
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

function buildWaveTimeseriesUrl({
  dataset,
  latitude,
  longitude,
  time,
  timeStart,
  timeEnd,
}) {
  const url = new URL(`${INCOIS_OSF_WMS_BASE}${dataset}`)
  url.searchParams.set('REQUEST', 'GetTimeseries')
  url.searchParams.set('LAYERS', 'HS')
  url.searchParams.set('QUERY_LAYERS', 'HS')
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

function parseWaveCsv(csv) {
  const lines = String(csv)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const headerIndex = lines.findIndex((line) =>
    line.toLowerCase().includes('wave height')
  )

  if (headerIndex === -1) return null

  const header = lines[headerIndex].split(',')
  const valueIndex = header.findIndex((column) =>
    column.toLowerCase().includes('wave height')
  )
  if (valueIndex === -1) return null

  for (const line of lines.slice(headerIndex + 1)) {
    if (line.startsWith('#')) continue
    const columns = line.split(',')
    const forecastTime = columns[0]?.trim()
    const value = Number(columns[valueIndex]?.trim())
    if (forecastTime && isFiniteNumber(value)) {
      return {
        waveHeight: value,
        forecastTime,
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

export async function fetchIncoisWave({
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

    const endpoint = buildWaveTimeseriesUrl({
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
        source: INCOIS_WAVE_SOURCE,
        endpoint,
        location,
        coordinateRole,
        coordinatePolicy,
        error: { status: dataResponse.status },
      })
    }

    const parsed = parseWaveCsv(dataResponse.text)
    if (!parsed) {
      return unavailableResult({
        retrievedAt,
        reason: 'wave_value_unavailable',
        source: INCOIS_WAVE_SOURCE,
        endpoint,
        location,
        coordinateRole,
        coordinatePolicy,
      })
    }

    const result = {
      status: 'available',
      isLive: false,
      source: {
        provider: 'INCOIS',
        name: INCOIS_WAVE_SOURCE,
        endpoint,
      },
      retrievedAt,
      location,
      data: {
        waveHeight: parsed.waveHeight,
        unit: 'm',
        forecastTime: parsed.forecastTime,
        forecastIssueDate: metadata.forecastIssueDate,
        dataset: metadata.dataset,
      },
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
    }

    const evidence = createEvidenceRecord({
      provider: 'INCOIS',
      source: INCOIS_WAVE_SOURCE,
      endpoint,
      parameter: 'waveHeight',
      value: parsed.waveHeight,
      unit: 'm',
      location,
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
      ...result,
      evidence: aggregated.evidence,
      aggregation: aggregated.aggregation,
      decision: evaluateOrcaDecision({ evidence: aggregated.evidence }),
      requestContext,
    }
  } catch (error) {
    return unavailableResult({
      retrievedAt,
      reason: 'source_unavailable',
      endpoint: INCOIS_OSF_PAGE_ENDPOINT,
      location,
      coordinateRole,
      coordinatePolicy,
      error: {
        code: error.code ?? 'INCOIS_WAVE_REQUEST_FAILED',
        message: error.message,
      },
    })
  }
}

export { buildWaveTimeseriesUrl, parseOsfPage, parseWaveCsv }
