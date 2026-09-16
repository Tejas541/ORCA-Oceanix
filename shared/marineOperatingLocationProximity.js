const EARTH_RADIUS_KM = 6371.0088

function toRadians(value) {
  return (value * Math.PI) / 180
}

function assertCoordinate(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new TypeError(`Invalid ${name}`)
  }
}

export function haversineDistanceKm(from, to) {
  assertCoordinate(from?.latitude, 'origin latitude', -90, 90)
  assertCoordinate(from?.longitude, 'origin longitude', -180, 180)
  assertCoordinate(to?.latitude, 'destination latitude', -90, 90)
  assertCoordinate(to?.longitude, 'destination longitude', -180, 180)

  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const originLatitude = toRadians(from.latitude)
  const destinationLatitude = toRadians(to.latitude)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function findNearestMarineOperatingLocations(
  { latitude, longitude },
  locations,
  { limit } = {}
) {
  assertCoordinate(latitude, 'user latitude', -90, 90)
  assertCoordinate(longitude, 'user longitude', -180, 180)
  if (!Array.isArray(locations)) {
    throw new TypeError('locations must be an array')
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new TypeError('limit must be a non-negative integer')
  }

  const origin = { latitude, longitude }
  const ranked = locations
    .filter((location) =>
      location?.status !== 'inactive' &&
      location?.status !== 'unresolved_coordinates' &&
      Number.isFinite(location?.latitude) &&
      Number.isFinite(location?.longitude)
    )
    .map((location) => ({
      location,
      distanceKm: haversineDistanceKm(origin, location),
    }))
    .sort((left, right) =>
      left.distanceKm - right.distanceKm ||
      left.location.id.localeCompare(right.location.id)
    )

  return limit === undefined ? ranked : ranked.slice(0, limit)
}
