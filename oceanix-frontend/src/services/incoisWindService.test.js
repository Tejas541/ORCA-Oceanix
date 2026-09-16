import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchIncoisWind } from './incoisService.js'

test('frontend wind client consumes official forecast response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url) => {
        assert.match(url, /\/api\/incois\/wind\?/)
        return new Response(JSON.stringify({
            status: 'available',
            isLive: false,
            source: { provider: 'INCOIS' },
            provenance: { sourceDataStatus: 'forecast' },
            data: {
                windSpeed: 4.747726,
                unit: 'm/s',
                forecastTime: '2026-09-16T00:00:00.000Z',
            },
            evidence: [{ parameter: 'windSpeed', value: 4.747726 }],
            decision: {
                riskLevel: 'DATA_INSUFFICIENT',
                safetyScore: null,
            },
        }), { status: 200 })
    }

    try {
        const result = await fetchIncoisWind({ latitude: 17, longitude: 83 })
        assert.equal(result.data.windSpeed, 4.747726)
        assert.equal(result.data.unit, 'm/s')
        assert.equal(result.provenance.sourceDataStatus, 'forecast')
    } finally {
        globalThis.fetch = originalFetch
    }
})
