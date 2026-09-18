import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchGdacsCyclone,
  GDACS_GEOMETRY_ENDPOINT,
  GDACS_SEARCH_ENDPOINT,
  pointInGeometry,
} from './gdacsCycloneService.js'

const searchFeature = ({ iscurrent = true, eventid = 1001 } = {}) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [72.94, 18.94527777777778] },
  properties: {
    eventtype: 'TC',
    eventid,
    episodeid: 7,
    eventname: 'TEST-CYCLONE',
    name: 'Tropical Cyclone TEST-CYCLONE',
    iscurrent: String(iscurrent),
    alertlevel: 'Orange',
    episodealertlevel: 'Green',
    source: 'TEST-SOURCE',
    severitydata: { severitytext: 'Tropical Storm' },
    todate: '2026-09-18T12:00:00',
    url: { report: 'https://www.gdacs.org/report.aspx?eventid=1001' },
  },
})

const geometry = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [72, 18],
        [74, 18],
        [74, 20],
        [72, 20],
        [72, 18],
      ]],
    },
  }],
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('valid current cyclone response produces canonical evidence and full provenance', async () => {
  const requests = []
  const result = await fetchGdacsCyclone({
    latitude: 18.94527777777778,
    longitude: 72.94,
    retrievedAt: '2026-09-18T12:30:00Z',
    coordinateRole: 'selected_operating_location',
    coordinatePolicy: 'direct_coordinate_request_no_snapping',
    fetchImpl: async (url) => {
      requests.push(url)
      return url.startsWith(GDACS_SEARCH_ENDPOINT)
        ? response({ type: 'FeatureCollection', features: [searchFeature()] })
        : response(geometry)
    },
  })

  assert.equal(requests.length, 2)
  assert.match(requests[0], /eventlist=TC/)
  assert.match(requests[1], new RegExp(`${GDACS_GEOMETRY_ENDPOINT.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`))
  assert.equal(result.status, 'available')
  assert.equal(result.evidence[0].parameter, 'cyclone')
  assert.equal(result.evidence[0].value.active, true)
  assert.equal(result.evidence[0].value.category, 'Tropical Storm')
  assert.equal(result.evidence[0].value.name, 'TEST-CYCLONE')
  assert.equal(result.evidence[0].quality.eventId, 1001)
  assert.equal(result.evidence[0].quality.episodeId, 7)
  assert.equal(result.evidence[0].quality.alertLevel, 'Orange')
  assert.equal(result.evidence[0].quality.coordinateRole, 'selected_operating_location')
  assert.equal(result.evidence[0].quality.coordinatePolicy, 'direct_coordinate_request_no_snapping')
  assert.equal(result.evidence[0].quality.attribution, 'Global Disaster Awareness and Coordination System, GDACS')
  assert.equal(result.evidence[0].retrievedAt, '2026-09-18T12:30:00Z')
})

test('no current relevant cyclone returns an inactive canonical cyclone object', async () => {
  const result = await fetchGdacsCyclone({
    latitude: 18.94527777777778,
    longitude: 72.94,
    fetchImpl: async () => response({
      type: 'FeatureCollection',
      features: [searchFeature({ iscurrent: false })],
    }),
  })

  assert.equal(result.status, 'available')
  assert.deepEqual(result.evidence[0].value, { active: false, category: 'none' })
  assert.equal(result.evidence[0].validation, 'valid')
  assert.equal(result.evidence[0].quality.candidateCount, 0)
})

test('current cyclone outside the operating coordinate is not relevant', async () => {
  const outsideGeometry = {
    ...geometry,
    features: [{
      ...geometry.features[0],
      geometry: {
        type: 'Polygon',
        coordinates: [[[80, 10], [81, 10], [81, 11], [80, 11], [80, 10]]],
      },
    }],
  }
  const result = await fetchGdacsCyclone({
    latitude: 18.94527777777778,
    longitude: 72.94,
    fetchImpl: async (url) => url.startsWith(GDACS_SEARCH_ENDPOINT)
      ? response({ type: 'FeatureCollection', features: [searchFeature()] })
      : response(outsideGeometry),
  })

  assert.deepEqual(result.evidence[0].value, { active: false, category: 'none' })
})

test('point-in-polygon relevance supports polygons and rejects outside points', () => {
  assert.equal(pointInGeometry(72.94, 18.945, geometry.features[0].geometry), true)
  assert.equal(pointInGeometry(75, 21, geometry.features[0].geometry), false)
})

test('malformed search response returns unavailable evidence', async () => {
  const result = await fetchGdacsCyclone({
    latitude: 18,
    longitude: 72,
    fetchImpl: async () => response({ malformed: true }),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.evidence[0].parameter, 'cyclone')
  assert.equal(result.evidence[0].value, null)
  assert.equal(result.evidence[0].quality.sourceError.code, 'GDACS_MALFORMED_RESPONSE')
})

test('HTTP failure returns unavailable evidence without throwing', async () => {
  const result = await fetchGdacsCyclone({
    latitude: 18,
    longitude: 72,
    fetchImpl: async () => response({}, 503),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.evidence[0].value, null)
  assert.equal(result.evidence[0].quality.sourceError.code, 'GDACS_HTTP_ERROR')
})
