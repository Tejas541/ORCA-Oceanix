import test from 'node:test'
import assert from 'node:assert/strict'
import { MARINE_OPERATING_LOCATIONS } from '../data/marineOperatingLocations.js'
import {
  getNearbyMarineOperatingLocations,
  formatMarineOperatingLocationDistance,
  getOperatingLocationConnection,
} from './marineOperatingLocationUi.js'
import {
  interpretAivanaRequest,
  AIVANA_INTENTS,
} from '../services/aivanaInterpreter.js'

const JNPA = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-jawaharlal-nehru')
const MUMBAI = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-mumbai')
const COCHIN = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-cochin')
const CHENNAI = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-chennai')

// 1. Two Different Location Concepts
test('1. Architecture distinguishes User Current Location from Selected Operating Location', () => {
  // User Current Location: optional browser geolocation
  const userGpsCoords = { latitude: 18.9388, longitude: 72.8354 } // Near Mumbai harbour

  // Selected Operating Location: explicit canonical port for ORCA
  const explicitPort = JNPA

  assert.notEqual(userGpsCoords, explicitPort)
  assert.equal(explicitPort.id, 'major-port-jawaharlal-nehru')
  assert.equal(typeof explicitPort.latitude, 'number')
  assert.equal(typeof explicitPort.longitude, 'number')

  // Connection exists only when both are present
  const connection = getOperatingLocationConnection(userGpsCoords, explicitPort)
  assert.deepEqual(connection, [
    [18.9388, 72.8354],
    [explicitPort.latitude, explicitPort.longitude],
  ])

  // If user GPS is denied/null, operating location still functions independently
  const connectionWithoutGps = getOperatingLocationConnection(null, explicitPort)
  assert.equal(connectionWithoutGps, null)
})

// 2. Proximity against canonical database
test('2. Proximity calculates true distance against canonical marineOperatingLocations', () => {
  // Point near Gateway of India / Mumbai Port
  const mumbaiUser = { latitude: 18.922, longitude: 72.834 }
  const nearby = getNearbyMarineOperatingLocations(mumbaiUser, MARINE_OPERATING_LOCATIONS, 3)

  assert.equal(nearby.length, 3)
  // Mumbai Port and JNPA should be the top 2 closest
  const topIds = nearby.slice(0, 2).map((item) => item.location.id)
  assert.ok(topIds.includes(MUMBAI.id))
  assert.ok(topIds.includes(JNPA.id))

  // Distances must be non-zero finite positive numbers and strictly ascending
  assert.ok(nearby[0].distanceKm > 0)
  assert.ok(nearby[1].distanceKm >= nearby[0].distanceKm)
  assert.ok(nearby[2].distanceKm >= nearby[1].distanceKm)

  // Point near Kochi / Ernakulam
  const kochiUser = { latitude: 9.965, longitude: 76.242 }
  const nearbyKochi = getNearbyMarineOperatingLocations(kochiUser, MARINE_OPERATING_LOCATIONS, 2)
  assert.equal(nearbyKochi[0].location.id, COCHIN.id)
  assert.ok(nearbyKochi[0].distanceKm < 15) // Cochin is within 15 km
})

// 3. Distance formatting is compact and readable
test('3. Distance formatting produces readable kilometer / meter output', () => {
  assert.equal(formatMarineOperatingLocationDistance(12.37), '12.4 km')
  assert.equal(formatMarineOperatingLocationDistance(0.45), '450 m')
  assert.equal(formatMarineOperatingLocationDistance(0.005), '5 m')
  assert.equal(formatMarineOperatingLocationDistance(350.12), '350.1 km')
})

// 4. Selected operating location does NOT require browser GPS
test('4. Selected operating location does NOT require browser GPS for ORCA interpretation', () => {
  // User denies GPS (no GPS coordinates available), but explicitly specifies JNPA
  const result = interpretAivanaRequest('Plan a fishing operation from JNPA', null, null)

  assert.equal(result.intent, AIVANA_INTENTS.FISHING)
  assert.equal(result.requiresOperatingLocation, true)
  assert.ok(result.resolvedLocation)
  assert.equal(result.resolvedLocation.id, JNPA.id)
  assert.equal(result.status, 'READY')
  assert.equal(result.clarificationQuestion, null)
})

// 5. Destination vs Operating Location distinction
test('5. Distinguishes destination/navigation requests from operating location', () => {
  // Destination request: "Take me to JNPA"
  const navResult = interpretAivanaRequest('Take me to JNPA')
  assert.equal(navResult.intent, AIVANA_INTENTS.DESTINATION_NAVIGATION)
  assert.equal(navResult.requiresOperatingLocation, false)
  assert.ok(navResult.destination)
  assert.equal(navResult.destination.id, JNPA.id)
  // CRITICAL: Must NOT set destination as the ORCA operating location
  assert.equal(navResult.resolvedLocation, null)
  assert.equal(navResult.status, 'READY')

  // Operational request: "Plan a fishing operation from JNPA"
  const opResult = interpretAivanaRequest('Plan a fishing operation from JNPA')
  assert.equal(opResult.intent, AIVANA_INTENTS.FISHING)
  assert.equal(opResult.requiresOperatingLocation, true)
  assert.equal(opResult.resolvedLocation.id, JNPA.id)
  assert.equal(opResult.status, 'READY')
})

// 6. Nearby ports discovery intent
test('6. Detects nearby ports discovery requests', () => {
  const result1 = interpretAivanaRequest('Show me nearby ports')
  assert.equal(result1.intent, AIVANA_INTENTS.NEARBY_PORTS)
  assert.equal(result1.requiresOperatingLocation, false)
  assert.equal(result1.status, 'READY')

  const result2 = interpretAivanaRequest('what ports are nearby')
  assert.equal(result2.intent, AIVANA_INTENTS.NEARBY_PORTS)
  assert.equal(result2.status, 'READY')
})

// 7. No silent fallback when location is denied or absent
test('7. No silent fallback to JNPA or Mumbai when location is denied or absent', () => {
  // Unanchored fishing request
  const unanchored = interpretAivanaRequest('Plan a fishing operation')
  assert.equal(unanchored.intent, AIVANA_INTENTS.FISHING)
  assert.equal(unanchored.requiresOperatingLocation, true)
  assert.equal(unanchored.resolvedLocation, null)
  assert.equal(unanchored.status, 'CLARIFICATION')
  // Must NOT default to JNPA or Mumbai
  assert.notEqual(unanchored.resolvedLocation?.id, JNPA.id)
  assert.notEqual(unanchored.resolvedLocation?.id, MUMBAI.id)
})

// 8. Explicit port selection by user
test('8. Explicit user selection ("Use JNPA") sets selectedOperatingLocation', () => {
  const result = interpretAivanaRequest('Use JNPA')
  assert.ok(result.resolvedLocation)
  assert.equal(result.resolvedLocation.id, JNPA.id)
  assert.equal(result.status, 'READY')

  const resultChennai = interpretAivanaRequest('Select Chennai')
  assert.ok(resultChennai.resolvedLocation)
  assert.equal(resultChennai.resolvedLocation.id, CHENNAI.id)
  assert.equal(resultChennai.status, 'READY')
})
