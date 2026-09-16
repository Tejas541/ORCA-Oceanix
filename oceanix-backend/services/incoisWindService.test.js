import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchIncoisWind,
  INCOIS_OSF_PAGE_ENDPOINT,
} from './incoisWindService.js'

const page = `
  <script>
    var rsmc_combined_ww3 = "rsmc_combined_ww3_20260915.nc"
    var forecast_issue_date = "16/09/2026"
  </script>
`

const csv = `# Latitude: 17
# Longitude: 83
Time (UTC),Magnitude of wind (m/s) ()
2026-09-16T00:00:00.000Z,4.747726
2026-09-16T03:00:00.000Z,4.867981
`

function mockedFetch(responseCsv = csv) {
  return async (url) => new Response(
    url === INCOIS_OSF_PAGE_ENDPOINT ? page : responseCsv,
    { status: 200 }
  )
}

test('retrieves numerical forecast wind and creates canonical evidence', async () => {
  const result = await fetchIncoisWind({
    latitude: 17,
    longitude: 83,
    retrievedAt: '2026-09-16T07:00:00.000Z',
    fetchImpl: mockedFetch(),
  })

  assert.equal(result.status, 'available')
  assert.equal(result.isLive, false)
  assert.equal(result.data.windSpeed, 4.747726)
  assert.equal(result.data.unit, 'm/s')
  assert.equal(result.data.forecastTime, '2026-09-16T00:00:00.000Z')
  assert.deepEqual(result.location, [17, 83])
  assert.equal(result.provenance.sourceDataStatus, 'forecast')
  assert.equal(result.evidence.find((item) => item.parameter === 'windSpeed').value, 4.747726)
  assert.equal(result.evidence.find((item) => item.parameter === 'windSpeed').unit, 'm/s')
  assert.match(result.source.endpoint, /UWND%3AVWND-mag/)
})

test('discovers the current dataset and uses requested coordinates', async () => {
  const requests = []
  await fetchIncoisWind({
    latitude: 17,
    longitude: 83,
    fetchImpl: async (url) => {
      requests.push(url)
      return new Response(url === INCOIS_OSF_PAGE_ENDPOINT ? page : csv)
    },
  })

  assert.match(requests[1], /rsmc_combined_ww3_20260915\.nc/)
  assert.match(requests[1], /BBOX=83%2C17%2C83%2C17/)
  assert.match(requests[1], /QUERY_LAYERS=UWND%3AVWND-mag/)
})

test('invalid coordinates are rejected', async () => {
  await assert.rejects(
    () => fetchIncoisWind({
      latitude: 91,
      longitude: 83,
      fetchImpl: mockedFetch(),
    }),
    (error) => error.code === 'INVALID_COORDINATES' && error.status === 400
  )
})

test('malformed and non-numeric wind values remain unavailable', async () => {
  for (const responseCsv of [
    'Time (UTC),Magnitude of wind (m/s) ()\n2026-09-16T00:00:00Z,not-a-number',
    'Time (UTC),Other value ()\n2026-09-16T00:00:00Z,4.7',
    '',
  ]) {
    const result = await fetchIncoisWind({
      latitude: 17,
      longitude: 83,
      fetchImpl: mockedFetch(responseCsv),
    })
    assert.equal(result.status, 'unavailable')
    assert.equal(result.reason, 'wind_value_unavailable')
    assert.equal(result.data, null)
  }
})

test('upstream failure does not fall back to mockOcean', async () => {
  const result = await fetchIncoisWind({
    latitude: 17,
    longitude: 83,
    fetchImpl: async () => new Response('', { status: 503 }),
  })

  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'source_unavailable')
  assert.equal(result.data, null)
  assert.equal(result.evidence.find((item) => item.parameter === 'windSpeed').value, null)
})

test('wind-only evidence reaches ORCA and remains DATA_INSUFFICIENT', async () => {
  const result = await fetchIncoisWind({
    latitude: 17,
    longitude: 83,
    fetchImpl: mockedFetch(),
  })

  assert.equal(result.aggregation.availableParameters.includes('windSpeed'), true)
  assert.equal(result.decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(result.decision.safetyScore, null)
  assert.equal(result.decision.dataStatus.missingParameters.includes('waveHeight'), true)
})
