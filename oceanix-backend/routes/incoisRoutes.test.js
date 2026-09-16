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

test('wave route validates coordinates and returns canonical wave response', async () => {
  const result = {
    status: 'available',
    source: { provider: 'INCOIS' },
    retrievedAt: '2026-09-16T07:00:00.000Z',
    location: [17, 83],
    data: {
      waveHeight: 0.8454,
      unit: 'm',
      forecastTime: '2026-09-16T00:00:00.000Z',
    },
    evidence: [{ parameter: 'waveHeight', value: 0.8454 }],
    aggregation: { availableParameters: ['waveHeight'] },
    decision: { riskLevel: 'DATA_INSUFFICIENT', safetyScore: null },
    provenance: { sourceDataStatus: 'forecast' },
  }
  const requests = []

  await withServer(createIncoisRouter({
    getWave: async (options) => {
      requests.push(options)
      return result
    },
  }), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/incois/wave?lat=17&lon=83&time=2026-09-16T00%3A00%3A00Z`
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), result)
  })

  assert.deepEqual(requests, [{
    latitude: 17,
    longitude: 83,
    time: '2026-09-16T00:00:00Z',
    timeStart: undefined,
    timeEnd: undefined,
  }])
})

test('wave route rejects missing coordinates', async () => {
  await withServer(createIncoisRouter({
    getWave: async () => {
      const error = new Error('Valid latitude and longitude are required')
      error.status = 400
      error.code = 'INVALID_COORDINATES'
      throw error
    },
  }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/incois/wave?lat=17`)
    const body = await response.json()
    assert.equal(response.status, 400)
    assert.equal(body.error.code, 'INVALID_COORDINATES')
  })
})

test('wind route returns the structured official forecast response', async () => {
  const result = {
    status: 'available',
    isLive: false,
    source: { provider: 'INCOIS' },
    retrievedAt: '2026-09-16T07:00:00.000Z',
    location: [17, 83],
    data: {
      windSpeed: 4.747726,
      unit: 'm/s',
      forecastTime: '2026-09-16T00:00:00.000Z',
    },
    evidence: [{ parameter: 'windSpeed', value: 4.747726 }],
    aggregation: { availableParameters: ['windSpeed'] },
    decision: { riskLevel: 'DATA_INSUFFICIENT', safetyScore: null },
    provenance: { sourceDataStatus: 'forecast' },
  }
  const requests = []

  await withServer(createIncoisRouter({
    getWind: async (options) => {
      requests.push(options)
      return result
    },
  }), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/incois/wind?lat=17&lon=83&time=2026-09-16T00%3A00%3A00Z`
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), result)
  })

  assert.deepEqual(requests, [{
    latitude: 17,
    longitude: 83,
    time: '2026-09-16T00:00:00Z',
    timeStart: undefined,
    timeEnd: undefined,
  }])
})
