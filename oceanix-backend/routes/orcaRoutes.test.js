import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createServer } from 'node:http'
import { createOrcaRouter } from './orcaRoutes.js'
import { getIncoisOrcaDecision } from '../services/orcaAdapterEvidence.js'
import { createEvidenceRecord } from '../../shared/orcaEvidence.js'

async function withServer(router, callback) {
  const app = express()
  app.use('/api/orca', router)
  const server = createServer(app)

  await new Promise((resolve) => server.listen(0, resolve))
  const { port } = server.address()

  try {
    return await callback(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('INCOIS route returns the canonical ORCA response', async () => {
  const canonical = {
    source: { source: 'INCOIS ERDDAP' },
    evidence: [{ parameter: 'waveHeight', value: 1.8 }],
    aggregation: { status: 'partial' },
    decision: { riskLevel: 'DATA_INSUFFICIENT', safetyScore: null },
  }
  const requests = []

  await withServer(createOrcaRouter({
    getDecision: async (options) => {
      requests.push(options)
      return canonical
    },
  }), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/orca/incois?latitude=9.9&longitude=76.2&time=2026-09-15T00%3A00%3A00Z`
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), canonical)
  })

  assert.deepEqual(requests, [{
    latitude: 9.9,
    longitude: 76.2,
    time: '2026-09-15T00:00:00Z',
  }])
})

test('INCOIS route returns the service-provided unavailable canonical response', async () => {
  const unavailable = {
    source: { source: 'INCOIS ERDDAP' },
    evidence: [],
    aggregation: {
      status: 'unavailable',
      sourceStatus: 'unavailable',
      isLive: false,
    },
    decision: {
      riskLevel: 'DATA_INSUFFICIENT',
      safetyScore: null,
    },
  }

  await withServer(createOrcaRouter({
    getDecision: async () => unavailable,
  }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orca/incois?lat=9.9&lon=76.2`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.decision.riskLevel, 'DATA_INSUFFICIENT')
    assert.equal(body.decision.safetyScore, null)
    assert.equal(body.aggregation.sourceStatus, 'unavailable')
    assert.equal(body.evidence.length, 0)
  })
})

test('INCOIS HTTP route uses OSF wave and wind despite legacy marine parameters', async () => {
  const calls = []
  const osfEvidence = (parameter, value) => createEvidenceRecord({
    provider: 'INCOIS',
    source: 'INCOIS Ocean State Forecast',
    endpoint: `https://incois.test/${parameter}`,
    parameter,
    value,
    unit: parameter === 'waveHeight' ? 'm' : 'm/s',
    location: [18.94527777777778, 72.94],
    forecastTime: '2026-09-18T00:00:00Z',
    retrievedAt: '2026-09-17T23:00:00Z',
    status: 'available',
    quality: {
      coordinateRole: 'selected_operating_location',
      coordinatePolicy: 'direct_coordinate_request_no_snapping',
      sourceDataStatus: 'forecast',
      dataset: 'osf_test_dataset',
    },
  })

  await withServer(createOrcaRouter({
    getDecision: (options) => getIncoisOrcaDecision({
      ...options,
      marineParameters: {
        source: 'INCOIS ERDDAP',
        parameters: {},
        status: 'unavailable',
      },
      getWave: async (request) => {
        calls.push(['wave', request])
        return { evidence: [osfEvidence('waveHeight', 1.2)] }
      },
      getWind: async (request) => {
        calls.push(['wind', request])
        return { evidence: [osfEvidence('windSpeed', 2.3)] }
      },
    }),
  }), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/orca/incois?latitude=18.94527777777778&longitude=72.94&coordinateRole=selected_operating_location&coordinatePolicy=direct_coordinate_request_no_snapping`
    )
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(calls[0][1], calls[1][1])
    assert.deepEqual(body.evidence
      .filter(({ parameter }) => ['waveHeight', 'windSpeed'].includes(parameter))
      .map(({ parameter, value }) => ({ parameter, value })), [
      { parameter: 'waveHeight', value: 1.2 },
      { parameter: 'windSpeed', value: 2.3 },
    ])
    assert.equal(body.evidence.some(({ source }) => source === 'INCOIS ERDDAP'), false)
    assert.equal(body.requestContext.coordinateRole, 'selected_operating_location')
    assert.equal(body.requestContext.coordinatePolicy, 'direct_coordinate_request_no_snapping')
  })
})
