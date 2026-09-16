import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatMarineOperatingLocationDistance,
  getOperatingLocationConnection,
  getNearbyMarineOperatingLocations,
  selectMarineOperatingLocation,
} from './marineOperatingLocationUi.js'

const locations = [
  { id: 'far', name: 'Far', latitude: 20, longitude: 80, status: 'operational' },
  { id: 'near', name: 'Near', latitude: 17.1, longitude: 83.1, status: 'operational' },
]

test('nearby operating locations use the existing proximity ordering and limit', () => {
  const results = getNearbyMarineOperatingLocations(
    { latitude: 17, longitude: 83 },
    locations,
    1
  )

  assert.deepEqual(results.map(({ location }) => location.id), ['near'])
})

test('nearby operating locations return no candidates without user coordinates', () => {
  assert.deepEqual(getNearbyMarineOperatingLocations(null, locations), [])
})

test('operating-location selection preserves user coordinates', () => {
  const userCoordinates = { latitude: 18.52, longitude: 73.85 }
  const selectedOperatingLocation = locations[0]
  const result = selectMarineOperatingLocation(
    { userCoordinates, selectedOperatingLocation: null },
    selectedOperatingLocation
  )

  assert.deepEqual(result.userCoordinates, userCoordinates)
  assert.equal(result.selectedOperatingLocation.id, 'far')
})

test('distance display is compact and readable', () => {
  assert.equal(formatMarineOperatingLocationDistance(0.85), '850 m')
  assert.equal(formatMarineOperatingLocationDistance(2.456), '2.5 km')
})

test('connection is absent without both endpoints and preserves both coordinates', () => {
  const userCoordinates = { latitude: 18.52, longitude: 73.85 }
  const operatingLocation = {
    id: 'port',
    latitude: 18.9,
    longitude: 72.86,
  }

  assert.equal(getOperatingLocationConnection(userCoordinates, null), null)
  assert.deepEqual(
    getOperatingLocationConnection(userCoordinates, operatingLocation),
    [[18.52, 73.85], [18.9, 72.86]]
  )
  assert.deepEqual(userCoordinates, { latitude: 18.52, longitude: 73.85 })
  assert.deepEqual(operatingLocation, {
    id: 'port',
    latitude: 18.9,
    longitude: 72.86,
  })
})
