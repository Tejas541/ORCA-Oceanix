import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSafetyScore } from '../src/utils/safetyScore.js'

test('benign conditions produce a high safety index', () => {
  const result = calculateSafetyScore({
    waveHeight: 0.5,
    windSpeed: 5,
    visibility: 12,
    lightningRiskPercent: 0,
  })

  assert.equal(result.riskLevel, 'SAFE_FOR_VENTURE')
  assert.ok(result.safetyIndex >= 90)
})

test('severe wave and wind conditions produce a low safety index', () => {
  const result = calculateSafetyScore({
    waveHeight: 4,
    windSpeed: 35,
    visibility: 2,
    lightningRiskPercent: 80,
  })

  assert.equal(result.riskLevel, 'UNSAFE_NO_VENTURE')
  assert.ok(result.safetyIndex < 30)
})

test('poor visibility lowers the safety index', () => {
  const clearConditions = calculateSafetyScore({
    waveHeight: 1,
    windSpeed: 10,
    visibility: 10,
    lightningRiskPercent: 10,
  })
  const poorVisibility = calculateSafetyScore({
    waveHeight: 1,
    windSpeed: 10,
    visibility: 2,
    lightningRiskPercent: 10,
  })

  assert.ok(poorVisibility.safetyIndex < clearConditions.safetyIndex)
})

test('a severe active cyclone applies the no-venture safety cap', () => {
  const result = calculateSafetyScore({
    waveHeight: 0.5,
    windSpeed: 5,
    visibility: 12,
    lightningRiskPercent: 0,
    cycloneActive: true,
    cycloneCategory: 'Severe Cyclonic Storm (sim.)',
  })

  assert.equal(result.safetyIndex, 25)
  assert.equal(result.riskLevel, 'UNSAFE_NO_VENTURE')
  assert.equal(result.severeCycloneOverrideApplied, true)
})

test('classification changes at the documented safety boundaries', () => {
  const safe = calculateSafetyScore({ waveHeight: 1.8, windSpeed: 13, visibility: 10, lightningRiskPercent: 0 })
  const caution = calculateSafetyScore({ waveHeight: 2.6, windSpeed: 20, visibility: 5, lightningRiskPercent: 30 })
  const highRisk = calculateSafetyScore({ waveHeight: 3.2, windSpeed: 28, visibility: 3, lightningRiskPercent: 50 })

  assert.equal(safe.riskLevel, 'SAFE_FOR_VENTURE')
  assert.equal(caution.riskLevel, 'CAUTION')
  assert.equal(highRisk.riskLevel, 'HIGH_RISK')
})
