import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchIncoisPfz } from './incoisService.js'

test('frontend PFZ client consumes the backend official response without fallback', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url) => {
        assert.match(url, /\/api\/incois\/pfz$/)
        return new Response(JSON.stringify({
            status: 'available',
            isLive: false,
            source: { provider: 'INCOIS' },
            retrievedAt: '2026-09-16T06:00:00.000Z',
            advisoryDate: '2026-09-15',
            validUntil: null,
            sector: { states: ['MAHARASHTRA'], boundaries: ['3'] },
            data: { type: 'FeatureCollection', features: [] },
            provenance: { provider: 'INCOIS' },
        }), { status: 200 })
    }

    try {
        const result = await fetchIncoisPfz()
        assert.equal(result.status, 'available')
        assert.equal(result.isLive, false)
        assert.deepEqual(result.data, { type: 'FeatureCollection', features: [] })
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('frontend PFZ client preserves unavailable backend state', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
        status: 'unavailable',
        isLive: false,
        source: { provider: 'INCOIS' },
        provenance: { provider: 'INCOIS' },
        data: null,
        reason: 'source_unavailable',
    }), { status: 200 })

    try {
        const result = await fetchIncoisPfz()
        assert.equal(result.status, 'unavailable')
        assert.equal(result.data, null)
        assert.equal(result.reason, 'source_unavailable')
    } finally {
        globalThis.fetch = originalFetch
    }
})
