import {
  buildScenarioEvidence,
  validateEvidenceValue,
} from './orcaEvidence.js'

export const ORCA_DECISION_POLICY = {
  weights: {
    waveHeight: 25,
    windSpeed: 20,
    visibility: 15,
    lightningRiskPercent: 15,
    cyclone: 25,
  },
  thresholds: {
    safe: 70,
    caution: 50,
    highRisk: 30,
  },
}

const REQUIRED_PARAMETERS = Object.keys(ORCA_DECISION_POLICY.weights)

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function classifySafetyIndex(safetyIndex) {
  if (safetyIndex >= ORCA_DECISION_POLICY.thresholds.safe) {
    return { riskLevel: 'SAFE_FOR_VENTURE', ventureStatusLabel: 'SAFE FOR VENTURE' }
  }
  if (safetyIndex >= ORCA_DECISION_POLICY.thresholds.caution) {
    return { riskLevel: 'CAUTION', ventureStatusLabel: 'CAUTION — SHORT TRIPS ONLY' }
  }
  if (safetyIndex >= ORCA_DECISION_POLICY.thresholds.highRisk) {
    return { riskLevel: 'HIGH_RISK', ventureStatusLabel: 'HIGH RISK — AVOID VENTURE' }
  }
  return { riskLevel: 'UNSAFE_NO_VENTURE', ventureStatusLabel: 'NO VENTURE — HAZARD' }
}

function evidenceMap(evidence) {
  const map = new Map()
  const duplicates = new Map()

  for (const record of Array.isArray(evidence) ? evidence : []) {
    if (!record?.parameter) continue
    if (map.has(record.parameter)) {
      const ids = duplicates.get(record.parameter) ?? [map.get(record.parameter).evidenceId]
      ids.push(record.evidenceId ?? null)
      duplicates.set(record.parameter, ids)
      continue
    }
    map.set(record.parameter, record)
  }

  return { map, duplicates }
}

function numericRisk(parameter, value) {
  if (parameter === 'waveHeight') return clamp((Number(value) / 4) * 100)
  if (parameter === 'windSpeed') return clamp(((Number(value) - 5) / 30) * 100)
  if (parameter === 'visibility') return clamp(((10 - Number(value)) / 8) * 100)
  if (parameter === 'lightningRiskPercent') return clamp(Number(value))
  return null
}

function cycloneRisk(value) {
  if (!value || typeof value !== 'object' || typeof value.active !== 'boolean') return null
  if (!value.active) return 0
  const category = String(value.category ?? '').toLowerCase()
  if (category.includes('severe')) return 100
  if (category.includes('cyclonic storm')) return 50
  if (category.includes('depression')) return 35
  return 50
}

function dataStatus(records) {
  const available = records.filter((record) =>
    (record.status === 'available' || record.status === 'simulated') &&
    record.validation !== 'invalid' &&
    record.validation !== 'missing' &&
    validateEvidenceValue(record.parameter, record.value).valid
  )
  const missing = records.filter((record) => !available.includes(record))
  const liveCount = available.filter((record) => record.isLive).length
  const simulatedCount = available.filter((record) => !record.isLive).length
  const sourceStatus = liveCount > 0 && simulatedCount > 0
    ? 'mixed'
    : liveCount > 0
      ? 'live'
      : simulatedCount > 0
        ? 'simulated'
        : 'unavailable'

  let status = 'unavailable'
  if (missing.length === 0) status = sourceStatus
  else if (available.length > 0) status = 'partial'

  return {
    status,
    sourceStatus,
    isLive: status === 'live',
    complete: missing.length === 0,
    completeness: Number((available.length / records.length).toFixed(3)),
    availableParameters: available.map((record) => record.parameter),
    missingParameters: missing.map((record) => record.parameter),
    liveEvidenceCount: liveCount,
    simulatedEvidenceCount: simulatedCount,
  }
}

function unavailableFactor(id, weight, record, reason = 'Required validated evidence is unavailable') {
  return {
    id,
    weight,
    available: false,
    evidenceId: record?.evidenceId ?? null,
    normalizedRisk: null,
    weightedRisk: null,
    status: record?.status ?? 'unavailable',
    reason,
  }
}

export function evaluateOrcaDecision({ evidence = [] } = {}) {
  const { map, duplicates } = evidenceMap(evidence)
  const records = REQUIRED_PARAMETERS.map((parameter) =>
    map.get(parameter) ?? {
      parameter,
      status: 'unavailable',
      isLive: false,
      value: null,
    }
  )
  const status = dataStatus(records)
  const duplicateParameters = [...duplicates.keys()]
    .filter((parameter) => REQUIRED_PARAMETERS.includes(parameter))
  if (duplicateParameters.length > 0) {
    status.status = 'partial'
    status.complete = false
    status.duplicateParameters = duplicateParameters
  }
  const factors = []
  let riskScore = 0
  let severeCycloneOverrideApplied = false

  for (const parameter of REQUIRED_PARAMETERS) {
    const weight = ORCA_DECISION_POLICY.weights[parameter]
    const record = records.find((item) => item.parameter === parameter)
    const normalizedRisk = parameter === 'cyclone'
      ? cycloneRisk(record.value)
      : numericRisk(parameter, record.value)
    const validation = validateEvidenceValue(parameter, record.value)

    if (
      duplicateParameters.includes(parameter) ||
      record.status !== 'available' && record.status !== 'simulated' ||
      record.validation && record.validation !== 'valid' ||
      !validation.valid ||
      normalizedRisk === null ||
      !Number.isFinite(normalizedRisk)
    ) {
      factors.push(unavailableFactor(parameter, weight, record, validation.reason))
      continue
    }

    const roundedRisk = Number(normalizedRisk.toFixed(1))
    const weightedRisk = Number(((normalizedRisk * weight) / 100).toFixed(1))
    riskScore += weightedRisk
    factors.push({
      id: parameter,
      weight,
      available: true,
      evidenceId: record.evidenceId ?? null,
      normalizedRisk: roundedRisk,
      weightedRisk,
      status: record.status,
      evidenceParameter: record.parameter,
    })

    if (parameter === 'cyclone') {
      severeCycloneOverrideApplied =
        record.value.active &&
        String(record.value.category).toLowerCase().includes('severe')
    }
  }

  if (!status.complete) {
    return {
      safetyScore: null,
      riskLevel: 'DATA_INSUFFICIENT',
      ventureStatusLabel: 'INSUFFICIENT DATA — DO NOT RELY',
      officialDirective: 'Do not make a venture decision until required evidence is available.',
      riskFactors: factors,
      evidence,
      dataStatus: status,
      severeCycloneOverrideApplied: false,
    }
  }

  const safetyScore = Number(Math.min(
    100 - riskScore,
    severeCycloneOverrideApplied ? 25 : 100
  ).toFixed(1))

  return {
    safetyScore,
    ...classifySafetyIndex(safetyScore),
    officialDirective: classifySafetyIndex(safetyScore).riskLevel === 'SAFE_FOR_VENTURE'
      ? 'Normal fishing and coastal navigation permitted subject to current official warnings.'
      : 'Review current official warnings and avoid unsafe operating conditions.',
    riskFactors: factors,
    evidence,
    dataStatus: status,
    severeCycloneOverrideApplied,
  }
}

export function evaluateScenario(scenario, options = {}) {
  const evidence = options.evidence ?? buildScenarioEvidence(scenario, options)
  return evaluateOrcaDecision({ evidence })
}
