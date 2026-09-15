const INCOIS_ROOT = 'https://erddap.incois.gov.in/erddap'
const INCOIS_GRIDDAP = `${INCOIS_ROOT}/griddap`
const INCOIS_INFO = `${INCOIS_ROOT}/info`
const INCOIS_CATALOG_URL =
  `${INCOIS_ROOT}/tabledap/allDatasets.json?datasetID,title,summary,minTime,maxTime`

export const INCOIS_TIMEOUT_MS = 15000
export const INCOIS_RETRIES = 1
export const INCOIS_DEFAULT_TIME = '2023-05-21T12:00:00Z'
export const INCOIS_LEGACY_WIND_DATASET = 'ascat_daily_datasets'

const PARAMETER_DEFINITIONS = {
  sst: {
    label: 'sea surface temperature',
    matches: ['sea_surface_temperature', 'sea surface temperature'],
  },
  waveHeight: {
    label: 'significant wave height',
    matches: [
      'sea_surface_wave_significant_height',
      'significant wave height',
      'significant wave-height',
    ],
  },
  current: {
    label: 'surface current',
    eastwardMatches: [
      'eastward_sea_water_velocity',
      'eastward sea water velocity',
      'eastward current',
      'surface current',
    ],
    northwardMatches: [
      'northward_sea_water_velocity',
      'northward sea water velocity',
      'northward current',
      'surface current',
    ],
  },
}

export class IncoisRequestError extends Error {
  constructor(message, { code = 'INCOIS_REQUEST_FAILED', status = 502, cause } = {}) {
    super(message, { cause })
    this.name = 'IncoisRequestError'
    this.code = code
    this.status = status
  }
}

function assertCoordinates(latitude, longitude) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new IncoisRequestError(
      'latitude and longitude must be valid coordinates',
      { code: 'INVALID_COORDINATES', status: 400 }
    )
  }
}

function asNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase()
}

function toRows(payload) {
  const table = payload?.table
  if (!table || !Array.isArray(table.rows)) return []

  if (!Array.isArray(table.columnNames)) {
    return table.rows.filter((row) => row && typeof row === 'object')
  }

  return table.rows.map((row) => Object.fromEntries(
    table.columnNames.map((name, index) => [name, row?.[index]])
  ))
}

async function fetchJson(
  url,
  { fetchImpl = globalThis.fetch, timeoutMs = INCOIS_TIMEOUT_MS, retries = INCOIS_RETRIES } = {}
) {
  let lastError

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      const body = await response.text()

      if (!response.ok) {
        throw new IncoisRequestError(
          `INCOIS ERDDAP returned HTTP ${response.status}`,
          {
            code: 'INCOIS_HTTP_ERROR',
            status: response.status === 408 || response.status >= 500 ? 502 : response.status,
            cause: { upstreamStatus: response.status, body },
          }
        )
      }

      let payload = null
      try {
        payload = body ? JSON.parse(body) : null
      } catch (error) {
        throw new IncoisRequestError(
          'INCOIS returned malformed JSON',
          { code: 'INCOIS_MALFORMED_JSON', status: 502, cause: error }
        )
      }

      return payload
    } catch (error) {
      lastError = error instanceof IncoisRequestError
        ? error
        : error?.name === 'AbortError'
          ? new IncoisRequestError(
            `INCOIS request timed out after ${timeoutMs} ms`,
            { code: 'INCOIS_TIMEOUT', status: 504, cause: error }
          )
          : new IncoisRequestError(
            `Unable to connect to INCOIS ERDDAP: ${error.message}`,
            { code: 'INCOIS_CONNECTION_ERROR', status: 502, cause: error }
          )
    } finally {
      clearTimeout(timeout)
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  throw lastError
}

function readCatalog(payload) {
  const rows = toRows(payload)
  return rows
    .map((row) => ({
      dataset: row.datasetID ?? row.datasetId ?? row.id,
      title: row.title ?? '',
      summary: row.summary ?? '',
      minTime: row.minTime ?? null,
      maxTime: row.maxTime ?? null,
    }))
    .filter((item) => item.dataset)
}

function infoRows(payload) {
  return toRows(payload).map((row) => {
    const normalized = {}
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeName(key).replaceAll(' ', '_')] = value
    }
    return normalized
  })
}

function parseDatasetMetadata(payload, catalogEntry) {
  const rows = infoRows(payload)
  if (rows.length === 0) {
    throw new IncoisRequestError(
      `INCOIS metadata for ${catalogEntry.dataset} was empty`,
      { code: 'INCOIS_EMPTY_METADATA', status: 502 }
    )
  }

  const variables = new Map()
  const dimensions = []
  let minTime = catalogEntry.minTime
  let maxTime = catalogEntry.maxTime
  let spatialCoverage = {}

  for (const row of rows) {
    const rowType = normalizeName(row.row_type ?? row.rowtype ?? row.type)
    const variableName = row.variable_name ?? row.variablename
    const attributeName = row.attribute_name ?? row.attributename
    const value = row.value

    if (variableName && attributeName) {
      const variable = variables.get(variableName) ?? {
        name: variableName,
        attributes: {},
      }
      variable.attributes[attributeName] = value
      variables.set(variableName, variable)
    }

    const dimensionName =
      row.dimension_name ?? row.dimensionname ??
      (rowType.includes('dimension') ? variableName : null)

    if (dimensionName && !dimensions.some((item) => item.name === dimensionName)) {
      dimensions.push({
        name: dimensionName,
        attributes: {},
      })
    }

    if (dimensionName && attributeName) {
      const dimension = dimensions.find((item) => item.name === dimensionName)
      dimension.attributes[attributeName] = value
    }

    const lowerAttribute = normalizeName(attributeName)
    if (lowerAttribute === 'min_time' && value) minTime = value
    if (lowerAttribute === 'max_time' && value) maxTime = value
    if (lowerAttribute.includes('geospatial_lat_min')) spatialCoverage.latitudeMin = asNumber(value)
    if (lowerAttribute.includes('geospatial_lat_max')) spatialCoverage.latitudeMax = asNumber(value)
    if (lowerAttribute.includes('geospatial_lon_min')) spatialCoverage.longitudeMin = asNumber(value)
    if (lowerAttribute.includes('geospatial_lon_max')) spatialCoverage.longitudeMax = asNumber(value)
  }

  return {
    ...catalogEntry,
    minTime,
    maxTime,
    variables: [...variables.values()],
    dimensions,
    spatialCoverage,
    metadataRows: rows,
  }
}

function variableText(variable) {
  return [
    variable.name,
    variable.attributes.standard_name,
    variable.attributes.long_name,
    variable.attributes.description,
  ].map(normalizeName).join(' ')
}

function findVariable(metadata, definition, direction) {
  const matches = direction === 'east'
    ? definition.eastwardMatches
    : direction === 'north'
      ? definition.northwardMatches
      : definition.matches

  return metadata.variables
    .map((variable) => ({
      variable,
      score: matches.reduce(
        (score, match) => score + (variableText(variable).includes(match) ? 1 : 0),
        0
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.variable ?? null
}

function classifyDataStatus(minTime, maxTime) {
  const max = Date.parse(maxTime)
  if (!Number.isFinite(max)) return 'unknown'

  const now = Date.now()
  if (max > now) return 'forecast'
  if (now - max <= 72 * 60 * 60 * 1000) return 'nrt'
  return 'historical'
}

function axisKind(name) {
  const value = normalizeName(name)
  if (value.includes('time') || value.includes('date')) return 'time'
  if (value.includes('lat')) return 'latitude'
  if (value.includes('lon') || value.includes('lng')) return 'longitude'
  if (value.includes('depth') || value.includes('lev')) return 'depth'
  return 'other'
}

function chooseDimensionValue(dimension, { latitude, longitude, time }) {
  const kind = axisKind(dimension.name)
  if (kind === 'latitude') return latitude
  if (kind === 'longitude') return longitude
  if (kind === 'time') return time
  if (kind === 'depth') return 0

  const attributes = dimension.attributes
  return attributes.actual_range?.split?.(',')?.[0]?.trim() ??
    attributes.valid_min ??
    attributes.min ??
    0
}

function buildVariableSelector(variable, metadata, options) {
  const constraints = metadata.dimensions.map((dimension) => {
    const value = chooseDimensionValue(dimension, options)
    return `[(${value}):1:(${value})]`
  }).join('')

  return `${variable.name}${constraints}`
}

function buildDataUrl(dataset, selectors) {
  return `${INCOIS_GRIDDAP}/${encodeURIComponent(dataset)}.json?${encodeURIComponent(selectors.join(','))}`
}

function readDataRows(payload) {
  const rows = toRows(payload)
  if (rows.length === 0) {
    throw new IncoisRequestError(
      'INCOIS returned an empty data response',
      { code: 'INCOIS_EMPTY_DATA', status: 404 }
    )
  }
  return rows
}

function valueFromRow(row, variableName) {
  const requested = normalizeName(variableName)
  const entry = Object.entries(row).find(([key]) => normalizeName(key) === requested)
  return entry ? asNumber(entry[1]) : null
}

function timeFromRow(row, fallback) {
  const entry = Object.entries(row).find(([key]) => axisKind(key) === 'time')
  return entry?.[1] ?? fallback
}

function coordinatesFromRow(row, fallback) {
  const latitude = Object.entries(row).find(([key]) => axisKind(key) === 'latitude')
  const longitude = Object.entries(row).find(([key]) => axisKind(key) === 'longitude')
  return {
    latitude: asNumber(latitude?.[1]) ?? fallback.latitude,
    longitude: asNumber(longitude?.[1]) ?? fallback.longitude,
  }
}

function parameterResult({
  value,
  unit,
  dataset,
  variable,
  observationTime,
  coordinates,
  sourceUrl,
  retrievedAt,
  dataStatus,
}) {
  return {
    value,
    unit: unit ?? null,
    dataset,
    variable,
    time: observationTime ?? null,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    sourceUrl,
    retrievedAt,
    dataStatus,
  }
}

export async function discoverIncoisDatasets({
  fetchImpl = globalThis.fetch,
  timeoutMs = INCOIS_TIMEOUT_MS,
} = {}) {
  const payload = await fetchJson(INCOIS_CATALOG_URL, { fetchImpl, timeoutMs })
  const catalog = readCatalog(payload)
  if (catalog.length === 0) {
    throw new IncoisRequestError(
      'INCOIS dataset catalog was empty or malformed',
      { code: 'INCOIS_EMPTY_CATALOG', status: 502 }
    )
  }

  return catalog
}

export async function inspectIncoisDataset(
  catalogEntry,
  { fetchImpl = globalThis.fetch, timeoutMs = INCOIS_TIMEOUT_MS } = {}
) {
  if (!catalogEntry?.dataset) {
    throw new IncoisRequestError('Dataset ID is required for metadata inspection', {
      code: 'INCOIS_INVALID_DATASET',
      status: 400,
    })
  }

  const url = `${INCOIS_INFO}/${encodeURIComponent(catalogEntry.dataset)}/index.json`
  const payload = await fetchJson(url, { fetchImpl, timeoutMs })
  return parseDatasetMetadata(payload, catalogEntry)
}

function candidateScore(entry, parameter) {
  const text = normalizeName(`${entry.title} ${entry.summary}`)
  const definition = PARAMETER_DEFINITIONS[parameter]
  const matches = parameter === 'current'
    ? [...definition.eastwardMatches, ...definition.northwardMatches]
    : definition.matches
  return matches.reduce((score, match) => score + (text.includes(match) ? 1 : 0), 0)
}

export async function discoverDatasetForParameter(
  parameter,
  { fetchImpl = globalThis.fetch, timeoutMs = INCOIS_TIMEOUT_MS } = {}
) {
  const definition = PARAMETER_DEFINITIONS[parameter]
  if (!definition) {
    throw new IncoisRequestError(`Unsupported INCOIS parameter: ${parameter}`, {
      code: 'UNSUPPORTED_PARAMETER',
      status: 400,
    })
  }

  const catalog = (await discoverIncoisDatasets({ fetchImpl, timeoutMs }))
    .filter((entry) => candidateScore(entry, parameter) > 0)
    .sort((a, b) => candidateScore(b, parameter) - candidateScore(a, parameter))

  for (const entry of catalog) {
    const metadata = await inspectIncoisDataset(entry, { fetchImpl, timeoutMs })
    const selected = parameter === 'current'
      ? {
        eastward: findVariable(metadata, definition, 'east'),
        northward: findVariable(metadata, definition, 'north'),
      }
      : { value: findVariable(metadata, definition) }

    if ((parameter === 'current' && selected.eastward && selected.northward) ||
      (parameter !== 'current' && selected.value)) {
      return { metadata, selected }
    }
  }

  throw new IncoisRequestError(
    `No verified INCOIS dataset exposes ${definition.label}`,
    { code: 'INCOIS_PARAMETER_UNAVAILABLE', status: 404 }
  )
}

async function queryParameter(parameter, {
  latitude,
  longitude,
  time,
  fetchImpl = globalThis.fetch,
  timeoutMs = INCOIS_TIMEOUT_MS,
} = {}) {
  assertCoordinates(latitude, longitude)
  const discovered = await discoverDatasetForParameter(parameter, { fetchImpl, timeoutMs })
  const metadata = discovered.metadata
  const selectedVariables = parameter === 'current'
    ? [discovered.selected.eastward, discovered.selected.northward]
    : [discovered.selected.value]
  const requestedTime = time ?? metadata.maxTime ?? new Date().toISOString()
  const selectors = selectedVariables.map((variable) =>
    buildVariableSelector(variable, metadata, {
      latitude,
      longitude,
      time: requestedTime,
    })
  )
  const sourceUrl = buildDataUrl(metadata.dataset, selectors)
  const payload = await fetchJson(sourceUrl, { fetchImpl, timeoutMs })
  const rows = readDataRows(payload)
  const row = rows[0]
  const coordinates = coordinatesFromRow(row, { latitude, longitude })
  const observationTime = timeFromRow(row, requestedTime)
  const dataStatus = classifyDataStatus(metadata.minTime, metadata.maxTime)
  const retrievedAt = new Date().toISOString()

  return {
    metadata: {
      dataset: metadata.dataset,
      title: metadata.title,
      minTime: metadata.minTime,
      maxTime: metadata.maxTime,
      spatialCoverage: metadata.spatialCoverage,
      dimensions: metadata.dimensions,
      variables: metadata.variables.map((variable) => ({
        name: variable.name,
        attributes: variable.attributes,
      })),
    },
    sourceUrl,
    retrievedAt,
    observationTime,
    coordinates,
    dataStatus,
    selectedVariables,
    row,
  }
}

export async function getSST(options = {}) {
  const result = await queryParameter('sst', options)
  const variable = result.selectedVariables[0]
  const variableMetadata = result.metadata.variables.find((item) => item.name === variable.name)
  const value = valueFromRow(result.row, variable.name)
  if (value === null) {
    throw new IncoisRequestError('INCOIS SST response did not contain a numeric value', {
      code: 'INCOIS_INVALID_DATA',
      status: 502,
    })
  }
  return parameterResult({
    value,
    unit: variableMetadata?.attributes?.units,
    dataset: result.metadata.dataset,
    variable: variable.name,
    observationTime: result.observationTime,
    coordinates: result.coordinates,
    sourceUrl: result.sourceUrl,
    retrievedAt: result.retrievedAt,
    dataStatus: result.dataStatus,
  })
}

export async function getWaveHeight(options = {}) {
  const result = await queryParameter('waveHeight', options)
  const variable = result.selectedVariables[0]
  const variableMetadata = result.metadata.variables.find((item) => item.name === variable.name)
  const value = valueFromRow(result.row, variable.name)
  if (value === null) {
    throw new IncoisRequestError(
      'INCOIS wave-height response did not contain a numeric value',
      { code: 'INCOIS_INVALID_DATA', status: 502 }
    )
  }
  return parameterResult({
    value,
    unit: variableMetadata?.attributes?.units,
    dataset: result.metadata.dataset,
    variable: variable.name,
    observationTime: result.observationTime,
    coordinates: result.coordinates,
    sourceUrl: result.sourceUrl,
    retrievedAt: result.retrievedAt,
    dataStatus: result.dataStatus,
  })
}

function currentDirectionDegrees(u, v) {
  return (Math.atan2(u, v) * 180 / Math.PI + 360) % 360
}

export async function getSurfaceCurrent(options = {}) {
  const result = await queryParameter('current', options)
  const eastward = result.selectedVariables[0]
  const northward = result.selectedVariables[1]
  const u = valueFromRow(result.row, eastward.name)
  const v = valueFromRow(result.row, northward.name)

  if (u === null || v === null) {
    throw new IncoisRequestError(
      'INCOIS current response did not contain numeric u/v components',
      { code: 'INCOIS_INVALID_CURRENT', status: 502 }
    )
  }

  const eastwardMetadata = result.metadata.variables.find((item) => item.name === eastward.name)
  return {
    speed: parameterResult({
      value: Math.sqrt((u ** 2) + (v ** 2)),
      unit: eastwardMetadata?.attributes?.units,
      dataset: result.metadata.dataset,
      variable: `${eastward.name},${northward.name}`,
      observationTime: result.observationTime,
      coordinates: result.coordinates,
      sourceUrl: result.sourceUrl,
      retrievedAt: result.retrievedAt,
      dataStatus: result.dataStatus,
    }),
    direction: parameterResult({
      value: currentDirectionDegrees(u, v),
      unit: 'degrees clockwise from north',
      dataset: result.metadata.dataset,
      variable: `${eastward.name},${northward.name}`,
      observationTime: result.observationTime,
      coordinates: result.coordinates,
      sourceUrl: result.sourceUrl,
      retrievedAt: result.retrievedAt,
      dataStatus: result.dataStatus,
    }),
    u: eastward.name === northward.name ? null : u,
    v,
  }
}

export async function getMarineParameters({
  latitude,
  longitude,
  time,
  fetchImpl = globalThis.fetch,
  timeoutMs = INCOIS_TIMEOUT_MS,
} = {}) {
  assertCoordinates(latitude, longitude)
  const parameters = {}
  const errors = {}

  for (const [name, getter] of [
    ['sst', getSST],
    ['significantWaveHeight', getWaveHeight],
    ['surfaceCurrent', getSurfaceCurrent],
  ]) {
    try {
      parameters[name] = await getter({
        latitude,
        longitude,
        time,
        fetchImpl,
        timeoutMs,
      })
    } catch (error) {
      const normalized = error instanceof IncoisRequestError
        ? error
        : new IncoisRequestError(error.message)
      errors[name] = {
        code: normalized.code,
        message: normalized.message,
        status: normalized.status,
        upstreamStatus: normalized.cause?.upstreamStatus,
      }
    }
  }

  if (Object.keys(parameters).length === 0 && Object.keys(errors).length > 0) {
    const firstError = Object.values(errors)[0]
    return {
      isLive: false,
      status: 'unavailable',
      source: 'INCOIS ERDDAP',
      parameters: {},
      errors,
      error: firstError,
      latitude,
      longitude,
      retrievedAt: new Date().toISOString(),
    }
  }

  return {
    isLive: Object.values(parameters).some((parameter) =>
      parameter?.dataStatus === 'nrt' ||
      parameter?.speed?.dataStatus === 'nrt'
    ),
    status: Object.keys(errors).length > 0 ? 'partial' : 'ok',
    source: 'INCOIS ERDDAP',
    parameters,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    latitude,
    longitude,
    retrievedAt: new Date().toISOString(),
  }
}

// Legacy compatibility for the existing frontend helper.
function legacyWindUrl({ latitude, longitude, time }) {
  const query =
    `wind_speed[(${time}):1:(${time})]` +
    `[(10):1:(10)]` +
    `[(${latitude}):1:(${latitude})]` +
    `[(${longitude}):1:(${longitude})]`
  return `${INCOIS_GRIDDAP}/${INCOIS_LEGACY_WIND_DATASET}.json?${encodeURIComponent(query)}`
}

export async function fetchIncoisObservation({
  latitude,
  longitude,
  time = INCOIS_DEFAULT_TIME,
} = {}) {
  const fetchedAt = new Date().toISOString()
  let sourceUrl = null

  try {
    assertCoordinates(latitude, longitude)
    sourceUrl = legacyWindUrl({ latitude, longitude, time })
    const payload = await fetchJson(sourceUrl)
    const row = readDataRows(payload)[0]
    const windSpeed = valueFromRow(row, 'wind_speed') ?? asNumber(row.windSpeed)
    if (windSpeed === null) {
      throw new IncoisRequestError('No numeric legacy wind speed returned', {
        code: 'INCOIS_INVALID_DATA',
        status: 502,
      })
    }

    return {
      source: 'INCOIS ERDDAP',
      sourceUrl,
      accessMethod: 'Public ERDDAP griddap JSON query',
      fetchedAt,
      latitude,
      longitude,
      parameters: { windSpeed },
      units: { windSpeed: 'm/s' },
      isLive: false,
      metadata: {
        dataset: INCOIS_LEGACY_WIND_DATASET,
        observationTime: timeFromRow(row, time),
        depthMeters: asNumber(
          Object.entries(row).find(([key]) => normalizeName(key).includes('depth'))?.[1]
        ),
      },
      windSpeedMps: windSpeed,
    }
  } catch (error) {
    const normalized = error instanceof IncoisRequestError
      ? error
      : new IncoisRequestError(error.message)
    return {
      source: 'INCOIS ERDDAP',
      sourceUrl,
      fetchedAt,
      latitude,
      longitude,
      parameters: {},
      units: {},
      isLive: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        status: normalized.status,
        upstreamStatus: normalized.cause?.upstreamStatus,
      },
    }
  }
}

export function getIncoisDatasetInfoUrl(dataset = INCOIS_LEGACY_WIND_DATASET) {
  return `${INCOIS_INFO}/${encodeURIComponent(dataset)}/index.json`
}

export function getIncoisCatalogUrl() {
  return INCOIS_CATALOG_URL
}
