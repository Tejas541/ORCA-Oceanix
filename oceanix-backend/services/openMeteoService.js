import { createEvidenceRecord } from '../../shared/orcaEvidence.js'

export const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
export const OPEN_METEO_PROVIDER = 'Open-Meteo'
export const OPEN_METEO_SOURCE = 'Open-Meteo forecast'
export const OPEN_METEO_LIGHTNING_PARAMETER = 'lightningPotential'

function isFiniteNumber(value ) {
    return typeof value === 'number' && Number.isFinite(value)
}

function validateCoordinates(latitude, longitude) {
    if (
        !isFiniteNumber(latitude) ||
        !isFiniteNumber(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        const error = new Error('Valid latitude and longitude are required')
        error.code = 'INVALID_COORDINATES'
        error.status = 400
        throw error
    }
}

function unavailableEvidence({
                                 parameter,
                                 unit,
                                 latitude,
                                 longitude,
                                 retrievedAt,
                                 endpoint,
                                 reason,
                                 error,
                                 coordinateRole,
                                 coordinatePolicy,
                             }) {
    return createEvidenceRecord({
        provider: OPEN_METEO_PROVIDER,
        source: OPEN_METEO_SOURCE,
        endpoint,
        parameter,
        value: null,
        unit,
        location: [latitude, longitude],
        retrievedAt,
        status: 'unavailable',
        isLive: false,
        validation: 'missing',
        quality: {
            coordinateRole,
            coordinatePolicy,
            sourceDataStatus: 'unavailable',
            reason,
            ...(error ? { sourceError: error } : {}),
        },
    })
}

function selectForecastValue(times, values, requestedTime) {
    if (!Array.isArray(times) || !Array.isArray(values) || times.length !== values.length) {
        return null
    }

    let index = 0
    if (requestedTime) {
        const requestedKey = String(requestedTime).replace(/Z$/, '')
        index = times.findIndex((time) => String(time).replace(/Z$/, '') === requestedKey)
        if (index === -1) return null
    }

    const value = values[index]
    return isFiniteNumber(value)
        ? { value, forecastTime: times[index] }
        : null
}

function forecastMetadata(payload, blockName) {
    const block = payload?.[blockName]
    return {
        time: block?.time,
        units: block?.[`${blockName}_units`] ?? payload?.[`${blockName}_units`] ?? {},
    }
}

function buildUrl({ latitude, longitude, requestedTime }) {
    const url = new URL(OPEN_METEO_ENDPOINT)
    url.searchParams.set('latitude', String(latitude))
    url.searchParams.set('longitude', String(longitude))
    url.searchParams.set('hourly', 'visibility')
    url.searchParams.set('minutely_15', 'lightning_potential')
    url.searchParams.set('forecast_days', '2')
    url.searchParams.set('timezone', 'UTC')
    if (requestedTime) {
        url.searchParams.set('start_date', requestedTime.slice(0, 10))
        url.searchParams.set('end_date', requestedTime.slice(0, 10))
    }
    return url.toString()
}

function normalizeRequestedTime(time) {
    if (!time) return null
    const date = new Date(time)
    return Number.isNaN(date.getTime()) ? String(time) : date.toISOString().slice(0, 16)
}

export async function fetchOpenMeteoForecast({
                                                 latitude,
                                                 longitude,
                                                 time,
                                                 fetchImpl = globalThis.fetch,
                                                 timeoutMs = 10000,
                                                 retrievedAt = new Date().toISOString(),
                                                 coordinateRole = 'browser_gps',
                                                 coordinatePolicy = 'direct_coordinate_request_no_snapping',
                                             } = {}) {
    validateCoordinates(latitude, longitude)
    if (typeof fetchImpl !== 'function') {
        const error = new Error('Open-Meteo fetch implementation is unavailable')
        error.code = 'OPEN_METEO_FETCH_UNAVAILABLE'
        throw error
    }

    const requestedTime = normalizeRequestedTime(time)
    const endpoint = buildUrl({ latitude, longitude, requestedTime })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetchImpl(endpoint, { signal: controller.signal })
        if (!response?.ok) {
            const error = new Error(`Open-Meteo HTTP request failed with status ${response?.status ?? 'unknown'}`)
            error.code = 'OPEN_METEO_HTTP_ERROR'
            error.status = response?.status ?? 502
            throw error
        }

        let payload
        try {
            payload = await response.json()
        } catch (error) {
            error.code = 'OPEN_METEO_MALFORMED_RESPONSE'
            throw error
        }

        const returnedLatitude = isFiniteNumber(payload?.latitude) ? payload.latitude : latitude
        const returnedLongitude = isFiniteNumber(payload?.longitude) ? payload.longitude : longitude
        const location = [returnedLatitude, returnedLongitude]
        const hourly = forecastMetadata(payload, 'hourly')
        const minutely = forecastMetadata(payload, 'minutely_15')
        const visibility = selectForecastValue(
            hourly.time,
            payload?.hourly?.visibility,
            requestedTime,
        )
        const lightning = selectForecastValue(
            minutely.time,
            payload?.minutely_15?.lightning_potential,
            requestedTime,
        )
        const commonQuality = {
            coordinateRole,
            coordinatePolicy,
            sourceDataStatus: 'forecast',
            latitude: returnedLatitude,
            longitude: returnedLongitude,
            model: payload?.model ?? null,
            generationtimeMs: payload?.generationtime_ms ?? null,
            timezone: payload?.timezone ?? 'UTC',
        }
        const evidence = [
            visibility
                ? createEvidenceRecord({
                    provider: OPEN_METEO_PROVIDER,
                    source: OPEN_METEO_SOURCE,
                    endpoint,
                    parameter: 'visibility',
                    value: visibility.value,
                    unit: hourly.units?.visibility ?? 'm',
                    location,
                    forecastTime: visibility.forecastTime,
                    retrievedAt,
                    status: 'available',
                    isLive: false,
                    validation: 'valid',
                    quality: {
                        ...commonQuality,
                        variable: 'visibility',
                    },
                })
                : unavailableEvidence({
                    parameter: 'visibility',
                    unit: hourly.units?.visibility ?? 'm',
                    latitude: returnedLatitude,
                    longitude: returnedLongitude,
                    retrievedAt,
                    endpoint,
                    reason: 'visibility_forecast_unavailable',
                    coordinateRole,
                    coordinatePolicy,
                }),
            lightning
                ? createEvidenceRecord({
                    provider: OPEN_METEO_PROVIDER,
                    source: OPEN_METEO_SOURCE,
                    endpoint,
                    parameter: OPEN_METEO_LIGHTNING_PARAMETER,
                    value: lightning.value,
                    unit: minutely.units?.lightning_potential ?? 'J/kg',
                    location,
                    forecastTime: lightning.forecastTime,
                    retrievedAt,
                    status: 'available',
                    isLive: false,
                    validation: 'valid',
                    quality: {
                        ...commonQuality,
                        variable: 'lightning_potential',
                        canonicalParameter: 'lightningRiskPercent',
                        canonicalMapping: 'not_available_without_defensible_percentage_conversion',
                    },
                })
                : unavailableEvidence({
                    parameter: OPEN_METEO_LIGHTNING_PARAMETER,
                    unit: minutely.units?.lightning_potential ?? 'J/kg',
                    latitude: returnedLatitude,
                    longitude: returnedLongitude,
                    retrievedAt,
                    endpoint,
                    reason: 'lightning_potential_forecast_unavailable',
                    coordinateRole,
                    coordinatePolicy,
                }),
        ]

        return {
            status: evidence.some((record) => record.parameter === 'visibility' && record.status === 'available')
                ? 'available'
                : 'unavailable',
            isLive: false,
            source: {
                provider: OPEN_METEO_PROVIDER,
                name: OPEN_METEO_SOURCE,
                endpoint,
            },
            retrievedAt,
            location,
            data: {
                visibility: visibility?.value ?? null,
                visibilityUnit: hourly.units?.visibility ?? 'm',
                visibilityForecastTime: visibility?.forecastTime ?? null,
                lightningPotential: lightning?.value ?? null,
                lightningPotentialUnit: minutely.units?.lightning_potential ?? 'J/kg',
                lightningPotentialForecastTime: lightning?.forecastTime ?? null,
                model: payload?.model ?? null,
            },
            evidence,
            provenance: {
                provider: OPEN_METEO_PROVIDER,
                source: OPEN_METEO_SOURCE,
                endpoint,
                retrievedAt,
                sourceDataStatus: 'forecast',
                forecastTime: visibility?.forecastTime ?? lightning?.forecastTime ?? null,
                model: payload?.model ?? null,
                timezone: payload?.timezone ?? 'UTC',
                coordinateRole,
                coordinatePolicy,
            },
            requestContext: { coordinateRole, coordinatePolicy },
        }
    } catch (error) {
        const sourceError = {
            code: error.code ?? (error.name === 'AbortError' ? 'OPEN_METEO_TIMEOUT' : 'OPEN_METEO_REQUEST_FAILED'),
            message: error.message,
            ...(error.status ? { status: error.status } : {}),
        }
        const evidence = [
            unavailableEvidence({
                parameter: 'visibility',
                unit: 'm',
                latitude,
                longitude,
                retrievedAt,
                endpoint,
                reason: sourceError.code,
                error: sourceError,
                coordinateRole,
                coordinatePolicy,
            }),
            unavailableEvidence({
                parameter: OPEN_METEO_LIGHTNING_PARAMETER,
                unit: 'J/kg',
                latitude,
                longitude,
                retrievedAt,
                endpoint,
                reason: sourceError.code,
                error: sourceError,
                coordinateRole,
                coordinatePolicy,
            }),
        ]
        return {
            status: 'unavailable',
            isLive: false,
            source: {
                provider: OPEN_METEO_PROVIDER,
                name: OPEN_METEO_SOURCE,
                endpoint,
            },
            retrievedAt,
            location: [latitude, longitude],
            data: {
                visibility: null,
                visibilityUnit: 'm',
                visibilityForecastTime: null,
                lightningPotential: null,
                lightningPotentialUnit: 'J/kg',
                lightningPotentialForecastTime: null,
            },
            evidence,
            provenance: {
                provider: OPEN_METEO_PROVIDER,
                source: OPEN_METEO_SOURCE,
                endpoint,
                retrievedAt,
                sourceDataStatus: 'unavailable',
                reason: sourceError.code,
                coordinateRole,
                coordinatePolicy,
            },
            requestContext: { coordinateRole, coordinatePolicy },
        }
    } finally {
        clearTimeout(timeout)
    }
}

export { buildUrl, selectForecastValue, validateCoordinates }
