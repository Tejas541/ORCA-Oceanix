import { evaluateOrcaDecision } from '../../shared/orcaDecisionEngine.js'
import { aggregateEvidence } from '../../shared/orcaEvidenceAggregator.js'
import { createEvidenceRecord } from '../../shared/orcaEvidence.js'
import { getMarineParameters } from './incoisService.js'
import { fetchIncoisWave } from './incoisWaveService.js'
import { fetchIncoisWind } from './incoisWindService.js'

const INCOIS_PROVIDER = 'INCOIS ERDDAP'
const DEFAULT_COORDINATE_POLICY = 'direct_coordinate_request_no_snapping'

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function statusForDataStatus(dataStatus) {
  return dataStatus === 'nrt' ? 'available' : 'unavailable'
}

function evidenceQuality({
                           sourceDataStatus,
                           sourceMetadata,
                           sourceValue,
                           sourceUnit,
                         }) {
  return {
    sourceDataStatus: sourceDataStatus ?? 'unknown',
    ...(sourceMetadata ? { sourceMetadata } : {}),
    ...(sourceValue !== undefined ? { sourceValue } : {}),
    ...(sourceUnit ? { sourceUnit } : {}),
  }
}

function createUnavailableParameterEvidence({
                                              parameter,
                                              provider = INCOIS_PROVIDER,
                                              source = INCOIS_PROVIDER,
                                              endpoint = null,
                                              location = null,
                                              retrievedAt = null,
                                              sourceDataStatus = 'unavailable',
                                              sourceMetadata = null,
                                              error = null,
                                              coordinateRole = 'browser_gps',
                                              coordinatePolicy = DEFAULT_COORDINATE_POLICY,
                                            }) {
  return createEvidenceRecord({
    provider,
    source,
    endpoint,
    parameter,
    value: null,
    location,
    retrievedAt,
    status: 'unavailable',
    isLive: false,
    validation: 'missing',
    quality: {
      coordinateRole,
      coordinatePolicy,
      ...evidenceQuality({ sourceDataStatus, sourceMetadata }),
      ...(error ? { sourceError: error } : {}),
    },
  })
}

function unavailableOsfEvidence({
                                  parameter,
                                  latitude,
                                  longitude,
                                  coordinateRole,
                                  coordinatePolicy,
                                  error,
                                }) {
  return createUnavailableParameterEvidence({
    parameter,
    provider: 'INCOIS',
    source: 'INCOIS Ocean State Forecast',
    location: [latitude, longitude],
    sourceDataStatus: 'unavailable',
    coordinateRole,
    coordinatePolicy,
    error: {
      code: error?.code ?? 'INCOIS_OSF_REQUEST_FAILED',
      message: error?.message ?? 'INCOIS OSF request failed',
    },
  })
}

export function mapIncoisMarineParametersToEvidence(result = {}) {
  const parameter = result.parameters?.significantWaveHeight
  const location = parameter
      ? [parameter.latitude, parameter.longitude]
      : [result.latitude, result.longitude]
  const sourceDataStatus = parameter?.dataStatus ?? 'unavailable'

  if (!parameter) {
    return [createUnavailableParameterEvidence({
      parameter: 'waveHeight',
      endpoint: result.sourceUrl ?? null,
      location,
      retrievedAt: result.retrievedAt ?? null,
      sourceDataStatus,
      error: result.errors?.significantWaveHeight ?? result.error ?? null,
    })]
  }

  const valueIsValid = isFiniteNumber(parameter.value)
  const sourceMetadata = {
    dataset: parameter.dataset ?? null,
    variable: parameter.variable ?? null,
  }

  return [createEvidenceRecord({
    provider: result.source ?? INCOIS_PROVIDER,
    source: parameter.dataset ?? result.source ?? INCOIS_PROVIDER,
    endpoint: parameter.sourceUrl ?? null,
    parameter: 'waveHeight',
    value: valueIsValid ? parameter.value : parameter.value,
    unit: parameter.unit ?? null,
    location,
    observationTime: parameter.time ?? null,
    retrievedAt: parameter.retrievedAt ?? result.retrievedAt ?? null,
    status: valueIsValid ? statusForDataStatus(sourceDataStatus) : 'invalid',
    isLive: sourceDataStatus === 'nrt',
    validation: valueIsValid ? 'valid' : 'invalid',
    quality: evidenceQuality({
      sourceDataStatus,
      sourceMetadata,
      sourceValue: parameter.value,
      sourceUnit: parameter.unit,
    }),
  })]
}

export function metersPerSecondToKnots(value) {
  return Number(value) * 1.943844
}

export function mapIncoisLegacyWindToEvidence(
    observation = {},
    { windSpeedKnots = null } = {}
) {
  const value = isFiniteNumber(windSpeedKnots)
      ? windSpeedKnots
      : isFiniteNumber(observation.windSpeedMps)
          ? metersPerSecondToKnots(observation.windSpeedMps)
          : null
  const sourceDataStatus = observation.dataStatus ?? 'historical_external'
  const valueIsValid = isFiniteNumber(value)

  return createEvidenceRecord({
    provider: observation.source ?? INCOIS_PROVIDER,
    source: observation.source ?? INCOIS_PROVIDER,
    endpoint: observation.sourceUrl ?? null,
    parameter: 'windSpeed',
    value: valueIsValid ? value : observation.windSpeedMps,
    unit: 'knots',
    location: [observation.latitude, observation.longitude],
    observationTime: observation.metadata?.observationTime ?? observation.time ?? null,
    retrievedAt: observation.fetchedAt ?? observation.retrievedAt ?? null,
    status: valueIsValid ? statusForDataStatus(sourceDataStatus) : 'invalid',
    isLive: false,
    validation: valueIsValid ? 'valid' : 'invalid',
    quality: evidenceQuality({
      sourceDataStatus,
      sourceMetadata: observation.metadata ?? null,
      sourceValue: observation.windSpeedMps,
      sourceUnit: observation.unit ?? 'm/s',
    }),
  })
}

export function buildIncoisEvidence({
                                      marineParameters = {},
                                      legacyWindObservation = null,
                                      legacyWindSpeedKnots = null,
                                    } = {}) {
  const evidence = mapIncoisMarineParametersToEvidence(marineParameters)

  if (legacyWindObservation) {
    evidence.push(mapIncoisLegacyWindToEvidence(legacyWindObservation, {
      windSpeedKnots: legacyWindSpeedKnots,
    }))
  }

  return evidence
}

export async function getIncoisOrcaDecision({
                                              latitude,
                                              longitude,
                                              time,
                                              fetchImpl = globalThis.fetch,
                                              timeoutMs,
                                              // Legacy ERDDAP inputs are intentionally ignored on the canonical OSF path.
                                              marineParameters: _legacyMarineParameters,
                                              legacyWindObservation = null,
                                              legacyWindSpeedKnots = null,
                                              coordinateRole = 'browser_gps',
                                              coordinatePolicy = DEFAULT_COORDINATE_POLICY,
                                              getWave = fetchIncoisWave,
                                              getWind = fetchIncoisWind,
                                            } = {}) {
  const request = {
    latitude,
    longitude,
    time,
    fetchImpl,
    coordinateRole,
    coordinatePolicy,
  }
  const [waveResponse, windResponse] = await Promise.allSettled([
    getWave(request),
    getWind(request),
  ])
  const waveResult = waveResponse.status === 'fulfilled' ? waveResponse.value : null
  const windResult = windResponse.status === 'fulfilled' ? windResponse.value : null
  const evidence = [
    ...(waveResult?.evidence ?? [unavailableOsfEvidence({
      parameter: 'waveHeight',
      latitude,
      longitude,
      coordinateRole,
      coordinatePolicy,
      error: waveResponse.reason,
    })]),
    ...(windResult?.evidence ?? [unavailableOsfEvidence({
      parameter: 'windSpeed',
      latitude,
      longitude,
      coordinateRole,
      coordinatePolicy,
      error: windResponse.reason,
    })]),
  ]
  const aggregated = aggregateEvidence(evidence)

  return {
    source: {
      provider: 'INCOIS',
      wave: waveResult?.source ?? null,
      wind: windResult?.source ?? null,
    },
    requestContext: {
      coordinateRole,
      coordinatePolicy,
    },
    provenance: {
      provider: 'INCOIS',
      coordinateRole,
      coordinatePolicy,
      wave: waveResult?.provenance ?? null,
      wind: windResult?.provenance ?? null,
    },
    evidence: aggregated.evidence,
    aggregation: aggregated.aggregation,
    decision: evaluateOrcaDecision({ evidence: aggregated.evidence }),
  }
}

export async function getLegacyIncoisOrcaDecision({
                                                    latitude,
                                                    longitude,
                                                    time,
                                                    fetchImpl = globalThis.fetch,
                                                    timeoutMs,
                                                    marineParameters,
                                                    legacyWindObservation = null,
                                                    legacyWindSpeedKnots = null,
                                                    coordinateRole = 'browser_gps',
                                                    coordinatePolicy = DEFAULT_COORDINATE_POLICY,
                                                    getWave = fetchIncoisWave,
                                                    getWind = fetchIncoisWind,
                                                  } = {}) {
  let sourceResult = marineParameters

  if (!sourceResult) {
    try {
      sourceResult = await getMarineParameters({
        latitude,
        longitude,
        time,
        fetchImpl,
        timeoutMs,
      })
    } catch (error) {
      sourceResult = {
        status: 'unavailable',
        isLive: false,
        source: INCOIS_PROVIDER,
        parameters: {},
        latitude,
        longitude,
        retrievedAt: new Date().toISOString(),
        error: {
          code: error.code ?? 'INCOIS_REQUEST_FAILED',
          message: error.message,
          status: error.status ?? 502,
        },
      }
    }
  }

  const evidence = buildIncoisEvidence({
    marineParameters: sourceResult,
    legacyWindObservation,
    legacyWindSpeedKnots,
  })
  const aggregated = aggregateEvidence(evidence)
  const decision = evaluateOrcaDecision({ evidence: aggregated.evidence })

  return {
    source: sourceResult,
    requestContext: {
      coordinateRole,
      coordinatePolicy,
    },
    evidence: aggregated.evidence,
    aggregation: aggregated.aggregation,
    decision,
  }
}

export { createUnavailableParameterEvidence }
