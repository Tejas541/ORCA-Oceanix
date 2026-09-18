import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildIncoisEvidence,
  getIncoisOrcaDecision,
  getLegacyIncoisOrcaDecision,
  mapIncoisLegacyWindToEvidence,
  mapIncoisMarineParametersToEvidence,
  metersPerSecondToKnots,
} from './orcaAdapterEvidence.js'
import { createEvidenceRecord } from '../../shared/orcaEvidence.js'

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

function osfResponse(parameter, value, status = 'available') {
  const isAvailable = status === 'available'
  const evidence = createEvidenceRecord({
    provider: 'INCOIS',
    source: 'INCOIS Ocean State Forecast',
    endpoint: `https://incois.test/${parameter}`,
    parameter,
    value: isAvailable ? value : null,
    unit: parameter === 'waveHeight' ? 'm' : 'm/s',
    location: [18.94527777777778, 72.94],
    forecastTime: '2026-09-18T00:00:00Z',
    retrievedAt: '2026-09-17T23:00:00Z',
    status,
    validation: isAvailable ? 'valid' : 'missing',
    quality: {
      coordinateRole: 'selected_operating_location',
      coordinatePolicy: 'direct_coordinate_request_no_snapping',
      sourceDataStatus: isAvailable ? 'forecast' : 'unavailable',
      dataset: 'osf_test_dataset',
      forecastIssueDate: '2026-09-17',
    },
  })
  return {
    source: { provider: 'INCOIS', name: 'INCOIS Ocean State Forecast' },
    provenance: {
      provider: 'INCOIS',
      coordinateRole: 'selected_operating_location',
      coordinatePolicy: 'direct_coordinate_request_no_snapping',
      sourceDataStatus: isAvailable ? 'forecast' : 'unavailable',
      forecastTime: '2026-09-18T00:00:00Z',
      retrievedAt: '2026-09-17T23:00:00Z',
      dataset: 'osf_test_dataset',
      forecastIssueDate: '2026-09-17',
    },
    evidence: [evidence],
  }
}

function weatherResponse({ visibility = 8500, lightningPotential = 12.5 } = {}) {
  return {
    source: { provider: 'Open-Meteo', name: 'Open-Meteo forecast' },
    provenance: {
      provider: 'Open-Meteo',
      sourceDataStatus: 'forecast',
      coordinateRole: 'selected_operating_location',
      coordinatePolicy: 'direct_coordinate_request_no_snapping',
      forecastTime: '2026-09-18T00:00',
    },
    evidence: [
      createEvidenceRecord({
        provider: 'Open-Meteo',
        source: 'Open-Meteo forecast',
        endpoint: 'https://api.open-meteo.com/v1/forecast',
        parameter: 'visibility',
        value: visibility,
        unit: 'm',
        location: [18.94527777777778, 72.94],
        forecastTime: '2026-09-18T00:00',
        status: 'available',
        isLive: false,
        quality: {
          sourceDataStatus: 'forecast',
          coordinateRole: 'selected_operating_location',
          coordinatePolicy: 'direct_coordinate_request_no_snapping',
        },
      }),
      createEvidenceRecord({
        provider: 'Open-Meteo',
        source: 'Open-Meteo forecast',
        endpoint: 'https://api.open-meteo.com/v1/forecast',
        parameter: 'lightningPotential',
        value: lightningPotential,
        unit: 'J/kg',
        location: [18.94527777777778, 72.94],
        forecastTime: '2026-09-18T00:00',
        status: 'available',
        isLive: false,
        quality: {
          sourceDataStatus: 'forecast',
          coordinateRole: 'selected_operating_location',
          coordinatePolicy: 'direct_coordinate_request_no_snapping',
          canonicalParameter: 'lightningRiskPercent',
          canonicalMapping: 'not_available_without_defensible_percentage_conversion',
        },
      }),
    ],
  }
}

function cycloneResponse() {
  return {
    source: { provider: 'GDACS', name: 'GDACS tropical cyclone events' },
    provenance: {
      provider: 'GDACS',
      sourceDataStatus: 'event_status',
      attribution: 'Global Disaster Awareness and Coordination System, GDACS',
    },
    evidence: [createEvidenceRecord({
      provider: 'GDACS',
      source: 'GDACS tropical cyclone events',
      endpoint: 'https://www.gdacs.org/gdacsapi/api/Events/geteventlist/SEARCH',
      parameter: 'cyclone',
      value: { active: false, category: 'none' },
      location: [18.94527777777778, 72.94],
      status: 'available',
      validation: 'valid',
      quality: {
        sourceDataStatus: 'event_status',
        attribution: 'Global Disaster Awareness and Coordination System, GDACS',
      },
    })],
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

test('legacy unavailable INCOIS response does not substitute mock values', async () => {
  const result = await getLegacyIncoisOrcaDecision({
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

test('legacy orchestration aggregates evidence before making the decision', async () => {
  const result = await getLegacyIncoisOrcaDecision({
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

test('legacy incomplete adapter evidence fails closed without mock substitution', async () => {
  const result = await getLegacyIncoisOrcaDecision({
    marineParameters: marineParameters(),
  })

  assert.equal(result.decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(result.decision.safetyScore, null)
  assert.equal(result.aggregation.complete, false)
  assert.deepEqual(
    result.evidence.map((record) => record.parameter),
    ['waveHeight', 'windSpeed', 'visibility', 'lightningRiskPercent', 'cyclone']
  )
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

test('ORCA combines OSF wave and wind evidence using one request context', async () => {
  const calls = []
  const requestContext = {
    latitude: 18.94527777777778,
    longitude: 72.94,
    coordinateRole: 'selected_operating_location',
    coordinatePolicy: 'direct_coordinate_request_no_snapping',
  }
  const result = await getIncoisOrcaDecision({
    ...requestContext,
    marineParameters: marineParameters({ includeWave: false }),
    getWave: async (request) => {
      calls.push(['wave', request])
      return osfResponse('waveHeight', 1.2345)
    },
    getWind: async (request) => {
      calls.push(['wind', request])
      return osfResponse('windSpeed', 2.3456)
    },
    getWeather: async (request) => {
      calls.push(['weather', request])
      return weatherResponse()
    },
    getCyclone: async (request) => {
      calls.push(['cyclone', request])
      return cycloneResponse()
    },
  })

  assert.deepEqual(calls[0][1], calls[1][1])
  assert.deepEqual(calls[0][1], calls[2][1])
  assert.deepEqual(calls[0][1], calls[3][1])
  assert.equal(calls[0][1].latitude, requestContext.latitude)
  assert.equal(calls[0][1].longitude, requestContext.longitude)
  assert.deepEqual(result.requestContext, {
    coordinateRole: requestContext.coordinateRole,
    coordinatePolicy: requestContext.coordinatePolicy,
  })
  assert.deepEqual(result.evidence
    .filter(({ parameter }) => ['waveHeight', 'windSpeed'].includes(parameter))
    .map(({ parameter, value }) => ({ parameter, value })), [
    { parameter: 'waveHeight', value: 1.2345 },
    { parameter: 'windSpeed', value: 2.3456 },
  ])
  assert.equal(result.decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(result.decision.safetyScore, null)
  assert.equal(result.provenance.wave.coordinateRole, requestContext.coordinateRole)
  assert.equal(result.provenance.wind.coordinatePolicy, requestContext.coordinatePolicy)
  assert.equal(result.provenance.weather.sourceDataStatus, 'forecast')
  assert.equal(result.evidence.find(({ parameter }) => parameter === 'visibility').value, 8500)
  assert.equal(result.evidence.find(({ parameter }) => parameter === 'lightningRiskPercent').value, null)
  assert.deepEqual(result.evidence.find(({ parameter }) => parameter === 'cyclone').value, {
    active: false,
    category: 'none',
  })
})

test('ORCA preserves partial and unavailable OSF evidence without fallback values', async () => {
  const cases = [
    ['wave available and wind unavailable', 'available', 'unavailable', 1.2, null],
    ['wave unavailable and wind available', 'unavailable', 'available', null, 2.3],
    ['wave and wind unavailable', 'unavailable', 'unavailable', null, null],
  ]

  for (const [name, waveStatus, windStatus, expectedWave, expectedWind] of cases) {
    await test(name, async () => {
      const result = await getIncoisOrcaDecision({
        latitude: 18.94527777777778,
        longitude: 72.94,
        coordinateRole: 'selected_operating_location',
        coordinatePolicy: 'direct_coordinate_request_no_snapping',
        getWave: async () => osfResponse('waveHeight', expectedWave, waveStatus),
        getWind: async () => osfResponse('windSpeed', expectedWind, windStatus),
        getWeather: async () => {
          throw Object.assign(new Error('Open-Meteo unavailable'), { code: 'OPEN_METEO_HTTP_ERROR' })
        },
        getCyclone: async () => {
          throw Object.assign(new Error('GDACS unavailable'), { code: 'GDACS_HTTP_ERROR' })
        },
      })

      assert.equal(result.evidence.find(({ parameter }) => parameter === 'waveHeight').value, expectedWave)
      assert.equal(result.evidence.find(({ parameter }) => parameter === 'windSpeed').value, expectedWind)
      assert.equal(result.decision.riskLevel, 'DATA_INSUFFICIENT')
      assert.equal(result.decision.safetyScore, null)
    })
  }
})

test('ORCA passes selected coordinates to PFZ and keeps PFZ supplemental', async () => {
  const calls = []
  const result = await getIncoisOrcaDecision({
    latitude: 18.94527777777778,
    longitude: 72.94,
    coordinateRole: 'selected_operating_location',
    coordinatePolicy: 'direct_coordinate_request_no_snapping',
    getWave: async () => osfResponse('waveHeight', 1.2),
    getWind: async () => osfResponse('windSpeed', 2.3),
    getPfz: async (request) => {
      calls.push(request)
      return {
        source: { provider: 'INCOIS', name: 'INCOIS PFZ WFS' },
        provenance: { coordinateRole: request.coordinateRole },
        evidence: [createEvidenceRecord({
          provider: 'INCOIS',
          source: 'INCOIS PFZ WFS',
          endpoint: 'https://incois.test/pfz',
          parameter: 'pfz',
          value: {
            geometryAvailable: true,
            spatialRelation: 'nearest_pfz_line',
            distanceKm: 12.345,
            nearestFeature: { uid: 'pfz-1', year: 2026, julianDay: 260 },
          },
          location: [18.94527777777778, 72.94],
          status: 'available',
          validation: 'valid',
          quality: { coordinateRole: request.coordinateRole },
        })],
      }
    },
    getWeather: async () => weatherResponse(),
    getCyclone: async () => cycloneResponse(),
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].latitude, 18.94527777777778)
  assert.equal(calls[0].longitude, 72.94)
  assert.equal(calls[0].coordinateRole, 'selected_operating_location')
  assert.equal(result.evidence.find(({ parameter }) => parameter === 'pfz').value.distanceKm, 12.345)
  assert.equal(result.aggregation.missingParameters.includes('pfz'), false)
  assert.equal(result.provenance.pfz.coordinateRole, 'selected_operating_location')
})

test('PFZ failure remains unavailable supplemental evidence and does not alter ORCA required parameters', async () => {
  const result = await getIncoisOrcaDecision({
    latitude: 18.94527777777778,
    longitude: 72.94,
    coordinateRole: 'selected_operating_location',
    coordinatePolicy: 'direct_coordinate_request_no_snapping',
    getWave: async () => osfResponse('waveHeight', 1.2),
    getWind: async () => osfResponse('windSpeed', 2.3),
    getPfz: async () => {
      throw Object.assign(new Error('PFZ timeout'), { code: 'PFZ_TIMEOUT' })
    },
    getWeather: async () => weatherResponse(),
    getCyclone: async () => cycloneResponse(),
  })

  const pfz = result.evidence.find(({ parameter }) => parameter === 'pfz')
  assert.equal(pfz.status, 'unavailable')
  assert.equal(pfz.value, null)
  assert.equal(result.aggregation.missingParameters.includes('pfz'), false)
  assert.deepEqual(result.aggregation.missingParameters, ['lightningRiskPercent'])
  assert.equal(result.decision.riskLevel, 'DATA_INSUFFICIENT')
  assert.equal(result.decision.evidence.some(({ parameter }) => parameter === 'pfz'), true)
})
