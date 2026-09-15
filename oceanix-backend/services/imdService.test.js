import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getSeaAreaBulletin,
  IMD_SEA_BULLETIN_URL,
} from './imdService.js'

const credentials = {
  IMD_API_KEY: 'test-api-key',
  IMD_JWT_TOKEN: 'test-jwt-token',
}

const bulletin = [{
  Id: '109',
  'Date of Observation': '2026-09-15',
  Layer: 'South West Bay',
  'Issued by': 'ACWC KOLKATA',
  'Valid From': '2026-09-15 21:00:00',
  Validity: '12',
  'TTT Warning': 'NIL',
  Wind: 'East / South Easterly, 5 - 10 Knots',
  'Synoptic Situation': 'Weather seasonal over bay of bengal.',
  Weather: 'Isolated Rain / Thunderstorm',
  Visibility: 'Good Becoming Moderate',
  'Sea Condition': 'Smooth to Slight',
  'Update Time': '2026-09-15 20:40:07',
}]

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('missing credentials returns configuration_required without fetching', async () => {
  let called = false
  const result = await getSeaAreaBulletin({
    env: {},
    fetchImpl: async () => {
      called = true
      return jsonResponse(bulletin)
    },
  })

  assert.equal(called, false)
  assert.equal(result.status, 'configuration_required')
  assert.equal(result.isLive, false)
  assert.equal(result.error.code, 'IMD_CONFIGURATION_REQUIRED')
})

test('successful mocked bulletin is validated and normalized', async () => {
  let request
  const result = await getSeaAreaBulletin({
    env: credentials,
    fetchImpl: async (url, options) => {
      request = { url, options }
      return jsonResponse(bulletin)
    },
  })

  assert.equal(result.status, 'ok')
  assert.equal(result.isLive, true)
  assert.equal(request.url, IMD_SEA_BULLETIN_URL)
  assert.equal(request.options.headers['x-api-key'], 'test-api-key')
  assert.equal(request.options.headers.Authorization, 'Bearer test-jwt-token')
  assert.equal(result.normalized.advisory.summaryEn.includes('Smooth to Slight'), true)
  assert.equal(result.normalized.bulletin.layer, 'South West Bay')
  assert.equal(result.normalized.source.isLive, true)
})

test('upstream HTTP 401 is returned as unavailable', async () => {
  const result = await getSeaAreaBulletin({
    env: credentials,
    fetchImpl: async () => jsonResponse({ error: 'API key missing' }, 401),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.isLive, false)
  assert.equal(result.error.code, 'IMD_UNAUTHORIZED')
  assert.equal(result.error.upstreamStatus, 401)
})

test('malformed upstream response is rejected', async () => {
  const result = await getSeaAreaBulletin({
    env: credentials,
    fetchImpl: async () => jsonResponse({ status: true, data: [] }),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.error.code, 'IMD_MALFORMED_RESPONSE')
  assert.equal(result.isLive, false)
})

test('network and timeout failures are structured without mock substitution', async () => {
  const networkResult = await getSeaAreaBulletin({
    env: credentials,
    fetchImpl: async () => {
      throw new Error('network unavailable')
    },
  })
  assert.equal(networkResult.error.code, 'IMD_CONNECTION_ERROR')
  assert.equal(networkResult.isLive, false)

  const timeoutResult = await getSeaAreaBulletin({
    env: { ...credentials, IMD_TIMEOUT_MS: '1' },
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }),
  })
  assert.equal(timeoutResult.error.code, 'IMD_TIMEOUT')
  assert.equal(timeoutResult.isLive, false)
})
