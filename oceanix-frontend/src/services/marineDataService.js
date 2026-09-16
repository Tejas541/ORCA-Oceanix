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

import { fetchIncoisOrcaDecision } from './incoisService.js'
import { DEFAULT_SCENARIO_ID, getScenario, scenarios as rawScenarios } from '../data/mockOcean.js'
import { normalizeMarineData } from '../utils/normalizeMarineData.js'
import { evaluateOrcaDecision } from '../../../shared/orcaDecisionEngine.js'
import { buildScenarioEvidence } from '../../../shared/orcaEvidence.js'
import { aggregateEvidence } from '../../../shared/orcaEvidenceAggregator.js'

function buildCanonicalScenario(rawScenario) {
  const normalized = normalizeMarineData(rawScenario)
  const evidence = buildScenarioEvidence(normalized)
  const aggregated = aggregateEvidence(evidence)
  return {
    ...normalized,
    evidence: aggregated.evidence,
    evidenceAggregation: aggregated.aggregation,
    decision: evaluateOrcaDecision({ evidence: aggregated.evidence }),
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
 * Get the canonical ORCA response for an INCOIS-backed scenario.
 *
 * The backend owns live-source evidence creation, aggregation, and
 * decision evaluation. Backend failures are surfaced rather than replaced
 * with simulated scenario decisions.
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
  const canonical = await fetchIncoisOrcaDecision({
    latitude,
    longitude,
  })

  return {
    ...baseScenario,
    externalData: {
      ...(baseScenario.externalData ?? {}),
      incois: canonical.source,
    },
    evidence: canonical.evidence,
    evidenceAggregation: canonical.aggregation,
    decision: canonical.decision,
  }
}