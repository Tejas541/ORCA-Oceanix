import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchIncoisWave } from './incoisService.js'

test('frontend wave client consumes canonical forecast evidence', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url) => {
        assert.match(url, /\/api\/incois\/wave\?/)
        return new Response(JSON.stringify({
            status: 'available',
            source: { provider: 'INCOIS' },
            retrievedAt: '2026-09-16T07:00:00.000Z',
            data: {
                waveHeight: 0.8454,
                unit: 'm',
                forecastTime: '2026-09-16T00:00:00.000Z',
            },
            evidence: [{ parameter: 'waveHeight', value: 0.8454 }],
            provenance: { sourceDataStatus: 'forecast' },
            decision: {
                riskLevel: 'DATA_INSUFFICIENT',
                safetyScore: null,
            },
        }), { status: 200 })
    }

    try {
        const result = await fetchIncoisWave({ latitude: 17, longitude: 83 })
        assert.equal(result.data.waveHeight, 0.8454)
        assert.equal(result.data.unit, 'm')
        assert.equal(result.provenance.sourceDataStatus, 'forecast')
    } finally {
        globalThis.fetch = originalFetch
    }
})
