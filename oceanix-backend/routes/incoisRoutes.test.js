import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createServer } from 'node:http'
import { createIncoisRouter } from './incoisRoutes.js'

async function withServer(router, callback) {
  const app = express()
  app.use('/api/incois', router)
  const server = createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  const { port } = server.address()

  try {
    return await callback(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    )
  }
}

test('PFZ route returns structured official data', async () => {
  const result = {
    status: 'available',
    isLive: false,
    source: { provider: 'INCOIS' },
    retrievedAt: '2026-09-16T06:00:00.000Z',
    advisoryDate: '2026-09-15',
    validUntil: null,
    sector: { states: ['MAHARASHTRA'], boundaries: ['3'] },
    data: { type: 'FeatureCollection', features: [] },
    provenance: { provider: 'INCOIS' },
  }

  await withServer(createIncoisRouter({
    getPfz: async () => result,
  }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/incois/pfz`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), result)
  })
})

test('PFZ route preserves unavailable status', async () => {
  await withServer(createIncoisRouter({
    getPfz: async () => ({
      status: 'unavailable',
      isLive: false,
      reason: 'source_unavailable',
      data: null,
    }),
  }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/incois/pfz`)
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.status, 'unavailable')
    assert.equal(body.data, null)
  })
})
