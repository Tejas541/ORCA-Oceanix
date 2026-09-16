import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateOrcaDecision } from '../../shared/orcaDecisionEngine.js'
import {
  buildPfzEvidence,
  fetchIncoisPfz,
  INCOIS_PFZ_WFS_ENDPOINT,
} from './incoisPfzService.js'

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const feature = {
  type: 'Feature',
  geometry: {
    type: 'MultiLineString',
    coordinates: [[[72.5, 18.8], [72.6, 18.9]]],
  },
  properties: {
    State_Name: 'MAHARASHTRA',
    SECTORBOUN: '3',
    Julian_day: '258',
    Year: 2026,
    UID: '2026258001',
  },
}

test('parses official PFZ GeoJSON and preserves provenance', async () => {
  const retrievedAt = '2026-09-16T06:00:00.000Z'
  const result = await fetchIncoisPfz({
    retrievedAt,
    fetchImpl: async (url) => {
      assert.equal(url, INCOIS_PFZ_WFS_ENDPOINT)
      return response({ type: 'FeatureCollection', features: [feature] })
    },
  })

  assert.equal(result.status, 'available')
  assert.equal(result.isLive, false)
  assert.equal(result.advisoryDate, '2026-09-15')
  assert.equal(result.validUntil, null)
  assert.deepEqual(result.sector, {
    states: ['MAHARASHTRA'],
    boundaries: ['3'],
  })
  assert.equal(result.data.features.length, 1)
  assert.equal(result.provenance.endpoint, INCOIS_PFZ_WFS_ENDPOINT)
  assert.equal(result.retrievedAt, retrievedAt)
  assert.deepEqual(result.evidence.map((record) => record.parameter), ['pfz'])
  assert.equal(result.evidence[0].isLive, false)
})

test('preserves multiple advisory dates without inventing a validity date', async () => {
  const second = {
    ...feature,
    properties: { ...feature.properties, Julian_day: '259' },
  }
  const result = await fetchIncoisPfz({
    fetchImpl: async () => response({
      type: 'FeatureCollection',
      features: [feature, second],
    }),
  })

  assert.equal(result.advisoryDate, null)
  assert.deepEqual(result.provenance.advisoryDates, ['2026-09-15', '2026-09-16'])
  assert.equal(result.validUntil, null)
})

test('missing fields do not create fabricated metadata or safety parameters', async () => {
  const result = await fetchIncoisPfz({
    fetchImpl: async () => response({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[72.5, 18.8], [72.6, 18.9]] },
        properties: {},
      }],
    }),
  })

  assert.equal(result.status, 'available')
  assert.equal(result.advisoryDate, null)
  assert.equal(result.validUntil, null)
  assert.equal(result.evidence.length, 1)
  assert.equal(result.evidence[0].parameter, 'pfz')
  assert.equal(result.evidence.some((record) =>
    ['waveHeight', 'windSpeed', 'visibility', 'lightningRiskPercent', 'cyclone']
      .includes(record.parameter)
  ), false)
})

test('unavailable INCOIS returns structured unavailable data without fallback', async () => {
  const result = await fetchIncoisPfz({
    retrievedAt: '2026-09-16T06:00:00.000Z',
    fetchImpl: async () => response({ error: 'upstream unavailable' }, 503),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.isLive, false)
  assert.equal(result.reason, 'source_unavailable')
  assert.equal(result.data, null)
  assert.equal(result.evidence[0].value, null)
  assert.equal(result.evidence[0].validation, 'missing')
})

test('malformed PFZ response is reported as unavailable', async () => {
  const result = await fetchIncoisPfz({
    fetchImpl: async () => response({ features: [] }),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'malformed_response')
})

test('PFZ evidence builder preserves official data without mapping safety values', () => {
  const evidence = buildPfzEvidence({
    status: 'available',
    retrievedAt: '2026-09-16T06:00:00.000Z',
    advisoryDate: '2026-09-15',
    validUntil: null,
    sector: { states: ['MAHARASHTRA'], boundaries: ['3'] },
    source: {
      provider: 'INCOIS',
      name: 'INCOIS PFZ WFS',
      endpoint: INCOIS_PFZ_WFS_ENDPOINT,
    },
    data: { type: 'FeatureCollection', features: [feature] },
  })

  assert.equal(evidence.parameter, 'pfz')
  assert.equal(evidence.observationTime, '2026-09-15')
  assert.equal(evidence.isLive, false)
  assert.equal(evidence.quality.featureCount, 1)
})

test('PFZ evidence cannot produce a safety decision by itself', () => {
  const evidence = buildPfzEvidence({
    status: 'available',
    retrievedAt: '2026-09-16T06:00:00.000Z',
    advisoryDate: '2026-09-15',
    source: {
      provider: 'INCOIS',
      name: 'INCOIS PFZ WFS',
      endpoint: INCOIS_PFZ_WFS_ENDPOINT,
    },
    data: { type: 'FeatureCollection', features: [feature] },
  })

  const decision = evaluateOrcaDecision({ evidence: [evidence] })
  assert.equal(decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(decision.safetyScore, null)
})

test('identical PFZ payloads with the same retrieval time are deterministic', async () => {
  const fetchImpl = async () => response({
    type: 'FeatureCollection',
    features: [feature],
  })
  const options = {
    fetchImpl,
    retrievedAt: '2026-09-16T06:00:00.000Z',
  }

  assert.deepEqual(
    await fetchIncoisPfz(options),
    await fetchIncoisPfz(options)
  )
})
