import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchIncoisWave,
  INCOIS_OSF_PAGE_ENDPOINT,
} from './incoisWaveService.js'

const page = `
  <script>
    var rsmc_combined_ww3 = "rsmc_combined_ww3_20260915.nc"
    var forecast_issue_date = "16/09/2026"
  </script>
`

const csv = `# Latitude: 17
# Longitude: 83
Time (UTC),Wave height (m) ()
2026-09-16T00:00:00.000Z,0.8454222679138184
`

test('retrieves numerical forecast SWH and preserves provenance', async () => {
  const requested = []
  const result = await fetchIncoisWave({
    latitude: 17,
    longitude: 83,
    retrievedAt: '2026-09-16T07:00:00.000Z',
    fetchImpl: async (url) => {
      requested.push(url)
      return new Response(
        url === INCOIS_OSF_PAGE_ENDPOINT ? page : csv,
        { status: 200 }
      )
    },
  })

  assert.equal(result.status, 'available')
  assert.equal(result.isLive, false)
  assert.equal(result.data.waveHeight, 0.8454222679138184)
  assert.equal(result.data.unit, 'm')
  assert.equal(result.data.forecastTime, '2026-09-16T00:00:00.000Z')
  assert.deepEqual(result.location, [17, 83])
  assert.equal(result.retrievedAt, '2026-09-16T07:00:00.000Z')
  assert.equal(result.provenance.sourceDataStatus, 'forecast')
  assert.equal(result.evidence[0].parameter, 'waveHeight')
  assert.equal(result.evidence[0].forecastTime, result.data.forecastTime)
  assert.equal(result.evidence[0].unit, 'm')
  assert.equal(requested.length, 2)
  assert.match(requested[1], /LAYERS=HS/)
  assert.match(requested[1], /INFO_FORMAT=text%2Fcsv/)
})

test('does not convert or fabricate the source value', async () => {
  const result = await fetchIncoisWave({
    latitude: 17,
    longitude: 83,
    fetchImpl: async (url) => new Response(
      url === INCOIS_OSF_PAGE_ENDPOINT
        ? page
        : '# Latitude: 17\nTime (UTC),Wave height (m) ()\n2026-09-16T00:00:00Z,not-a-number\n',
      { status: 200 }
    ),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'wave_value_unavailable')
  assert.equal(result.data, null)
  assert.equal(result.evidence[0].value, null)
})

test('missing wave values remain unavailable', async () => {
  const result = await fetchIncoisWave({
    latitude: 17,
    longitude: 83,
    fetchImpl: async (url) => new Response(
      url === INCOIS_OSF_PAGE_ENDPOINT
        ? page
        : '# Latitude: 17\nTime (UTC),Wave height (m) ()\n2026-09-16T00:00:00Z,null\n',
      { status: 200 }
    ),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'wave_value_unavailable')
})

test('upstream failures do not use mock fallback', async () => {
  const result = await fetchIncoisWave({
    latitude: 17,
    longitude: 83,
    fetchImpl: async () => new Response('', { status: 503 }),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'source_unavailable')
  assert.equal(result.data, null)
  assert.equal(result.evidence[0].value, null)
})

test('invalid coordinates are rejected', async () => {
  await assert.rejects(
    () => fetchIncoisWave({
      latitude: 91,
      longitude: 83,
      fetchImpl: async () => new Response(page),
    }),
    (error) => error.code === 'INVALID_COORDINATES' && error.status === 400
  )
})

test('forecast evidence reaches ORCA but remains DATA_INSUFFICIENT alone', async () => {
  const result = await fetchIncoisWave({
    latitude: 17,
    longitude: 83,
    fetchImpl: async (url) => new Response(
      url === INCOIS_OSF_PAGE_ENDPOINT ? page : csv,
      { status: 200 }
    ),
  })

  assert.equal(result.aggregation.availableParameters.includes('waveHeight'), true)
  assert.equal(result.decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(result.decision.safetyScore, null)
  assert.equal(result.decision.dataStatus.missingParameters.includes('windSpeed'), true)
})
