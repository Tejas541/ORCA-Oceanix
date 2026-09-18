import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCanonicalCycloneEvidence,
  getGdacsCycloneDisplay,
} from './gdacsCycloneUi.js'

function evidence(value, overrides = {}) {
  return {
    parameter: 'cyclone',
    provider: 'GDACS',
    status: 'available',
    validation: 'valid',
    value,
    quality: { sourceDataStatus: 'event_status' },
    ...overrides,
  }
}

test('selects only canonical cyclone evidence from locationDecision', () => {
  const locationDecision = {
    evidence: [
      { parameter: 'waveHeight', value: 0.2 },
      evidence({ active: false, category: 'none' }),
    ],
  }

  assert.deepEqual(getCanonicalCycloneEvidence(locationDecision), locationDecision.evidence[1])
})

test('inactive canonical evidence renders no current relevant cyclone', () => {
  const result = getGdacsCycloneDisplay(evidence({ active: false, category: 'none' }))

  assert.deepEqual(result, {
    state: 'inactive',
    title: 'GDACS CYCLONE STATUS',
    message: 'No current relevant cyclone',
    provider: 'GDACS',
    status: 'Event status',
    eventName: null,
    category: null,
  })
})

test('active canonical evidence renders only event name and category', () => {
  const result = getGdacsCycloneDisplay(evidence({
    active: true,
    name: 'TEST-CYCLONE',
    category: 'Tropical Storm',
    radius: 999,
    riskPercent: 99,
  }))

  assert.deepEqual(result, {
    state: 'active',
    title: 'GDACS CYCLONE STATUS',
    message: null,
    provider: 'GDACS',
    status: 'Event status',
    eventName: 'TEST-CYCLONE',
    category: 'Tropical Storm',
  })
})

test('unavailable evidence does not become no cyclone', () => {
  const result = getGdacsCycloneDisplay(evidence(null, {
    status: 'unavailable',
    validation: 'missing',
  }))

  assert.equal(result.message, 'GDACS cyclone data unavailable')
  assert.equal(result.state, 'unavailable')
})

test('missing or malformed evidence is unavailable', () => {
  assert.equal(getGdacsCycloneDisplay(null).message, 'GDACS cyclone data unavailable')
  assert.equal(getGdacsCycloneDisplay(evidence({ active: 'false', category: 'none' })).state, 'unavailable')
  assert.equal(getGdacsCycloneDisplay(evidence({ active: true, category: '' })).state, 'unavailable')
})

test('selector does not read cyclone information from mockOcean scenario data', () => {
  const locationDecision = {
    evidence: [{ parameter: 'waveHeight', value: 0.2 }],
    scenario: { cyclone: { active: true, category: 'Severe Cyclonic Storm' } },
  }

  assert.equal(getCanonicalCycloneEvidence(locationDecision), null)
  assert.equal(getGdacsCycloneDisplay(null).message, 'GDACS cyclone data unavailable')
})
