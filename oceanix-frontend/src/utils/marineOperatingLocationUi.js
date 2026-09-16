import { findNearestMarineOperatingLocations } from '../../../shared/marineOperatingLocationProximity.js'

export const MAX_NEARBY_OPERATING_LOCATIONS = 5

export function getNearbyMarineOperatingLocations(
  userCoordinates,
  locations,
  limit = MAX_NEARBY_OPERATING_LOCATIONS
) {
  if (!userCoordinates) return []
  return findNearestMarineOperatingLocations(userCoordinates, locations, { limit })
}

export function formatMarineOperatingLocationDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.max(1, Math.round(distanceKm * 1000))} m`
  }
  return `${distanceKm.toFixed(1)} km`
}

export function selectMarineOperatingLocation(state, location) {
  return {
    userCoordinates: state.userCoordinates,
    selectedOperatingLocation: location,
  }
}

export function getOperatingLocationConnection(userCoordinates, selectedOperatingLocation) {
  if (!userCoordinates || !selectedOperatingLocation) return null

  return [
    [userCoordinates.latitude, userCoordinates.longitude],
    [selectedOperatingLocation.latitude, selectedOperatingLocation.longitude],
  ]
}
