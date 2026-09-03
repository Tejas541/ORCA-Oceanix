/**
 * Prototype deterministic marine safety score.
 *
 * This is a review-demo rule set, not a forecast or operational safety model.
 * It converts five scenario inputs into a weighted 0–100 risk score, then
 * returns Safety Index = 100 - risk score.
 *
 * Weights: wave height 25%, wind speed 20%, visibility 15%, lightning 15%,
 * and cyclone hazard 25%. A severe active cyclonic storm caps the Safety
 * Index at 25 because it is a no-venture condition in this prototype.
 *
 * Classification thresholds:
 * - 70–100: SAFE_FOR_VENTURE
 * - 50–69.9: CAUTION
 * - 30–49.9: HIGH_RISK
 * - 0–29.9: UNSAFE_NO_VENTURE
 */

const WEIGHTS = {
  waveHeight: 25,
  windSpeed: 20,
  visibility: 15,
  lightningRiskPercent: 15,
  cyclone: 25,
}

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))

function getCycloneRisk(active, category = '') {
  if (!active) return 0

  const normalizedCategory = category.toLowerCase()
  if (normalizedCategory.includes('severe')) return 100
  if (normalizedCategory.includes('cyclonic storm')) return 50
  if (normalizedCategory.includes('depression')) return 35
  return 50
}

function classifySafetyIndex(safetyIndex) {
  if (safetyIndex >= 70) {
    return { riskLevel: 'SAFE_FOR_VENTURE', ventureStatusLabel: 'SAFE FOR VENTURE' }
  }
  if (safetyIndex >= 50) {
    return { riskLevel: 'CAUTION', ventureStatusLabel: 'CAUTION — SHORT TRIPS ONLY' }
  }
  if (safetyIndex >= 30) {
    return { riskLevel: 'HIGH_RISK', ventureStatusLabel: 'HIGH RISK — AVOID VENTURE' }
  }
  return { riskLevel: 'UNSAFE_NO_VENTURE', ventureStatusLabel: 'NO VENTURE — HAZARD' }
}

export function calculateSafetyScore({
  waveHeight,
  windSpeed,
  visibility,
  lightningRiskPercent,
  cycloneActive = false,
  cycloneCategory = '',
}) {
  const normalizedRisks = {
    // 0 m is no wave risk; 4 m or more is maximum prototype risk.
    waveHeight: clamp((Number(waveHeight) / 4) * 100),
    // 5 kts or below is baseline; 35 kts or above is maximum prototype risk.
    windSpeed: clamp(((Number(windSpeed) - 5) / 30) * 100),
    // 10 NM or more is baseline visibility; 2 NM or less is maximum risk.
    visibility: clamp(((10 - Number(visibility)) / 8) * 100),
    lightningRiskPercent: clamp(Number(lightningRiskPercent)),
    cyclone: getCycloneRisk(cycloneActive, cycloneCategory),
  }

  const factors = Object.entries(WEIGHTS).map(([id, weight]) => {
    const normalizedRisk = normalizedRisks[id]
    return {
      id,
      weight,
      normalizedRisk: Number(normalizedRisk.toFixed(1)),
      weightedRisk: Number(((normalizedRisk * weight) / 100).toFixed(1)),
    }
  })

  const riskScore = Number(factors.reduce((total, factor) => total + factor.weightedRisk, 0).toFixed(1))
  const isSevereCyclone = cycloneActive && cycloneCategory.toLowerCase().includes('severe')
  const safetyIndex = Number(Math.min(100 - riskScore, isSevereCyclone ? 25 : 100).toFixed(1))

  return {
    safetyIndex,
    riskScore,
    ...classifySafetyIndex(safetyIndex),
    severeCycloneOverrideApplied: isSevereCyclone,
    factors,
  }
}

export function calculateSafetyScoreFromScenario(scenario) {
  const oceanConditions = scenario?.oceanConditions ?? {}
  const cyclone = scenario?.cyclone ?? {}
  return calculateSafetyScore({
    ...oceanConditions,
    cycloneActive: cyclone.active,
    cycloneCategory: cyclone.category,
  })
}
