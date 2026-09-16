import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createServer } from 'node:http'
import { createOrcaRouter } from './orcaRoutes.js'

async function withServer(router, callback) {
  const app = express()
  app.use('/api/orca', router)
  const server = createServer(app)

  await new Promise((resolve) => server.listen(0, resolve))
  const { port } = server.address()

  try {
    return await callback(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('INCOIS route returns the canonical ORCA response', async () => {
  const canonical = {
    source: { source: 'INCOIS ERDDAP' },
    evidence: [{ parameter: 'waveHeight', value: 1.8 }],
    aggregation: { status: 'partial' },
    decision: { riskLevel: 'DATA_INSUFFICIENT', safetyScore: null },
  }
  const requests = []

  await withServer(createOrcaRouter({
    getDecision: async (options) => {
      requests.push(options)
      return canonical
    },
  }), async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/orca/incois?latitude=9.9&longitude=76.2&time=2026-09-15T00%3A00%3A00Z`
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), canonical)
  })

  assert.deepEqual(requests, [{
    latitude: 9.9,
    longitude: 76.2,
    time: '2026-09-15T00:00:00Z',
  }])
})

test('INCOIS route returns the service-provided unavailable canonical response', async () => {
  const unavailable = {
    source: { source: 'INCOIS ERDDAP' },
    evidence: [],
    aggregation: {
      status: 'unavailable',
      sourceStatus: 'unavailable',
      isLive: false,
    },
    decision: {
      riskLevel: 'DATA_INSUFFICIENT',
      safetyScore: null,
    },
  }

  await withServer(createOrcaRouter({
    getDecision: async () => unavailable,
  }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/orca/incois?lat=9.9&lon=76.2`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.decision.riskLevel, 'DATA_INSUFFICIENT')
    assert.equal(body.decision.safetyScore, null)
    assert.equal(body.aggregation.sourceStatus, 'unavailable')
    assert.equal(body.evidence.length, 0)
  })
})
