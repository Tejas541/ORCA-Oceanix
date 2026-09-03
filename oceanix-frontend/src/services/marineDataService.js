/**
 * ORCA marine data service.
 *
 * UI and ScenarioContext should read marine data through this module
 * rather than importing mockOcean directly.
 *
 * CURRENT:
 *   marineDataService → mockOcean.js → normalizeMarineData → ORCA schema
 *
 * FUTURE (same exports, different source):
 *   marineDataService → real marine/weather/satellite APIs → normalizeMarineData → same ORCA schema
 *
 * No live fetches in this phase. All methods are synchronous and deterministic.
 */

import { DEFAULT_SCENARIO_ID, getScenario, scenarios as rawScenarios } from '../data/mockOcean.js'
import { normalizeMarineData } from '../utils/normalizeMarineData.js'

function buildNormalizedMap() {
  const map = {}
  for (const [id, raw] of Object.entries(rawScenarios)) {
    map[id] = normalizeMarineData(raw)
  }
  return map
}

const normalizedScenarios = buildNormalizedMap()

export function getDefaultScenarioId() {
  return DEFAULT_SCENARIO_ID
}

/**
 * @param {string} [scenarioId]
 * @returns {object} Normalized ORCA marine-data object
 */
export function getMarineScenario(scenarioId = DEFAULT_SCENARIO_ID) {
  if (Object.prototype.hasOwnProperty.call(normalizedScenarios, scenarioId)) {
    return normalizedScenarios[scenarioId]
  }
  return normalizeMarineData(getScenario(scenarioId))
}

/**
 * @returns {Record<string, object>} id → normalized scenario
 */
export function listMarineScenariosMap() {
  return normalizedScenarios
}

/**
 * @returns {object[]} Normalized scenarios
 */
export function listMarineScenarios() {
  return Object.values(normalizedScenarios)
}
