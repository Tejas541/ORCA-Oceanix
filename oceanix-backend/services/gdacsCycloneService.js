import { createEvidenceRecord } from '../../shared/orcaEvidence.js'

export const GDACS_BASE_URL = 'https://www.gdacs.org/gdacsapi'
export const GDACS_SEARCH_ENDPOINT = `${GDACS_BASE_URL}/api/Events/geteventlist/SEARCH`
export const GDACS_GEOMETRY_ENDPOINT = `${GDACS_BASE_URL}/api/Polygons/getgeometry`
export const GDACS_PROVIDER = 'GDACS'
export const GDACS_SOURCE = 'GDACS tropical cyclone events'
export const GDACS_ATTRIBUTION = 'Global Disaster Awareness and Coordination System, GDACS'

function finiteCoordinate(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function validateCoordinates(latitude, longitude) {
  if (!finiteCoordinate(latitude, -90, 90) || !finiteCoordinate(longitude, -180, 180)) {
    const error = new Error('Valid latitude and longitude are required')
    error.code = 'INVALID_COORDINATES'
    error.status = 400
    throw error
  }
}

function asBoolean(value) {
  return value === true || String(value).toLowerCase() === 'true'
}

function featureList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.features)) return payload.features
  return null
}

function eventProperties(feature) {
  return feature?.properties ?? feature ?? {}
}

function eventKey(properties) {
  return {
    eventtype: properties.eventtype ?? 'TC',
    eventid: properties.eventid,
    episodeid: properties.episodeid,
    source: properties.source,
  }
}

function hasEventIdentity(properties) {
  return properties.eventid !== undefined && properties.eventid !== null &&
    properties.episodeid !== undefined && properties.episodeid !== null
}

function pointInRing([longitude, latitude], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = ((yi > latitude) !== (yj > latitude)) &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function pointInGeometry(longitude, latitude, geometry) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') {
    const [outer, ...holes] = geometry.coordinates ?? []
    return Boolean(outer && pointInRing([longitude, latitude], outer) &&
      !holes.some((hole) => pointInRing([longitude, latitude], hole)))
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates ?? []).some((polygon) =>
      pointInGeometry(longitude, latitude, { type: 'Polygon', coordinates: polygon })
    )
  }
  if (geometry.type === 'GeometryCollection') {
    return (geometry.geometries ?? []).some((item) => pointInGeometry(longitude, latitude, item))
  }
  return false
}

function geometryFeatures(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.features)) return payload.features
  if (payload?.type === 'Feature') return [payload]
  if (payload?.type && payload.coordinates) return [{ type: 'Feature', geometry: payload }]
  return []
}

function sourceError(error) {
  return {
    code: error?.code ?? 'GDACS_REQUEST_FAILED',
    message: error?.message ?? 'GDACS request failed',
    ...(error?.status ? { status: error.status } : {}),
  }
}

function unavailableEvidence({
  latitude,
  longitude,
  retrievedAt,
  coordinateRole,
  coordinatePolicy,
  endpoint,
  error,
}) {
  return createEvidenceRecord({
    provider: GDACS_PROVIDER,
    source: GDACS_SOURCE,
    endpoint,
    parameter: 'cyclone',
    value: null,
    location: [latitude, longitude],
    retrievedAt,
    status: 'unavailable',
    isLive: false,
    validation: 'missing',
    quality: {
      attribution: GDACS_ATTRIBUTION,
      coordinateRole,
      coordinatePolicy,
      sourceDataStatus: 'unavailable',
      sourceError: sourceError(error),
    },
  })
}

function noRelevantCycloneEvidence({
  latitude,
  longitude,
  retrievedAt,
  coordinateRole,
  coordinatePolicy,
  endpoint,
  candidateCount,
}) {
  return createEvidenceRecord({
    provider: GDACS_PROVIDER,
    source: GDACS_SOURCE,
    endpoint,
    parameter: 'cyclone',
    value: { active: false, category: 'none' },
    location: [latitude, longitude],
    retrievedAt,
    status: 'available',
    isLive: false,
    validation: 'valid',
    quality: {
      attribution: GDACS_ATTRIBUTION,
      coordinateRole,
      coordinatePolicy,
      sourceDataStatus: 'event_status',
      candidateCount,
      relevance: 'no_current_event_geometry_contains_request_coordinate',
    },
  })
}

function cycloneEvidence({
  properties,
  eventFeature,
  geometry,
  latitude,
  longitude,
  retrievedAt,
  coordinateRole,
  coordinatePolicy,
  searchEndpoint,
  geometryEndpoint,
}) {
  const category = properties.severitydata?.severitytext ?? properties.category ?? null
  const eventId = properties.eventid
  const episodeId = properties.episodeid
  const eventName = properties.eventname || properties.name || properties.description || null
  const eventCoordinates = eventFeature?.geometry?.coordinates ?? null
  return createEvidenceRecord({
    provider: GDACS_PROVIDER,
    source: GDACS_SOURCE,
    endpoint: geometryEndpoint ?? searchEndpoint,
    parameter: 'cyclone',
    value: {
      active: true,
      ...(category ? { category } : {}),
      ...(eventName ? { name: eventName } : {}),
      eventId,
      ...(episodeId !== undefined ? { episodeId } : {}),
    },
    location: [latitude, longitude],
    forecastTime: properties.todate ?? null,
    retrievedAt,
    status: 'available',
    isLive: false,
    validation: 'valid',
    quality: {
      attribution: GDACS_ATTRIBUTION,
      coordinateRole,
      coordinatePolicy,
      sourceDataStatus: 'event_status',
      eventId,
      eventName,
      episodeId,
      alertLevel: properties.alertlevel ?? null,
      episodeAlertLevel: properties.episodealertlevel ?? null,
      source: properties.source ?? null,
      sourceId: properties.sourceid ?? null,
      category,
      eventCoordinates,
      eventGeometry: geometry,
      searchEndpoint,
      geometryEndpoint,
      reference: properties.url?.report ?? properties.url?.details ?? null,
    },
  })
}

function buildSearchUrl({ pageSize = 100, pageNumber = 1 } = {}) {
  const url = new URL(GDACS_SEARCH_ENDPOINT)
  url.searchParams.set('eventlist', 'TC')
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('pageNumber', String(pageNumber))
  return url.toString()
}

function buildGeometryUrl(properties) {
  const url = new URL(GDACS_GEOMETRY_ENDPOINT)
  const key = eventKey(properties)
  url.searchParams.set('eventtype', String(key.eventtype))
  url.searchParams.set('eventid', String(key.eventid))
  url.searchParams.set('episodeid', String(key.episodeid))
  if (key.source) url.searchParams.set('source', String(key.source))
  return url.toString()
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    if (!response?.ok) {
      const error = new Error(`GDACS HTTP request failed with status ${response?.status ?? 'unknown'}`)
      error.code = 'GDACS_HTTP_ERROR'
      error.status = response?.status ?? 502
      throw error
    }
    try {
      return await response.json()
    } catch (error) {
      error.code = 'GDACS_MALFORMED_RESPONSE'
      throw error
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchGdacsCyclone({
  latitude,
  longitude,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000,
  retrievedAt = new Date().toISOString(),
  coordinateRole = 'browser_gps',
  coordinatePolicy = 'direct_coordinate_request_no_snapping',
} = {}) {
  validateCoordinates(latitude, longitude)
  if (typeof fetchImpl !== 'function') {
    const error = new Error('GDACS fetch implementation is unavailable')
    error.code = 'GDACS_FETCH_UNAVAILABLE'
    throw error
  }

  const searchEndpoint = buildSearchUrl()
  try {
    const searchPayload = await fetchJson(searchEndpoint, fetchImpl, timeoutMs)
    const features = featureList(searchPayload)
    if (!features) {
      const error = new Error('GDACS search response did not contain event features')
      error.code = 'GDACS_MALFORMED_RESPONSE'
      throw error
    }

    const currentEvents = features.filter((feature) => {
      const properties = eventProperties(feature)
      return String(properties.eventtype ?? 'TC').toUpperCase() === 'TC' &&
        asBoolean(properties.iscurrent) && hasEventIdentity(properties)
    })

    let geometryFailure = null
    for (const eventFeature of currentEvents) {
      const properties = eventProperties(eventFeature)
      const geometryEndpoint = buildGeometryUrl(properties)
      try {
        const geometryPayload = await fetchJson(geometryEndpoint, fetchImpl, timeoutMs)
        const geometry = geometryFeatures(geometryPayload)
          .map((feature) => feature.geometry)
          .find((candidate) => pointInGeometry(longitude, latitude, candidate))
        if (geometry) {
          return {
            status: 'available',
            isLive: false,
            source: { provider: GDACS_PROVIDER, name: GDACS_SOURCE },
            retrievedAt,
            location: [latitude, longitude],
            evidence: [cycloneEvidence({
              properties,
              eventFeature,
              geometry,
              latitude,
              longitude,
              retrievedAt,
              coordinateRole,
              coordinatePolicy,
              searchEndpoint,
              geometryEndpoint,
            })],
            provenance: {
              provider: GDACS_PROVIDER,
              source: GDACS_SOURCE,
              searchEndpoint,
              geometryEndpoint,
              retrievedAt,
              coordinateRole,
              coordinatePolicy,
              attribution: GDACS_ATTRIBUTION,
            },
            requestContext: { coordinateRole, coordinatePolicy },
          }
        }
      } catch (error) {
        geometryFailure = error
      }
    }

    if (geometryFailure) {
      return {
        status: 'unavailable',
        isLive: false,
        source: { provider: GDACS_PROVIDER, name: GDACS_SOURCE },
        retrievedAt,
        location: [latitude, longitude],
        evidence: [unavailableEvidence({
          latitude,
          longitude,
          retrievedAt,
          coordinateRole,
          coordinatePolicy,
          endpoint: searchEndpoint,
          error: geometryFailure,
        })],
        provenance: {
          provider: GDACS_PROVIDER,
          source: GDACS_SOURCE,
          searchEndpoint,
          retrievedAt,
          coordinateRole,
          coordinatePolicy,
          attribution: GDACS_ATTRIBUTION,
          sourceDataStatus: 'unavailable',
        },
        requestContext: { coordinateRole, coordinatePolicy },
      }
    }

    return {
      status: 'available',
      isLive: false,
      source: { provider: GDACS_PROVIDER, name: GDACS_SOURCE },
      retrievedAt,
      location: [latitude, longitude],
      evidence: [noRelevantCycloneEvidence({
        latitude,
        longitude,
        retrievedAt,
        coordinateRole,
        coordinatePolicy,
        endpoint: searchEndpoint,
        candidateCount: currentEvents.length,
      })],
      provenance: {
        provider: GDACS_PROVIDER,
        source: GDACS_SOURCE,
        searchEndpoint,
        retrievedAt,
        coordinateRole,
        coordinatePolicy,
        attribution: GDACS_ATTRIBUTION,
        sourceDataStatus: 'event_status',
        currentEventCount: currentEvents.length,
      },
      requestContext: { coordinateRole, coordinatePolicy },
    }
  } catch (error) {
    return {
      status: 'unavailable',
      isLive: false,
      source: { provider: GDACS_PROVIDER, name: GDACS_SOURCE },
      retrievedAt,
      location: [latitude, longitude],
      evidence: [unavailableEvidence({
        latitude,
        longitude,
        retrievedAt,
        coordinateRole,
        coordinatePolicy,
        endpoint: searchEndpoint,
        error,
      })],
      provenance: {
        provider: GDACS_PROVIDER,
        source: GDACS_SOURCE,
        searchEndpoint,
        retrievedAt,
        coordinateRole,
        coordinatePolicy,
        attribution: GDACS_ATTRIBUTION,
        sourceDataStatus: 'unavailable',
      },
      requestContext: { coordinateRole, coordinatePolicy },
    }
  }
}

export {
  buildGeometryUrl,
  buildSearchUrl,
  eventProperties,
  featureList,
  pointInGeometry,
  validateCoordinates,
}
