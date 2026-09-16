import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateEvidenceFreshness,
  classifyEvidenceFreshness,
  EVIDENCE_FRESHNESS_STATES,
} from './orcaEvidenceFreshness.js'

const NOW = '2026-09-16T12:00:00.000Z'

test('observation timestamp calculates deterministic age with an injected clock', () => {
  const result = calculateEvidenceFreshness({
    observationTime: '2026-09-16T10:00:00.000Z',
  }, { now: NOW })

  assert.equal(result.state, EVIDENCE_FRESHNESS_STATES.CURRENT)
  assert.equal(result.ageMs, 2 * 60 * 60 * 1000)
  assert.equal(result.timestampField, 'observationTime')
  assert.equal(result.timestampSource, 'observationTime')
})

test('forecast timestamp is classified as forecast and calculates age', () => {
  const result = classifyEvidenceFreshness({
    forecastTime: '2026-09-16T15:00:00.000Z',
  }, { now: NOW })

  assert.equal(result.state, EVIDENCE_FRESHNESS_STATES.FORECAST)
  assert.equal(result.ageMs, -3 * 60 * 60 * 1000)
  assert.equal(result.isFuture, true)
  assert.equal(result.timestampField, 'forecastTime')
})

test('historical source status is preserved as historical freshness metadata', () => {
  const evidence = {
    observationTime: '2023-05-21T12:00:00.000Z',
    status: 'unavailable',
    isLive: false,
    quality: {
      sourceDataStatus: 'historical_external',
    },
  }
  const result = calculateEvidenceFreshness(evidence, { now: NOW })

  assert.equal(result.state, EVIDENCE_FRESHNESS_STATES.HISTORICAL)
  assert.equal(result.sourceDataStatus, 'historical_external')
  assert.equal(evidence.quality.sourceDataStatus, 'historical_external')
})

test('missing timestamps produce UNKNOWN without an age', () => {
  const result = calculateEvidenceFreshness({}, { now: NOW })

  assert.equal(result.state, EVIDENCE_FRESHNESS_STATES.UNKNOWN)
  assert.equal(result.ageMs, null)
  assert.equal(result.timestampSource, null)
})

test('invalid timestamps produce UNKNOWN and do not fall back silently', () => {
  const result = calculateEvidenceFreshness({
    observationTime: 'not-a-timestamp',
    retrievedAt: '2026-09-16T11:00:00.000Z',
  }, { now: NOW })

  assert.equal(result.state, EVIDENCE_FRESHNESS_STATES.UNKNOWN)
  assert.equal(result.ageMs, null)
  assert.equal(result.invalidTimestamp, 'observationTime')
})

test('retrievedAt is an explicit fallback when observation and forecast times are absent', () => {
  const result = calculateEvidenceFreshness({
    retrievedAt: '2026-09-16T11:30:00.000Z',
  }, { now: NOW })

  assert.equal(result.state, EVIDENCE_FRESHNESS_STATES.CURRENT)
  assert.equal(result.ageMs, 30 * 60 * 1000)
  assert.equal(result.timestampField, 'retrievedAt')
  assert.equal(result.timestampSource, 'retrievedAt')
})

test('the same injected clock produces identical results', () => {
  const evidence = {
    observationTime: '2026-09-16T11:00:00.000Z',
  }

  assert.deepEqual(
    calculateEvidenceFreshness(evidence, { now: () => NOW }),
    calculateEvidenceFreshness(evidence, { now: () => NOW })
  )
})

test('future observation timestamps are classified as forecast', () => {
  const result = calculateEvidenceFreshness({
    observationTime: '2026-09-17T00:00:00.000Z',
  }, { now: NOW })

  assert.equal(result.state, EVIDENCE_FRESHNESS_STATES.FORECAST)
  assert.equal(result.isFuture, true)
  assert.ok(result.ageMs < 0)
})

test('stale evidence remains stale and non-policy metadata is not changed', () => {
  const evidence = {
    observationTime: '2026-09-16T10:00:00.000Z',
    retrievedAt: '2026-09-16T11:00:00.000Z',
    status: 'stale',
    isLive: false,
    quality: {
      sourceDataStatus: 'historical',
    },
  }
  const before = structuredClone(evidence)
  const result = calculateEvidenceFreshness(evidence, { now: NOW })

  assert.equal(result.state, EVIDENCE_FRESHNESS_STATES.STALE)
  assert.deepEqual(evidence, before)
})

test('existing adapter status remains preserved', () => {
  const evidence = {
    observationTime: '2026-09-15T00:00:00.000Z',
    status: 'unavailable',
    isLive: false,
    quality: {
      sourceDataStatus: 'forecast',
    },
  }
  const result = calculateEvidenceFreshness(evidence, { now: NOW })

  assert.equal(result.state, EVIDENCE_FRESHNESS_STATES.FORECAST)
  assert.equal(evidence.status, 'unavailable')
  assert.equal(evidence.isLive, false)
  assert.equal(evidence.quality.sourceDataStatus, 'forecast')
})
