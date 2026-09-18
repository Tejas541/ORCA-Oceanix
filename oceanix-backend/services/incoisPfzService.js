import { createEvidenceRecord } from '../../shared/orcaEvidence.js'

export const INCOIS_PFZ_WFS_ENDPOINT =
  'https://incois.gov.in/geoserver/PFZ_Automation/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application/json'

const INCOIS_PFZ_SOURCE = 'INCOIS PFZ WFS'
const EARTH_RADIUS_KM = 6371.0088
const DEFAULT_COORDINATE_POLICY = 'direct_coordinate_request_no_snapping'
const POINT_ON_LINE_TOLERANCE_KM = 0.01

function finiteCoordinate(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function validLocation(latitude, longitude) {
  const lat = finiteCoordinate(latitude)
  const lon = finiteCoordinate(longitude)
  return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

function haversineDistanceKm(from, to) {
  const latitudeDelta = (to[1] - from[1]) * Math.PI / 180
  const longitudeDelta = (to[0] - from[0]) * Math.PI / 180
  const fromLatitude = from[1] * Math.PI / 180
  const toLatitude = to[1] * Math.PI / 180
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)))
}

function coordinatePair(value) {
  if (!Array.isArray(value) || value.length < 2) return null
  const longitude = finiteCoordinate(value[0])
  const latitude = finiteCoordinate(value[1])
  if (longitude === null || latitude === null) return null
  return [longitude, latitude]
}

function segmentsForGeometry(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return []
  if (geometry.type === 'LineString') {
    return [geometry.coordinates.map(coordinatePair).filter(Boolean)]
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.map((line) => line.map(coordinatePair).filter(Boolean))
  }
  return []
}

function nearestPointOnSegment(point, start, end) {
  const latitudeScale = Math.cos(point[1] * Math.PI / 180)
  const startX = (start[0] - point[0]) * latitudeScale
  const startY = start[1] - point[1]
  const endX = (end[0] - point[0]) * latitudeScale
  const endY = end[1] - point[1]
  const deltaX = endX - startX
  const deltaY = endY - startY
  const denominator = deltaX ** 2 + deltaY ** 2
  const ratio = denominator === 0
    ? 0
    : Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / denominator))
  const candidate = [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio,
  ]
  return {
    point: candidate,
    distanceKm: haversineDistanceKm(point, candidate),
  }
}

function nearestFeatureForLocation(data, {
  latitude,
  longitude,
  coordinateRole = null,
} = {}) {
  const hasLocation = validLocation(latitude, longitude)
  const selectedPoint = hasLocation ? [Number(longitude), Number(latitude)] : null
  let nearest = null

  if (selectedPoint) {
    for (const feature of data?.features ?? []) {
      const segments = segmentsForGeometry(feature.geometry)
      for (const line of segments) {
        for (let index = 1; index < line.length; index += 1) {
          const candidate = nearestPointOnSegment(selectedPoint, line[index - 1], line[index])
          if (!nearest || candidate.distanceKm < nearest.distanceKm) {
            const properties = feature.properties ?? {}
            nearest = {
              feature,
              point: candidate.point,
              distanceKm: candidate.distanceKm,
              uid: properties.UID ?? properties.Uid ?? properties.uid ?? properties.Sno ?? null,
              advisoryDate: dateFromJulianDay(properties.Year, properties.Julian_day),
              year: properties.Year ?? null,
              julianDay: properties.Julian_day ?? null,
              geometryType: feature.geometry?.type ?? null,
            }
          }
        }
      }
    }
  }

  const geometryAvailable = (data?.features ?? []).some((feature) =>
    segmentsForGeometry(feature.geometry).some((line) => line.length >= 2)
  )
  const pointOnLine = Boolean(nearest && nearest.distanceKm <= POINT_ON_LINE_TOLERANCE_KM)

  return {
    geometryAvailable,
    selectedCoordinates: hasLocation ? { latitude: Number(latitude), longitude: Number(longitude) } : null,
    coordinateRole: hasLocation ? (coordinateRole ?? 'selected_operating_location') : null,
    spatialRelation: nearest
      ? pointOnLine ? 'point_on_pfz_line' : 'nearest_pfz_line'
      : geometryAvailable ? 'no_selected_coordinate' : 'geometry_unavailable',
    pointOnLine,
    distanceKm: nearest ? Number(nearest.distanceKm.toFixed(3)) : null,
    nearestFeature: nearest
      ? {
        uid: nearest.uid,
        advisoryDate: nearest.advisoryDate,
        year: nearest.year,
        julianDay: nearest.julianDay,
        geometryType: nearest.geometryType,
      }
      : null,
  }
}

function unavailableResult(retrievedAt, reason, error = null, {
  latitude = null,
  longitude = null,
  coordinateRole = null,
  coordinatePolicy = DEFAULT_COORDINATE_POLICY,
} = {}) {
  return {
    status: 'unavailable',
    isLive: false,
    source: {
      provider: 'INCOIS',
      name: INCOIS_PFZ_SOURCE,
      endpoint: INCOIS_PFZ_WFS_ENDPOINT,
    },
    retrievedAt,
    advisoryDate: null,
    validUntil: null,
    sector: null,
    data: null,
    latitude,
    longitude,
    spatial: {
      geometryAvailable: false,
      selectedCoordinates: validLocation(latitude, longitude) ? { latitude, longitude } : null,
      coordinateRole,
      coordinatePolicy,
      spatialRelation: 'unavailable',
      pointOnLine: false,
      distanceKm: null,
      nearestFeature: null,
    },
    evidence: [createEvidenceRecord({
      provider: 'INCOIS',
      source: INCOIS_PFZ_SOURCE,
      endpoint: INCOIS_PFZ_WFS_ENDPOINT,
      parameter: 'pfz',
      value: null,
      location: validLocation(latitude, longitude) ? [latitude, longitude] : null,
      retrievedAt,
      status: 'unavailable',
      isLive: false,
      validation: 'missing',
      quality: {
        sourceDataStatus: 'unavailable',
        sourceError: error,
        coordinateRole,
        coordinatePolicy,
      },
    })],
    provenance: {
      provider: 'INCOIS',
      endpoint: INCOIS_PFZ_WFS_ENDPOINT,
      retrievedAt,
      format: 'application/geo+json',
      reason,
      coordinateRole,
      coordinatePolicy,
    },
    reason,
  }
}

export { unavailableResult as unavailablePfzResult }

function dateFromJulianDay(year, julianDay) {
  const numericYear = Number(year)
  const numericDay = Number(julianDay)
  if (
    !Number.isInteger(numericYear) ||
    !Number.isInteger(numericDay) ||
    numericDay < 1 ||
    numericDay > 366
  ) {
    return null
  }

  const date = new Date(Date.UTC(numericYear, 0, numericDay))
  return date.toISOString().slice(0, 10)
}

function normalizeFeatureCollection(payload) {
  if (
    !payload ||
    payload.type !== 'FeatureCollection' ||
    !Array.isArray(payload.features)
  ) {
    return null
  }

  const features = payload.features.filter((feature) =>
    feature &&
    feature.type === 'Feature' &&
    feature.properties &&
    typeof feature.properties === 'object'
  )

  return { type: 'FeatureCollection', features }
}

function metadataFor(data) {
  const dates = [...new Set(
    data.features
      .map((feature) => dateFromJulianDay(
        feature.properties.Year,
        feature.properties.Julian_day
      ))
      .filter(Boolean)
  )].sort()

  const states = [...new Set(
    data.features
      .map((feature) => feature.properties.State_Name)
      .filter((value) => typeof value === 'string' && value.trim())
  )].sort()

  const sectorBoundaries = [...new Set(
    data.features
      .map((feature) => feature.properties.SECTORBOUN ?? feature.properties.SECTORBO_1)
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map(String)
  )].sort()

  return {
    advisoryDate: dates.length === 1 ? dates[0] : null,
    advisoryDates: dates,
    sector: {
      states,
      boundaries: sectorBoundaries,
    },
  }
}

export function buildPfzEvidence(result) {
  const available = result?.status === 'available' && result.data
  const spatial = result?.spatial ?? nearestFeatureForLocation(result?.data, result ?? {})
  return createEvidenceRecord({
    provider: result?.source?.provider ?? 'INCOIS',
    source: result?.source?.name ?? INCOIS_PFZ_SOURCE,
    endpoint: result?.source?.endpoint ?? INCOIS_PFZ_WFS_ENDPOINT,
    parameter: 'pfz',
    value: available
      ? {
        ...spatial,
        advisoryDates: result?.provenance?.advisoryDates ?? [],
      }
      : null,
    location: validLocation(result?.latitude, result?.longitude)
      ? [result.latitude, result.longitude]
      : null,
    observationTime: result?.advisoryDate ?? null,
    retrievedAt: result?.retrievedAt ?? null,
    status: available ? 'available' : 'unavailable',
    isLive: false,
    validation: available ? 'valid' : 'missing',
    quality: {
      sourceDataStatus: available ? 'official_pfz' : 'unavailable',
      featureCount: available ? result.data.features.length : 0,
      validUntil: result?.validUntil ?? null,
      sector: result?.sector ?? null,
      coordinateRole: result?.spatial?.coordinateRole ?? null,
      coordinatePolicy: result?.spatial?.coordinatePolicy ?? DEFAULT_COORDINATE_POLICY,
      geometryType: available ? 'MultiLineString_or_LineString' : null,
    },
  })
}

export async function fetchIncoisPfz({
  fetchImpl = globalThis.fetch,
  retrievedAt = new Date().toISOString(),
  timeoutMs = 10000,
  latitude = null,
  longitude = null,
  coordinateRole = null,
  coordinatePolicy = DEFAULT_COORDINATE_POLICY,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return unavailableResult(retrievedAt, 'source_unavailable', null, {
      latitude,
      longitude,
      coordinateRole,
      coordinatePolicy,
    })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      response = await fetchImpl(INCOIS_PFZ_WFS_ENDPOINT, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!response?.ok) {
      return unavailableResult(retrievedAt, 'source_unavailable', {
        status: response?.status ?? null,
      }, { latitude, longitude, coordinateRole, coordinatePolicy })
    }

    const payload = await response.json()
    const data = normalizeFeatureCollection(payload)
    if (!data) {
      return unavailableResult(retrievedAt, 'malformed_response', null, {
        latitude,
        longitude,
        coordinateRole,
        coordinatePolicy,
      })
    }
    if (data.features.length === 0) {
      return unavailableResult(retrievedAt, 'empty_feature_collection', null, {
        latitude,
        longitude,
        coordinateRole,
        coordinatePolicy,
      })
    }

    const metadata = metadataFor(data)
    const spatial = nearestFeatureForLocation(data, {
      latitude,
      longitude,
      coordinateRole,
    })
    spatial.coordinatePolicy = coordinatePolicy
    const result = {
      status: 'available',
      isLive: false,
      source: {
        provider: 'INCOIS',
        name: INCOIS_PFZ_SOURCE,
        endpoint: INCOIS_PFZ_WFS_ENDPOINT,
      },
      retrievedAt,
      latitude,
      longitude,
      advisoryDate: metadata.advisoryDate,
      validUntil: null,
      sector: metadata.sector,
      data,
      spatial,
      provenance: {
        provider: 'INCOIS',
        endpoint: INCOIS_PFZ_WFS_ENDPOINT,
        retrievedAt,
        format: 'application/geo+json',
        featureCount: data.features.length,
        advisoryDates: metadata.advisoryDates,
        validUntil: null,
        coordinateRole: spatial.coordinateRole,
        coordinatePolicy,
        crs: 'GeoJSON longitude/latitude coordinates; source response did not provide an explicit CRS member',
      },
    }

    return {
      ...result,
      evidence: [buildPfzEvidence(result)],
    }
  } catch (error) {
    return unavailableResult(
      retrievedAt,
      error?.name === 'AbortError' ? 'source_timeout' : 'source_unavailable',
      {
      message: error.message,
      },
      { latitude, longitude, coordinateRole, coordinatePolicy }
    )
  }
}

export { nearestFeatureForLocation }
