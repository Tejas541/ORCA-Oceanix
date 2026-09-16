export const MARINE_OPERATING_LOCATION_TYPES = Object.freeze([
  'major_port',
  'non_major_port',
  'fishing_harbour',
  'fish_landing_centre',
  'marina',
  'vessel_terminal',
  'ferry_terminal',
  'government_maritime_facility',
  'offshore_support',
  'other_marine_access',
])

export const MARINE_OPERATING_LOCATION_STATUSES = Object.freeze([
  'operational',
  'inactive',
  'unknown',
  'unresolved_coordinates',
])

export function dmsToDecimalDegrees({ degrees, minutes = 0, seconds = 0, hemisphere }) {
  if (
    typeof degrees !== 'number' ||
    !Number.isFinite(degrees) ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    typeof seconds !== 'number' ||
    !Number.isFinite(seconds) ||
    !['N', 'S', 'E', 'W'].includes(hemisphere) ||
    minutes < 0 ||
    minutes >= 60 ||
    seconds < 0 ||
    seconds >= 60
  ) {
    throw new TypeError('Invalid DMS coordinate')
  }

  const decimal = degrees + minutes / 60 + seconds / 3600
  return hemisphere === 'S' || hemisphere === 'W' ? -decimal : decimal
}

function isFiniteCoordinate(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

export function isMarineOperatingLocation(value) {
  return Boolean(
    value &&
    typeof value.id === 'string' &&
    value.id.trim() &&
    typeof value.name === 'string' &&
    value.name.trim() &&
    MARINE_OPERATING_LOCATION_TYPES.includes(value.type) &&
    (value.latitude === null || isFiniteCoordinate(value.latitude, -90, 90)) &&
    (value.longitude === null || isFiniteCoordinate(value.longitude, -180, 180)) &&
    typeof value.source === 'string' &&
    value.source.trim() &&
    typeof value.sourceVersion === 'string' &&
    value.sourceVersion.trim() &&
    typeof value.sourceUrl === 'string' &&
    value.sourceUrl.trim() &&
    MARINE_OPERATING_LOCATION_STATUSES.includes(value.status) &&
    (value.status === 'unresolved_coordinates'
      ? value.latitude === null || value.longitude === null
      : value.latitude !== null && value.longitude !== null)
  )
}

export function createMarineOperatingLocation(input) {
  const location = {
    id: input?.id,
    name: input?.name,
    type: input?.type,
    latitude: input?.latitude ?? null,
    longitude: input?.longitude ?? null,
    state: input?.state ?? null,
    district: input?.district ?? null,
    source: input?.source,
    sourceVersion: input?.sourceVersion,
    sourceUrl: input?.sourceUrl,
    status: input?.status ?? 'unknown',
  }

  if (!isMarineOperatingLocation(location)) {
    throw new TypeError('Invalid MarineOperatingLocation record')
  }

  return Object.freeze(location)
}
