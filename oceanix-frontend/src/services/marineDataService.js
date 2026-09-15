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

import { fetchIncoisWindObservation } from './incoisService.js'
import { DEFAULT_SCENARIO_ID, getScenario, scenarios as rawScenarios } from '../data/mockOcean.js'
import { normalizeMarineData } from '../utils/normalizeMarineData.js'
import { evaluateScenario } from '../../../shared/orcaDecisionEngine.js'

function buildCanonicalScenario(rawScenario) {
  const normalized = normalizeMarineData(rawScenario)
  return {
    ...normalized,
    decision: evaluateScenario(normalized),
  }
}

function buildNormalizedMap() {
  const map = {}
  for (const [id, raw] of Object.entries(rawScenarios)) {
    map[id] = buildCanonicalScenario(raw)
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
  return buildCanonicalScenario(getScenario(scenarioId))
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

/**
 * Convert metres per second to knots.
 *
 * 1 m/s = 1.943844 knots
 */
function metersPerSecondToKnots(value) {
  return Number(value) * 1.943844
}

/**
 * Get a normalized scenario enriched with a real INCOIS wind observation.
 *
 * Falls back to the existing normalized demo scenario when INCOIS
 * is unavailable.
 *
 * The existing ORCA windSpeed field uses knots, while INCOIS
 * ASCAT provides metres per second, so the external value is
 * converted before being placed into oceanConditions.windSpeed.
 *
 * @param {string} [scenarioId]
 * @returns {Promise<object>}
 */
export async function getMarineScenarioWithIncois(
    scenarioId = DEFAULT_SCENARIO_ID
) {
  const baseScenario = getMarineScenario(scenarioId)

  const coordinates =
      baseScenario?.harbour?.coordinates ??
      baseScenario?.coordinates

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return baseScenario
  }

  const [latitude, longitude] = coordinates

  const observation = await fetchIncoisWindObservation({
    latitude,
    longitude,
  })

  if (!observation) {
    return baseScenario
  }

  const windSpeedMps = Number(observation.windSpeedMps)

  if (!Number.isFinite(windSpeedMps)) {
    return baseScenario
  }

  const windSpeedKnots = metersPerSecondToKnots(windSpeedMps)

  return {
    ...baseScenario,

    oceanConditions: {
      ...baseScenario.oceanConditions,

      // ORCA's existing windSpeed field is in knots.
      windSpeed: windSpeedKnots,
    },

    externalData: {
      ...(baseScenario.externalData ?? {}),

      incois: {
        ...observation,
        windSpeedMps,
        windSpeedKnots,
      },
    },
  }
}