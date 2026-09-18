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

test('PFZ timeout is reported as unavailable without throwing', async () => {
  const result = await fetchIncoisPfz({
    fetchImpl: async () => {
      throw Object.assign(new Error('request aborted'), { name: 'AbortError' })
    },
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'source_timeout')
  assert.equal(result.evidence[0].value, null)
})

test('malformed PFZ response is reported as unavailable', async () => {
  const result = await fetchIncoisPfz({
    fetchImpl: async () => response({ features: 'not-an-array' }),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'malformed_response')
})

test('empty PFZ FeatureCollection is reported separately without crashing', async () => {
  const result = await fetchIncoisPfz({
    fetchImpl: async () => response({ type: 'FeatureCollection', features: [] }),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'empty_feature_collection')
  assert.equal(result.evidence[0].value, null)
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

test('selected operating coordinates produce nearest-line supplemental evidence', async () => {
  const result = await fetchIncoisPfz({
    latitude: 18.85,
    longitude: 72.55,
    coordinateRole: 'selected_operating_location',
    coordinatePolicy: 'direct_coordinate_request_no_snapping',
    retrievedAt: '2026-09-18T06:00:00.000Z',
    fetchImpl: async () => response({ type: 'FeatureCollection', features: [feature] }),
  })

  assert.deepEqual(result.spatial.selectedCoordinates, {
    latitude: 18.85,
    longitude: 72.55,
  })
  assert.equal(result.spatial.coordinateRole, 'selected_operating_location')
  assert.equal(result.spatial.coordinatePolicy, 'direct_coordinate_request_no_snapping')
  assert.equal(result.spatial.geometryAvailable, true)
  assert.equal(result.spatial.nearestFeature.uid, '2026258001')
  assert.equal(result.spatial.nearestFeature.year, 2026)
  assert.equal(result.spatial.nearestFeature.julianDay, '258')
  assert.equal(result.spatial.nearestFeature.geometryType, 'MultiLineString')
  assert.equal(result.spatial.pointOnLine, true)
  assert.equal(result.spatial.distanceKm, 0)
  assert.equal(result.evidence[0].value.distanceKm, 0)
  assert.equal(result.evidence[0].quality.coordinateRole, 'selected_operating_location')
  assert.match(JSON.stringify(result), /distanceKm/)
  assert.doesNotMatch(JSON.stringify(result).toLowerCase(), /safe to fish|best fishing zone|catch probability/)
})

test('nearest-feature distance is geographic kilometres and preserves feature identity', async () => {
  const distant = {
    ...feature,
    properties: { ...feature.properties, UID: 'far-away' },
    geometry: {
      type: 'MultiLineString',
      coordinates: [[[80, 20], [80.1, 20.1]]],
    },
  }
  const result = await fetchIncoisPfz({
    latitude: 18.8,
    longitude: 72.5,
    fetchImpl: async () => response({ type: 'FeatureCollection', features: [distant, feature] }),
  })

  assert.equal(result.spatial.nearestFeature.uid, '2026258001')
  assert.equal(result.spatial.distanceKm, 0)
  assert.equal(result.evidence[0].quality.coordinatePolicy, 'direct_coordinate_request_no_snapping')
})

test('missing geometry remains failure-safe without fabricating spatial facts', async () => {
  const result = await fetchIncoisPfz({
    latitude: 18.8,
    longitude: 72.5,
    fetchImpl: async () => response({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: null, properties: { UID: 'no-geometry' } }],
    }),
  })

  assert.equal(result.status, 'available')
  assert.equal(result.spatial.geometryAvailable, false)
  assert.equal(result.spatial.nearestFeature, null)
  assert.equal(result.spatial.distanceKm, null)
  assert.equal(result.spatial.spatialRelation, 'geometry_unavailable')
})
