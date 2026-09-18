import test from 'node:test'
import assert from 'node:assert/strict'
import {
    fetchOpenMeteoForecast,
    OPEN_METEO_ENDPOINT,
} from './openMeteoService.js'

const payload = {
    latitude: 18.9453,
    longitude: 72.94,
    timezone: 'GMT',
    model: 'icon_seamless',
    generationtime_ms: 0.42,
    hourly_units: { visibility: 'm' },
    hourly: {
        time: ['2026-09-18T00:00', '2026-09-18T01:00'],
        visibility: [8500, 9100],
    },
    minutely_15_units: { lightning_potential: 'J/kg' },
    minutely_15: {
        time: ['2026-09-18T00:00', '2026-09-18T00:15'],
        lightning_potential: [12.5, 14.2],
    },
}

function response(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

test('rejects invalid latitude', async () => {
    await assert.rejects(
        () => fetchOpenMeteoForecast({ latitude: 91, longitude: 72 }),
        (error) => error.code === 'INVALID_COORDINATES' && error.status === 400,
    )
})

test('rejects invalid longitude', async () => {
    await assert.rejects(
        () => fetchOpenMeteoForecast({ latitude: 18, longitude: 181 }),
        (error) => error.code === 'INVALID_COORDINATES' && error.status === 400,
    )
})

test('normalizes forecast visibility and preserves raw lightning potential', async () => {
    const requested = []
    const result = await fetchOpenMeteoForecast({
        latitude: 18.9453,
        longitude: 72.94,
        retrievedAt: '2026-09-17T23:00:00Z',
        coordinateRole: 'selected_operating_location',
        coordinatePolicy: 'direct_coordinate_request_no_snapping',
        fetchImpl: async (url, options) => {
            requested.push([url, options])
            return response(payload)
        },
    })

    assert.match(requested[0][0], new RegExp(`${OPEN_METEO_ENDPOINT.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`))
    assert.equal(requested[0][1].signal instanceof AbortSignal, true)
    assert.equal(result.status, 'available')
    assert.equal(result.isLive, false)
    assert.deepEqual(result.location, [18.9453, 72.94])
    assert.equal(result.data.visibility, 8500)
    assert.equal(result.data.visibilityUnit, 'm')
    assert.equal(result.data.visibilityForecastTime, '2026-09-18T00:00')
    assert.equal(result.data.lightningPotential, 12.5)
    assert.equal(result.data.lightningPotentialUnit, 'J/kg')
    assert.equal(result.evidence.find((record) => record.parameter === 'visibility').value, 8500)
    const lightning = result.evidence.find((record) => record.parameter === 'lightningPotential')
    assert.equal(lightning.value, 12.5)
    assert.equal(lightning.isLive, false)
    assert.equal(lightning.quality.sourceDataStatus, 'forecast')
    assert.equal(lightning.quality.canonicalParameter, 'lightningRiskPercent')
    assert.equal(lightning.quality.canonicalMapping, 'not_available_without_defensible_percentage_conversion')
    assert.equal(result.provenance.forecastTime, '2026-09-18T00:00')
    assert.equal(result.provenance.coordinateRole, 'selected_operating_location')
    assert.equal(result.retrievedAt, '2026-09-17T23:00:00Z')
})

test('selects the requested forecast time exactly', async () => {
    const result = await fetchOpenMeteoForecast({
        latitude: 18,
        longitude: 72,
        time: '2026-09-18T00:15:00Z',
        fetchImpl: async () => response(payload),
    })

    assert.equal(result.data.visibility, null)
    assert.equal(result.data.lightningPotential, 14.2)
    assert.equal(result.data.lightningPotentialForecastTime, '2026-09-18T00:15')
})

test('returns unavailable evidence for an HTTP failure', async () => {
    const result = await fetchOpenMeteoForecast({
        latitude: 18,
        longitude: 72,
        fetchImpl: async () => response({}, 503),
    })

    assert.equal(result.status, 'unavailable')
    assert.equal(result.isLive, false)
    assert.equal(result.evidence.find((record) => record.parameter === 'visibility').value, null)
    assert.equal(result.evidence.find((record) => record.parameter === 'lightningPotential').value, null)
    assert.equal(result.evidence[0].quality.sourceDataStatus, 'unavailable')
})

test('returns unavailable evidence for a malformed response', async () => {
    const result = await fetchOpenMeteoForecast({
        latitude: 18,
        longitude: 72,
        fetchImpl: async () => new Response('{bad-json', { status: 200 }),
    })

    assert.equal(result.status, 'unavailable')
    assert.equal(result.evidence.every((record) => record.value === null), true)
})
