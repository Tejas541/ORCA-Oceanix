import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getMarineScenario,
  listMarineScenariosMap,
} from './marineDataService.js'

test('all mock scenarios expose an engine-derived canonical decision', () => {
  const scenarios = listMarineScenariosMap()

  for (const scenario of Object.values(scenarios)) {
    assert.ok(scenario.decision)
    assert.equal(typeof scenario.decision.safetyScore, 'number')
    assert.ok(['SAFE_FOR_VENTURE', 'CAUTION', 'HIGH_RISK', 'UNSAFE_NO_VENTURE'].includes(
      scenario.decision.riskLevel
    ))
    assert.equal(scenario.decision.dataStatus.status, 'simulated')
    assert.equal(scenario.decision.dataStatus.isLive, false)
    assert.equal(scenario.decision.evidence.length, 5)
  }
})

test('canonical Kochi decision is calculated from evidence, not mock risk score', () => {
  const scenario = getMarineScenario('kochi')

  assert.equal(scenario.risk.safetyScore, 74.2)
  assert.equal(scenario.decision.safetyScore, 79.5)
  assert.notEqual(scenario.decision.safetyScore, scenario.risk.safetyScore)
  assert.equal(scenario.decision.evidence.every((record) => record.status === 'simulated'), true)
})

test('canonical decisions exist for Chennai and Bay of Bengal', () => {
  const chennai = getMarineScenario('chennai')
  const bayOfBengal = getMarineScenario('bay-of-bengal')

  assert.equal(chennai.decision.safetyScore, 51.4)
  assert.equal(chennai.decision.riskLevel, 'CAUTION')
  assert.equal(bayOfBengal.decision.safetyScore, 9.2)
  assert.equal(bayOfBengal.decision.riskLevel, 'UNSAFE_NO_VENTURE')
})
