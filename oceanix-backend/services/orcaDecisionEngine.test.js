import test from 'node:test'
import assert from 'node:assert/strict'
import { createEvidenceRecord } from '../../shared/orcaEvidence.js'
import {
  evaluateOrcaDecision,
  evaluateScenario,
} from '../../shared/orcaDecisionEngine.js'

function evidenceFor({
  waveHeight = 0,
  windSpeed = 5,
  visibility = 10,
  lightningRiskPercent = 0,
  cyclone = { active: false, category: '' },
  isLive = true,
} = {}) {
  const values = [
    ['waveHeight', waveHeight, 'm'],
    ['windSpeed', windSpeed, 'knots'],
    ['visibility', visibility, 'NM'],
    ['lightningRiskPercent', lightningRiskPercent, '%'],
    ['cyclone', cyclone, null],
  ]
  return values.map(([parameter, value, unit]) => createEvidenceRecord({
    provider: isLive ? 'verified-source' : 'mockOcean.js',
    source: isLive ? 'verified-endpoint' : 'simulated-scenario',
    endpoint: '/test',
    parameter,
    value,
    unit,
    status: isLive ? 'available' : 'simulated',
    isLive,
  }))
}

test('safe conditions produce the canonical safe result', () => {
  const result = evaluateOrcaDecision({ evidence: evidenceFor() })
  assert.equal(result.safetyScore, 100)
  assert.equal(result.riskLevel, 'SAFE_FOR_VENTURE')
  assert.equal(result.dataStatus.status, 'live')
})

test('caution conditions use the existing thresholds', () => {
  const result = evaluateOrcaDecision({
    evidence: evidenceFor({
      waveHeight: 2,
      windSpeed: 20,
      visibility: 6,
      lightningRiskPercent: 20,
    }),
  })
  assert.equal(result.safetyScore, 67)
  assert.equal(result.riskLevel, 'CAUTION')
})

test('high-risk conditions use the existing thresholds', () => {
  const result = evaluateOrcaDecision({
    evidence: evidenceFor({
      waveHeight: 3,
      windSpeed: 25,
      visibility: 4,
      lightningRiskPercent: 60,
    }),
  })
  assert.equal(result.safetyScore, 47.6)
  assert.equal(result.riskLevel, 'HIGH_RISK')
})

test('no-venture conditions are classified below the existing threshold', () => {
  const result = evaluateOrcaDecision({
    evidence: evidenceFor({
      waveHeight: 4,
      windSpeed: 35,
      visibility: 2,
      lightningRiskPercent: 100,
    }),
  })
  assert.equal(result.riskLevel, 'UNSAFE_NO_VENTURE')
  assert.ok(result.safetyScore < 30)
})

test('severe active cyclone applies the existing score cap', () => {
  const result = evaluateOrcaDecision({
    evidence: evidenceFor({
      cyclone: { active: true, category: 'Severe Cyclonic Storm' },
    }),
  })
  assert.equal(result.safetyScore, 25)
  assert.equal(result.severeCycloneOverrideApplied, true)
})

for (const value of [null, undefined, Number.NaN, 'unknown', {}]) {
  test(`available numeric evidence rejects ${String(value)}`, () => {
    const evidence = evidenceFor().map((record) =>
      record.parameter === 'windSpeed'
        ? { ...record, value, status: 'available', validation: 'valid' }
        : record
    )
    const result = evaluateOrcaDecision({ evidence })
    const factor = result.riskFactors.find((item) => item.id === 'windSpeed')

    assert.equal(result.safetyScore, null)
    assert.equal(result.riskLevel, 'DATA_INSUFFICIENT')
    assert.equal(factor.available, false)
  })
}

test('duplicate required parameters fail closed instead of using the last record', () => {
  const evidence = [
    ...evidenceFor(),
    { ...evidenceFor()[0], value: 4 },
  ]
  const result = evaluateOrcaDecision({ evidence })

  assert.equal(result.safetyScore, null)
  assert.deepEqual(result.dataStatus.duplicateParameters, ['waveHeight'])
  assert.equal(result.riskFactors.find((item) => item.id === 'waveHeight').available, false)
})

test('complete mixed live and simulated evidence is explicitly marked mixed', () => {
  const evidence = evidenceFor().map((record, index) =>
    index === 0
      ? { ...record, status: 'simulated', isLive: false }
      : record
  )
  const result = evaluateOrcaDecision({ evidence })

  assert.equal(result.safetyScore, 100)
  assert.equal(result.dataStatus.status, 'mixed')
  assert.equal(result.dataStatus.sourceStatus, 'mixed')
  assert.equal(result.dataStatus.isLive, false)
})

test('malformed active cyclone evidence is unavailable', () => {
  const evidence = evidenceFor().map((record) =>
    record.parameter === 'cyclone'
      ? { ...record, value: { active: true, category: null }, status: 'available' }
      : record
  )
  const result = evaluateOrcaDecision({ evidence })
  const factor = result.riskFactors.find((item) => item.id === 'cyclone')

  assert.equal(result.safetyScore, null)
  assert.equal(factor.available, false)
})

test('exact safety thresholds retain the existing classifications', () => {
  const cases = [
    [{ waveHeight: 2, windSpeed: 20, visibility: 6, lightningRiskPercent: 0 }, 70, 'SAFE_FOR_VENTURE'],
    [{ waveHeight: 4, windSpeed: 20, visibility: 6, lightningRiskPercent: 50 }, 50, 'CAUTION'],
    [{ waveHeight: 4, windSpeed: 35, visibility: 2, lightningRiskPercent: 66.6666666667 }, 30, 'HIGH_RISK'],
  ]

  for (const [values, score, riskLevel] of cases) {
    const result = evaluateOrcaDecision({ evidence: evidenceFor(values) })
    assert.equal(result.safetyScore, score)
    assert.equal(result.riskLevel, riskLevel)
  }
})

for (const parameter of ['windSpeed', 'waveHeight', 'visibility', 'lightningRiskPercent', 'cyclone']) {
  test(`missing ${parameter} evidence is explicit and does not fabricate a score`, () => {
    const evidence = evidenceFor().filter((record) => record.parameter !== parameter)
    const result = evaluateOrcaDecision({ evidence })
    const factor = result.riskFactors.find((item) => item.id === parameter)

    assert.equal(result.safetyScore, null)
    assert.equal(result.dataStatus.status, 'partial')
    assert.equal(result.dataStatus.isLive, false)
    assert.equal(factor.available, false)
    assert.equal(factor.evidenceId, null)
    assert.equal(result.dataStatus.missingParameters.includes(parameter), true)
  })
}

test('partial evidence preserves provenance and simulated status', () => {
  const result = evaluateScenario({
    id: 'demo',
    meta: { source: 'simulated-edil-demo', isLive: false },
    harbour: { coordinates: [9.9, 76.2] },
    oceanConditions: {
      waveHeight: 1,
      windSpeed: 10,
      visibility: null,
      lightningRiskPercent: 10,
    },
    cyclone: { active: false, category: '' },
  })

  assert.equal(result.dataStatus.status, 'partial')
  assert.equal(result.dataStatus.simulatedEvidenceCount, 4)
  assert.equal(result.evidence[0].provider, 'simulated-edil-demo')
  assert.equal(result.evidence[0].isLive, false)
  assert.equal(result.evidence.find((item) => item.parameter === 'visibility').status, 'unavailable')
})
