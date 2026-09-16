import {
  ORCA_DECISION_POLICY,
} from './orcaDecisionEngine.js'
import { validateEvidenceValue } from './orcaEvidence.js'

const DEFAULT_REQUIRED_PARAMETERS = Object.keys(ORCA_DECISION_POLICY.weights)
const USABLE_STATUSES = new Set(['available', 'simulated'])

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableClone(value[key])])
    )
  }
  return value
}

function stableSerialize(value) {
  return JSON.stringify(stableClone(value))
}

function parameterOrder(parameters, requiredParameters) {
  const required = new Set(requiredParameters)
  return [...parameters].sort((left, right) => {
    const leftIndex = requiredParameters.indexOf(left)
    const rightIndex = requiredParameters.indexOf(right)
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
    }
    if (required.has(left) !== required.has(right)) {
      return required.has(left) ? -1 : 1
    }
    return left.localeCompare(right)
  })
}

function recordSortKey(record) {
  return stableSerialize(record)
}

function isUsable(record) {
  return USABLE_STATUSES.has(record?.status) &&
    record?.validation !== 'invalid' &&
    record?.validation !== 'missing' &&
    validateEvidenceValue(record?.parameter, record?.value).valid
}

function comparableValue(record) {
  return stableSerialize({
    parameter: record.parameter,
    unit: record.unit ?? null,
    value: record.value,
  })
}

function unavailableRecord(parameter, reason) {
  return {
    evidenceId: null,
    provider: null,
    source: null,
    endpoint: null,
    parameter,
    value: null,
    unit: null,
    location: null,
    observationTime: null,
    forecastTime: null,
    retrievedAt: null,
    status: 'unavailable',
    isLive: false,
    validation: reason,
    quality: {
      completeness: 0,
    },
  }
}

function conflictRecord(parameter) {
  return unavailableRecord(parameter, 'conflict')
}

function sourceStatus(records) {
  const usable = records.filter(isUsable)
  const liveCount = usable.filter((record) => record.isLive).length
  const simulatedCount = usable.length - liveCount

  if (liveCount > 0 && simulatedCount > 0) return 'mixed'
  if (liveCount > 0) return 'live'
  if (simulatedCount > 0) return 'simulated'
  return 'unavailable'
}

function provenanceFor(records) {
  const sorted = [...records].sort((left, right) =>
    recordSortKey(left).localeCompare(recordSortKey(right))
  )

  return {
    records: sorted.map(stableClone),
    byParameter: Object.fromEntries(
      [...new Set(sorted.map((record) => record?.parameter).filter(Boolean))]
        .sort()
        .map((parameter) => [
          parameter,
          sorted
            .filter((record) => record.parameter === parameter)
            .map((record) => record.evidenceId ?? null),
        ])
    ),
  }
}

function aggregateParameter(parameter, records) {
  const sorted = [...records].sort((left, right) =>
    recordSortKey(left).localeCompare(recordSortKey(right))
  )
  const usable = sorted.filter(isUsable)
  const candidateGroups = new Map()

  for (const record of usable) {
    const key = comparableValue(record)
    const group = candidateGroups.get(key) ?? []
    group.push(record)
    candidateGroups.set(key, group)
  }

  const candidateValues = [...candidateGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))

  if (candidateValues.length > 1) {
    return {
      canonical: conflictRecord(parameter),
      duplicate: false,
      conflict: {
        parameter,
        evidenceIds: usable.map((record) => record.evidenceId ?? null),
        candidates: candidateValues.map(([, candidates]) => ({
          evidenceIds: candidates.map((record) => record.evidenceId ?? null),
          unit: candidates[0].unit ?? null,
          value: stableClone(candidates[0].value),
        })),
      },
    }
  }

  if (candidateValues.length === 1) {
    const [, candidates] = candidateValues[0]
    return {
      canonical: stableClone(candidates[0]),
      duplicate: candidates.length > 1,
      conflict: null,
    }
  }

  return {
    canonical: sorted.length > 0
      ? stableClone(sorted[0])
      : unavailableRecord(parameter, 'missing'),
    duplicate: false,
    conflict: null,
  }
}

export function aggregateEvidence(
  records = [],
  { requiredParameters = DEFAULT_REQUIRED_PARAMETERS } = {}
) {
  const input = Array.isArray(records)
    ? records.filter((record) => record && typeof record === 'object')
    : []
  const groups = new Map()

  for (const record of input) {
    if (!record.parameter) continue
    const group = groups.get(record.parameter) ?? []
    group.push(record)
    groups.set(record.parameter, group)
  }

  const parameters = parameterOrder(
    new Set([...groups.keys(), ...requiredParameters]),
    requiredParameters
  )
  const canonicalEvidence = []
  const duplicateParameters = []
  const conflicts = []

  for (const parameter of parameters) {
    const result = aggregateParameter(parameter, groups.get(parameter) ?? [])
    canonicalEvidence.push(result.canonical)
    if (result.duplicate) duplicateParameters.push(parameter)
    if (result.conflict) conflicts.push(result.conflict)
  }

  const availableParameters = requiredParameters.filter((parameter) =>
    isUsable(canonicalEvidence.find((record) => record.parameter === parameter))
  )
  const missingParameters = requiredParameters.filter((parameter) =>
    !availableParameters.includes(parameter)
  )
  const complete = missingParameters.length === 0
  const statusSource = sourceStatus(input)
  const status = complete
    ? statusSource
    : availableParameters.length > 0
      ? 'partial'
      : 'unavailable'

  return {
    evidence: canonicalEvidence,
    aggregation: {
      status,
      sourceStatus: statusSource,
      isLive: status === 'live',
      complete,
      completeness: Number(
        (availableParameters.length / requiredParameters.length).toFixed(3)
      ),
      availableParameters,
      missingParameters,
      duplicateParameters,
      conflicts,
      provenance: provenanceFor(input),
    },
  }
}
