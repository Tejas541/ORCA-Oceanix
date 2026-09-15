const IMD_API_BASE_URL = 'https://api.imd.gov.in'
const IMD_SEA_BULLETIN_PATH = '/api/v1/seabulletin'
export const IMD_SEA_BULLETIN_URL = `${IMD_API_BASE_URL}${IMD_SEA_BULLETIN_PATH}`
export const IMD_TIMEOUT_MS = 15000

export class ImdRequestError extends Error {
  constructor(message, { code = 'IMD_REQUEST_FAILED', status = 502, cause } = {}) {
    super(message, { cause })
    this.name = 'ImdRequestError'
    this.code = code
    this.status = status
  }
}

function getConfiguration(env = process.env) {
  return {
    apiKey: env.IMD_API_KEY?.trim() ?? '',
    jwtToken: env.IMD_JWT_TOKEN?.trim() ?? '',
    baseUrl: (env.IMD_API_BASE_URL?.trim() || IMD_API_BASE_URL).replace(/\/$/, ''),
    timeoutMs: Number(env.IMD_TIMEOUT_MS) || IMD_TIMEOUT_MS,
  }
}

function assertConfigured(config) {
  const missing = []
  if (!config.apiKey) missing.push('IMD_API_KEY')
  if (!config.jwtToken) missing.push('IMD_JWT_TOKEN')

  if (missing.length > 0) {
    throw new ImdRequestError(
      `IMD credentials are not configured: ${missing.join(', ')}`,
      {
        code: 'IMD_CONFIGURATION_REQUIRED',
        status: 503,
      }
    )
  }
}

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function firstRecord(payload) {
  if (Array.isArray(payload)) return payload.find(isRecord) ?? null
  if (isRecord(payload?.data)) {
    return Array.isArray(payload.data)
      ? payload.data.find(isRecord) ?? null
      : payload.data
  }
  return isRecord(payload) ? payload : null
}

function readField(record, name) {
  return record[name] ?? record[name.toLowerCase()]
}

function validateBulletin(payload) {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new ImdRequestError(
      'IMD Sea Area Bulletin response was empty or malformed',
      { code: 'IMD_MALFORMED_RESPONSE', status: 502 }
    )
  }

  const record = firstRecord(payload)
  if (!record) {
    throw new ImdRequestError(
      'IMD Sea Area Bulletin did not contain a bulletin object',
      { code: 'IMD_MALFORMED_RESPONSE', status: 502 }
    )
  }

  const knownFields = [
    'Id',
    'Date of Observation',
    'Layer',
    'Issued by',
    'Valid From',
    'Validity',
    'TTT Warning',
    'Wind',
    'Synoptic Situation',
    'Weather',
    'Visibility',
    'Sea Condition',
    'Update Time',
  ]

  if (!knownFields.some((field) => readField(record, field) !== undefined)) {
    throw new ImdRequestError(
      'IMD Sea Area Bulletin did not contain documented bulletin fields',
      { code: 'IMD_MALFORMED_RESPONSE', status: 502 }
    )
  }

  return payload
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBulletin(payload, { sourceUrl, retrievedAt }) {
  const bulletin = firstRecord(payload)
  const warning = text(readField(bulletin, 'TTT Warning'))
  const weather = text(readField(bulletin, 'Weather'))
  const seaCondition = text(readField(bulletin, 'Sea Condition'))
  const synopticSituation = text(readField(bulletin, 'Synoptic Situation'))
  const parts = [
    warning && `Warning: ${warning}`,
    weather && `Weather: ${weather}`,
    seaCondition && `Sea condition: ${seaCondition}`,
    synopticSituation && `Synoptic situation: ${synopticSituation}`,
  ].filter(Boolean)

  return {
    meta: {
      source: 'IMD Sea-Area Bulletin',
      isLive: true,
      retrievedAt,
      endpoint: IMD_SEA_BULLETIN_PATH,
    },
    advisory: {
      summaryEn: parts.join(' | '),
    },
    bulletin: {
      id: text(readField(bulletin, 'Id')),
      observationDate: text(readField(bulletin, 'Date of Observation')),
      layer: text(readField(bulletin, 'Layer')),
      issuedBy: text(readField(bulletin, 'Issued by')),
      validFrom: text(readField(bulletin, 'Valid From')),
      validityHours: text(readField(bulletin, 'Validity')),
      warning,
      wind: text(readField(bulletin, 'Wind')),
      synopticSituation,
      weather,
      visibility: text(readField(bulletin, 'Visibility')),
      seaCondition,
      updateTime: text(readField(bulletin, 'Update Time')),
    },
    source: {
      type: 'live',
      isLive: true,
      provider: 'India Meteorological Department',
      sourceUrl,
    },
  }
}

async function fetchJson(
  url,
  { fetchImpl = globalThis.fetch, headers, timeoutMs = IMD_TIMEOUT_MS } = {}
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
    const body = await response.text()

    if (!response.ok) {
      throw new ImdRequestError(
        `IMD returned HTTP ${response.status}`,
        {
          code: response.status === 401 ? 'IMD_UNAUTHORIZED' : 'IMD_HTTP_ERROR',
          status: response.status === 401 ? 502 : response.status >= 500 ? 502 : response.status,
          cause: { upstreamStatus: response.status, body },
        }
      )
    }

    try {
      return body ? JSON.parse(body) : null
    } catch (error) {
      throw new ImdRequestError(
        'IMD returned malformed JSON',
        { code: 'IMD_MALFORMED_RESPONSE', status: 502, cause: error }
      )
    }
  } catch (error) {
    if (error instanceof ImdRequestError) throw error
    if (error?.name === 'AbortError') {
      throw new ImdRequestError(
        `IMD request timed out after ${timeoutMs} ms`,
        { code: 'IMD_TIMEOUT', status: 504, cause: error }
      )
    }
    throw new ImdRequestError(
      `Unable to connect to IMD: ${error.message}`,
      { code: 'IMD_CONNECTION_ERROR', status: 502, cause: error }
    )
  } finally {
    clearTimeout(timeout)
  }
}

export function getImdConfiguration(env = process.env) {
  const config = getConfiguration(env)
  return {
    configured: Boolean(config.apiKey && config.jwtToken),
    missing: [
      !config.apiKey && 'IMD_API_KEY',
      !config.jwtToken && 'IMD_JWT_TOKEN',
    ].filter(Boolean),
    baseUrl: config.baseUrl,
  }
}

export async function getSeaAreaBulletin({
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  const config = getConfiguration(env)
  const retrievedAt = new Date().toISOString()

  try {
    assertConfigured(config)
    const sourceUrl = `${config.baseUrl}${IMD_SEA_BULLETIN_PATH}`
    const payload = await fetchJson(sourceUrl, {
      fetchImpl,
      timeoutMs: config.timeoutMs,
      headers: {
        Accept: 'application/json',
        'x-api-key': config.apiKey,
        Authorization: `Bearer ${config.jwtToken}`,
      },
    })
    const validated = validateBulletin(payload)

    return {
      status: 'ok',
      isLive: true,
      source: 'India Meteorological Department',
      endpoint: IMD_SEA_BULLETIN_PATH,
      sourceUrl,
      retrievedAt,
      normalized: normalizeBulletin(validated, { sourceUrl, retrievedAt }),
      raw: validated,
    }
  } catch (error) {
    const requestError = error instanceof ImdRequestError
      ? error
      : new ImdRequestError(error.message)

    return {
      status: requestError.code === 'IMD_CONFIGURATION_REQUIRED'
        ? 'configuration_required'
        : 'unavailable',
      isLive: false,
      source: 'India Meteorological Department',
      endpoint: IMD_SEA_BULLETIN_PATH,
      sourceUrl: `${config.baseUrl}${IMD_SEA_BULLETIN_PATH}`,
      retrievedAt,
      normalized: null,
      error: {
        code: requestError.code,
        message: requestError.message,
        status: requestError.status,
        upstreamStatus: requestError.cause?.upstreamStatus ?? null,
      },
    }
  }
}
