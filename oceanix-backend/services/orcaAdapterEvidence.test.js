import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildIncoisEvidence,
  getIncoisOrcaDecision,
  mapIncoisLegacyWindToEvidence,
  mapIncoisMarineParametersToEvidence,
  metersPerSecondToKnots,
} from './orcaAdapterEvidence.js'

function marineParameters({
  waveValue = 1.8,
  waveDataStatus = 'nrt',
  topLevelIsLive = false,
  includeWave = true,
} = {}) {
  return {
    isLive: topLevelIsLive,
    status: includeWave ? 'ok' : 'unavailable',
    source: 'INCOIS ERDDAP',
    latitude: 9.9312,
    longitude: 76.2673,
    retrievedAt: '2026-09-16T01:00:00Z',
    parameters: includeWave
      ? {
        significantWaveHeight: {
          value: waveValue,
          unit: 'm',
          dataset: 'verified_wave_dataset',
          variable: 'hs',
          time: '2026-09-15T00:00:00Z',
          latitude: 9.93,
          longitude: 76.27,
          sourceUrl: 'https://erddap.incois.gov.in/erddap/griddap/verified_wave_dataset',
          retrievedAt: '2026-09-16T01:00:00Z',
          dataStatus: waveDataStatus,
        },
      }
      : {},
  }
}

function legacyWind() {
  return {
    source: 'INCOIS ERDDAP',
    sourceUrl: 'https://erddap.incois.gov.in/erddap/griddap/ascat_daily_datasets',
    fetchedAt: '2026-09-16T01:00:00Z',
    latitude: 9.9312,
    longitude: 76.2673,
    parameters: { windSpeed: 5 },
    units: { windSpeed: 'm/s' },
    unit: 'm/s',
    windSpeedMps: 5,
    dataStatus: 'historical_external',
    metadata: {
      observationTime: '2023-05-21T12:00:00Z',
      dataset: 'ascat_daily_datasets',
    },
    isLive: false,
  }
}

test('valid NRT INCOIS wave height maps to live canonical evidence', () => {
  const [record] = mapIncoisMarineParametersToEvidence(marineParameters({
    topLevelIsLive: false,
  }))

  assert.equal(record.parameter, 'waveHeight')
  assert.equal(record.value, 1.8)
  assert.equal(record.status, 'available')
  assert.equal(record.isLive, true)
  assert.equal(record.quality.sourceDataStatus, 'nrt')
})

test('historical wave height is preserved but cannot become live', () => {
  const [record] = mapIncoisMarineParametersToEvidence(marineParameters({
    waveDataStatus: 'historical',
    topLevelIsLive: true,
  }))

  assert.equal(record.value, 1.8)
  assert.equal(record.status, 'unavailable')
  assert.equal(record.isLive, false)
  assert.equal(record.quality.sourceDataStatus, 'historical')
})

test('historical legacy wind remains non-live and preserves provenance', () => {
  const observation = legacyWind()
  const record = mapIncoisLegacyWindToEvidence(observation)

  assert.equal(record.value, metersPerSecondToKnots(5))
  assert.equal(record.unit, 'knots')
  assert.equal(record.status, 'unavailable')
  assert.equal(record.isLive, false)
  assert.equal(record.provider, observation.source)
  assert.equal(record.endpoint, observation.sourceUrl)
  assert.equal(record.observationTime, observation.metadata.observationTime)
  assert.equal(record.retrievedAt, observation.fetchedAt)
  assert.equal(record.quality.sourceDataStatus, 'historical_external')
  assert.equal(record.quality.sourceUnit, 'm/s')
})

test('partial INCOIS response preserves unavailable wave evidence', () => {
  const [record] = mapIncoisMarineParametersToEvidence(marineParameters({
    includeWave: false,
  }))

  assert.equal(record.status, 'unavailable')
  assert.equal(record.validation, 'missing')
  assert.equal(record.quality.sourceDataStatus, 'unavailable')
})

test('unavailable INCOIS response does not substitute mock values', async () => {
  const result = await getIncoisOrcaDecision({
    marineParameters: {
      status: 'unavailable',
      isLive: false,
      source: 'INCOIS ERDDAP',
      parameters: {},
      errors: {
        significantWaveHeight: { code: 'INCOIS_HTTP_ERROR' },
      },
    },
  })

  assert.equal(result.decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(result.decision.safetyScore, null)
  assert.equal(result.aggregation.sourceStatus, 'unavailable')
  assert.equal(result.evidence.some((record) => record.value !== null), false)
})

test('invalid numeric value remains invalid', () => {
  const [record] = mapIncoisMarineParametersToEvidence(marineParameters({
    waveValue: 'not-a-number',
  }))

  assert.equal(record.status, 'unavailable')
  assert.equal(record.validation, 'invalid')
  assert.equal(record.value, null)
})

test('per-parameter dataStatus overrides top-level isLive', () => {
  const [record] = mapIncoisMarineParametersToEvidence(marineParameters({
    waveDataStatus: 'historical',
    topLevelIsLive: true,
  }))

  assert.equal(record.quality.sourceDataStatus, 'historical')
  assert.equal(record.isLive, false)
  assert.equal(record.status, 'unavailable')
})

test('supported mappings preserve source metadata and location', () => {
  const [record] = mapIncoisMarineParametersToEvidence(marineParameters())

  assert.equal(record.provider, 'INCOIS ERDDAP')
  assert.equal(record.source, 'verified_wave_dataset')
  assert.match(record.endpoint, /verified_wave_dataset/)
  assert.deepEqual(record.location, { latitude: 9.93, longitude: 76.27 })
  assert.equal(record.observationTime, '2026-09-15T00:00:00Z')
  assert.equal(record.retrievedAt, '2026-09-16T01:00:00Z')
  assert.equal(record.quality.sourceMetadata.dataset, 'verified_wave_dataset')
  assert.equal(record.quality.sourceMetadata.variable, 'hs')
})

test('orchestration aggregates evidence before making the decision', async () => {
  const result = await getIncoisOrcaDecision({
    marineParameters: marineParameters(),
    legacyWindObservation: legacyWind(),
  })

  assert.ok(result.evidence)
  assert.ok(result.aggregation)
  assert.ok(result.decision)
  assert.deepEqual(result.decision.evidence, result.evidence)
  assert.equal(result.decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(result.decision.safetyScore, null)
  assert.equal(result.aggregation.missingParameters.includes('windSpeed'), true)
})

test('incomplete adapter evidence fails closed without mock substitution', async () => {
  const result = await getIncoisOrcaDecision({
    marineParameters: marineParameters(),
  })

  assert.equal(result.decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(result.decision.safetyScore, null)
  assert.equal(result.aggregation.complete, false)
  assert.equal(result.evidence.length, 5)
})

test('buildIncoisEvidence combines only supported INCOIS parameters', () => {
  const evidence = buildIncoisEvidence({
    marineParameters: {
      ...marineParameters(),
      parameters: {
        ...marineParameters().parameters,
        sst: { value: 28.4 },
        surfaceCurrent: { speed: { value: 5 } },
      },
    },
  })

  assert.deepEqual(
    evidence.map((record) => record.parameter),
    ['waveHeight']
  )
})
