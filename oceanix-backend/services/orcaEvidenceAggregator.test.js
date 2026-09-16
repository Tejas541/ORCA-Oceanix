import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateEvidence,
} from '../../shared/orcaEvidenceAggregator.js'
import {
  createEvidenceRecord,
} from '../../shared/orcaEvidence.js'
import {
  evaluateOrcaDecision,
} from '../../shared/orcaDecisionEngine.js'

const REQUIRED = [
  'waveHeight',
  'windSpeed',
  'visibility',
  'lightningRiskPercent',
  'cyclone',
]

function evidenceRecord({
  parameter,
  value,
  provider = 'source-a',
  source = 'source-a',
  endpoint = '/observations',
  status = 'available',
  isLive = true,
  unit = parameter === 'waveHeight' ? 'm' : null,
  observationTime = '2026-09-15T00:00:00Z',
  forecastTime = null,
  retrievedAt = '2026-09-16T00:00:00Z',
  validation = 'valid',
  location = [9.9, 76.2],
} = {}) {
  return createEvidenceRecord({
    provider,
    source,
    endpoint,
    parameter,
    value,
    unit,
    location,
    observationTime,
    forecastTime,
    retrievedAt,
    status,
    isLive,
    validation,
  })
}

function completeEvidence(overrides = {}) {
  return REQUIRED.map((parameter) => evidenceRecord({
    parameter,
    value: parameter === 'cyclone'
      ? { active: false, category: '' }
      : 1,
    ...overrides[parameter],
  }))
}

function simulatedScenarioDecision({
  waveHeight,
  windSpeed,
  visibility,
  lightningRiskPercent,
  cyclone,
}) {
  const aggregated = aggregateEvidence(completeEvidence({
    waveHeight: { value: waveHeight, status: 'simulated', isLive: false, provider: 'mockOcean' },
    windSpeed: { value: windSpeed, status: 'simulated', isLive: false, provider: 'mockOcean' },
    visibility: { value: visibility, status: 'simulated', isLive: false, provider: 'mockOcean' },
    lightningRiskPercent: {
      value: lightningRiskPercent,
      status: 'simulated',
      isLive: false,
      provider: 'mockOcean',
    },
    cyclone: { value: cyclone, status: 'simulated', isLive: false, provider: 'mockOcean' },
  }))

  return {
    aggregated,
    decision: evaluateOrcaDecision({ evidence: aggregated.evidence }),
  }
}

test('single-source evidence produces one canonical record per parameter', () => {
  const result = aggregateEvidence(completeEvidence())

  assert.equal(result.evidence.length, REQUIRED.length)
  assert.deepEqual(
    result.evidence.map((record) => record.parameter),
    REQUIRED
  )
  assert.equal(result.aggregation.complete, true)
  assert.equal(result.aggregation.status, 'live')
})

test('multiple sources preserve all provenance', () => {
  const records = [
    evidenceRecord({ parameter: 'waveHeight', value: 1.8, provider: 'incois' }),
    evidenceRecord({ parameter: 'waveHeight', value: 1.8, provider: 'other-source' }),
  ]
  const result = aggregateEvidence(records)

  assert.equal(result.evidence.filter((record) => record.parameter === 'waveHeight').length, 1)
  assert.deepEqual(
    result.aggregation.provenance.byParameter.waveHeight.sort(),
    records.map((record) => record.evidenceId).sort()
  )
})

test('identical duplicate records collapse deterministically', () => {
  const record = evidenceRecord({ parameter: 'waveHeight', value: 1.8 })
  const first = aggregateEvidence([record, { ...record }])
  const second = aggregateEvidence([{ ...record }, record])

  assert.deepEqual(first, second)
  assert.deepEqual(first.aggregation.duplicateParameters, ['waveHeight'])
})

test('conflicting values become unusable without selecting a provider', () => {
  const records = [
    evidenceRecord({ parameter: 'waveHeight', value: 1.8, provider: 'incois' }),
    evidenceRecord({ parameter: 'waveHeight', value: 2.4, provider: 'other-source' }),
  ]
  const result = aggregateEvidence(records)
  const canonical = result.evidence.find((record) => record.parameter === 'waveHeight')

  assert.equal(canonical.status, 'unavailable')
  assert.equal(canonical.validation, 'conflict')
  assert.equal(result.aggregation.conflicts.length, 1)
  assert.deepEqual(
    result.aggregation.conflicts[0].evidenceIds.sort(),
    records.map((record) => record.evidenceId).sort()
  )
  assert.equal(result.aggregation.missingParameters.includes('waveHeight'), true)
})

test('missing evidence remains unavailable', () => {
  const result = aggregateEvidence([])
  const missing = result.evidence.find((record) => record.parameter === 'waveHeight')

  assert.equal(missing.status, 'unavailable')
  assert.equal(missing.validation, 'missing')
  assert.equal(result.aggregation.status, 'unavailable')
  assert.equal(result.aggregation.completeness, 0)
})

test('simulated evidence remains simulated and not live', () => {
  const result = aggregateEvidence(completeEvidence(
    Object.fromEntries(REQUIRED.map((parameter) => [
      parameter,
      { status: 'simulated', isLive: false, provider: 'mockOcean' },
    ]))
  ))

  assert.equal(result.aggregation.status, 'simulated')
  assert.equal(result.aggregation.sourceStatus, 'simulated')
  assert.equal(result.aggregation.isLive, false)
  assert.equal(result.evidence.every((record) => record.status === 'simulated'), true)
})

test('live evidence remains available and live', () => {
  const result = aggregateEvidence(completeEvidence())

  assert.equal(result.aggregation.status, 'live')
  assert.equal(result.aggregation.sourceStatus, 'live')
  assert.equal(result.aggregation.isLive, true)
  assert.equal(result.evidence.every((record) => record.status === 'available'), true)
})

test('mixed evidence is explicitly marked mixed', () => {
  const records = completeEvidence()
  records[0] = evidenceRecord({
    parameter: 'waveHeight',
    value: 1,
    status: 'simulated',
    isLive: false,
    provider: 'mockOcean',
  })
  const result = aggregateEvidence(records)

  assert.equal(result.aggregation.status, 'mixed')
  assert.equal(result.aggregation.sourceStatus, 'mixed')
  assert.equal(result.aggregation.isLive, false)
})

test('stale evidence remains stale and unusable', () => {
  const result = aggregateEvidence([
    evidenceRecord({
      parameter: 'waveHeight',
      value: 1.8,
      status: 'stale',
      isLive: false,
    }),
  ])
  const record = result.evidence.find((item) => item.parameter === 'waveHeight')

  assert.equal(record.status, 'stale')
  assert.equal(result.aggregation.missingParameters.includes('waveHeight'), true)
})

test('invalid evidence remains invalid and unusable', () => {
  const invalid = {
    ...evidenceRecord({
      parameter: 'waveHeight',
      value: null,
      status: 'unavailable',
      isLive: false,
      validation: 'invalid',
    }),
    status: 'invalid',
    validation: 'invalid',
  }
  const result = aggregateEvidence([
    invalid,
  ])
  const record = result.evidence.find((item) => item.parameter === 'waveHeight')

  assert.equal(record.status, 'invalid')
  assert.equal(record.validation, 'invalid')
  assert.equal(result.aggregation.missingParameters.includes('waveHeight'), true)
})

test('provenance fields are preserved', () => {
  const record = evidenceRecord({
    parameter: 'waveHeight',
    provider: 'incois',
    source: 'verified-wave-dataset',
    endpoint: '/griddap/verified-wave-dataset',
    unit: 'm',
    observationTime: '2026-09-15T00:00:00Z',
    forecastTime: '2026-09-16T00:00:00Z',
    retrievedAt: '2026-09-16T01:00:00Z',
    location: [9.93, 76.27],
  })
  const result = aggregateEvidence([record])
  const preserved = result.aggregation.provenance.records[0]

  for (const field of [
    'evidenceId',
    'provider',
    'source',
    'endpoint',
    'parameter',
    'value',
    'unit',
    'observationTime',
    'forecastTime',
    'retrievedAt',
    'status',
    'isLive',
    'validation',
    'quality',
  ]) {
    assert.deepEqual(preserved[field], record[field])
  }
  assert.deepEqual(preserved.location, record.location)
})

test('input order does not change canonical output or metadata', () => {
  const records = completeEvidence({
    waveHeight: { provider: 'z-source', value: 1.8 },
  })
  const reversed = [...records].reverse()

  assert.deepEqual(aggregateEvidence(records), aggregateEvidence(reversed))
})

test('conflict and missing evidence remain DATA_INSUFFICIENT', () => {
  const evidence = completeEvidence()
    .filter((record) => record.parameter !== 'visibility')
    .concat([
      evidenceRecord({ parameter: 'waveHeight', value: 2.4, provider: 'other-source' }),
    ])
  const aggregated = aggregateEvidence(evidence)
  const decision = evaluateOrcaDecision({ evidence: aggregated.evidence })

  assert.equal(decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(decision.safetyScore, null)
})

test('existing scenario fixtures retain canonical decisions through aggregation', () => {
  const scenarios = [
    {
      values: {
        waveHeight: 1.03,
        windSpeed: 14.9,
        visibility: 8,
        lightningRiskPercent: 24.9,
        cyclone: { active: false, category: 'Depression (sim.)' },
      },
      score: 79.5,
      riskLevel: 'SAFE_FOR_VENTURE',
    },
    {
      values: {
        waveHeight: 1.85,
        windSpeed: 18.4,
        visibility: 5,
        lightningRiskPercent: 41,
        cyclone: { active: true, category: 'Cyclonic Storm (sim.)' },
      },
      score: 51.4,
      riskLevel: 'CAUTION',
    },
    {
      values: {
        waveHeight: 3.4,
        windSpeed: 34,
        visibility: 2,
        lightningRiskPercent: 68,
        cyclone: { active: true, category: 'Severe Cyclonic Storm (sim.)' },
      },
      score: 9.2,
      riskLevel: 'UNSAFE_NO_VENTURE',
    },
  ]

  for (const scenario of scenarios) {
    const result = simulatedScenarioDecision(scenario.values)
    assert.equal(result.decision.safetyScore, scenario.score)
    assert.equal(result.decision.riskLevel, scenario.riskLevel)
    assert.equal(result.aggregated.aggregation.status, 'simulated')
    assert.equal(result.aggregated.evidence.length, 5)
  }
})
