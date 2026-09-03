import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMarineData, ORCA_MARINE_SCHEMA_VERSION } from '../src/utils/normalizeMarineData.js'
import { kochiScenario } from '../src/data/mockOcean.js'
import { getMarineScenario } from '../src/services/marineDataService.js'

test('valid scenario produces correctly normalized output', () => {
  const result = normalizeMarineData(kochiScenario)

  assert.equal(result.schemaVersion, ORCA_MARINE_SCHEMA_VERSION)
  assert.equal(result.id, 'kochi')
  assert.equal(result.name, 'Kochi Fishing Harbour')
  assert.equal(result.label, 'Kochi Fishing Harbour')
  assert.equal(result.location, 'Arabian Sea — Southwest India')
  assert.equal(result.region, 'Arabian Sea — Southwest India')
  assert.deepEqual(result.coordinates, [9.9312, 76.2673])
  assert.deepEqual(result.harbour.coordinates, [9.9312, 76.2673])

  assert.equal(result.oceanConditions.waveHeight, 1.03)
  assert.equal(result.oceanConditions.windSpeed, 14.9)
  assert.equal(result.oceanConditions.visibility, 8)
  assert.equal(result.oceanParameters.sst, 27.72)
  assert.equal(result.oceanParameters.chlorophyll, 2.73)
  assert.equal(result.oceanParameters.currentSpeed, 0.45)

  assert.equal(result.ocean.waveHeight, 1.03)
  assert.equal(result.ocean.sst, 27.72)
  assert.equal(result.weather.windSpeed, 14.9)
  assert.equal(result.weather.visibility, 8)

  assert.equal(result.pfz.name, 'Alleppey Thermal Front / Off Kochi')
  assert.equal(result.pfz.additionalZones.length, 1)
  assert.equal(result.imbl.bufferNm, 15)
  assert.equal(result.cyclone.active, false)
  assert.equal(result.trawlerRoute.vesselId, 'BlueFin-01')
  assert.equal(result.vessel.vesselId, 'BlueFin-01')
  assert.equal(result.risk.safetyScore, 74.2)
  assert.equal(result.source.isLive, false)
  assert.equal(result.source.type, 'simulated')
})

test('missing optional fields are handled safely', () => {
  const result = normalizeMarineData({
    id: 'partial',
    label: 'Partial Harbour',
  })

  assert.equal(result.id, 'partial')
  assert.equal(result.name, 'Partial Harbour')
  assert.equal(result.oceanConditions.waveHeight, null)
  assert.equal(result.oceanParameters.sst, null)
  assert.equal(result.weather.visibility, null)
  assert.equal(result.cyclone.active, false)
  assert.deepEqual(result.cyclone.track, [])
  assert.deepEqual(result.pfz.additionalZones, [])
  assert.deepEqual(result.imbl.coordinates, [])
  assert.deepEqual(result.mpa.coordinates, [])
  assert.deepEqual(result.advisory.queryHints, [])
  assert.deepEqual(result.risk.riskFactors, [])
  assert.deepEqual(result.satelliteHealth, {})
  assert.equal(result.harbour.coordinates, null)
})

test('invalid numeric values are handled safely', () => {
  const result = normalizeMarineData({
    id: 'invalid-numbers',
    label: 'Invalid Numbers',
    oceanConditions: {
      waveHeight: 'not-a-number',
      windSpeed: Infinity,
      visibility: '',
      lightningRiskPercent: undefined,
    },
    oceanParameters: {
      sst: NaN,
      chlorophyll: 'abc',
      currentSpeed: {},
    },
    pfz: {
      coordinates: [10, 'bad'],
      radius: 'wide',
      additionalZones: [{ name: 'ok', coordinates: [11.1, 74.9], confidence: 'high' }],
    },
    harbour: {
      name: 'Test',
      coordinates: [9.9],
    },
  })

  assert.equal(result.oceanConditions.waveHeight, null)
  assert.equal(result.oceanConditions.windSpeed, null)
  assert.equal(result.oceanConditions.visibility, null)
  assert.equal(result.oceanConditions.lightningRiskPercent, null)
  assert.equal(result.oceanParameters.sst, null)
  assert.equal(result.oceanParameters.chlorophyll, null)
  assert.equal(result.oceanParameters.currentSpeed, null)
  assert.equal(result.pfz.coordinates, null)
  assert.equal(result.pfz.radius, null)
  assert.equal(result.pfz.additionalZones[0].confidence, null)
  assert.deepEqual(result.pfz.additionalZones[0].coordinates, [11.1, 74.9])
  assert.equal(result.harbour.coordinates, null)
})

test('existing Kochi scenario preserves expected key fields', () => {
  const result = normalizeMarineData(kochiScenario)
  const viaService = getMarineScenario('kochi')

  assert.equal(result.id, kochiScenario.id)
  assert.equal(result.label, kochiScenario.label)
  assert.equal(result.harbour.name, kochiScenario.harbour.name)
  assert.deepEqual(result.harbour.coordinates, kochiScenario.harbour.coordinates)
  assert.equal(result.oceanConditions.waveHeight, kochiScenario.oceanConditions.waveHeight)
  assert.equal(result.oceanConditions.windDirection, kochiScenario.oceanConditions.windDirection)
  assert.equal(result.oceanParameters.sst, kochiScenario.oceanParameters.sst)
  assert.equal(result.oceanParameters.chlorophyll, kochiScenario.oceanParameters.chlorophyll)
  assert.equal(result.risk.riskLevel, kochiScenario.risk.riskLevel)
  assert.equal(result.risk.ventureStatusLabel, kochiScenario.risk.ventureStatusLabel)
  assert.equal(result.pfz.targetSpecies, kochiScenario.pfz.targetSpecies)
  assert.equal(result.pfz.confidence, kochiScenario.pfz.confidence)
  assert.equal(result.imbl.distanceFromHarbourNm, kochiScenario.imbl.distanceFromHarbourNm)
  assert.equal(result.mpa.name, kochiScenario.mpa.name)
  assert.equal(result.cyclone.category, kochiScenario.cyclone.category)
  assert.equal(result.advisory.summaryEn, kochiScenario.advisory.summaryEn)
  assert.deepEqual(result.advisory.queryHints, kochiScenario.advisory.queryHints)
  assert.equal(result.meta.bulletinId, kochiScenario.meta.bulletinId)
  assert.equal(result.satelliteHealth.oceansat3.health, kochiScenario.satelliteHealth.oceansat3.health)

  assert.equal(viaService.id, result.id)
  assert.equal(viaService.oceanConditions.waveHeight, result.oceanConditions.waveHeight)
  assert.equal(viaService.pfz.name, result.pfz.name)
})
