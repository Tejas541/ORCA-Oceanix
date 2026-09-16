import test from 'node:test'
import assert from 'node:assert/strict'
import { isMarineOperatingLocation } from '../../../shared/marineOperatingLocation.js'
import { findNearestMarineOperatingLocations } from '../../../shared/marineOperatingLocationProximity.js'
import {
  MARINE_OPERATING_LOCATIONS,
  OFFICIAL_MARINE_LOCATION_SOURCES,
} from './marineOperatingLocations.js'

test('every imported major port has complete provenance', () => {
  assert.ok(MARINE_OPERATING_LOCATIONS.length > 0)
  for (const location of MARINE_OPERATING_LOCATIONS) {
    assert.equal(isMarineOperatingLocation(location), true)
    assert.equal(location.source, 'Ministry of Ports, Shipping and Waterways')
    assert.equal(location.sourceVersion, 'Basic Port Statistics of India 2024-25')
    assert.equal(
      location.sourceUrl,
      'https://shipmin.gov.in/en/content/basic-port-statistics-india-2024-25'
    )
  }
})

test('imported coordinates, types, IDs, and names are valid and unique', () => {
  const ids = new Set()
  const coordinateNames = new Set()

  for (const location of MARINE_OPERATING_LOCATIONS) {
    assert.ok(location.latitude >= -90 && location.latitude <= 90)
    assert.ok(location.longitude >= -180 && location.longitude <= 180)
    assert.equal(location.type, 'major_port')
    assert.equal(location.status, 'operational')
    assert.equal(ids.has(location.id), false)
    ids.add(location.id)

    const coordinateName = `${location.latitude}:${location.longitude}:${location.name}`
    assert.equal(coordinateNames.has(coordinateName), false)
    coordinateNames.add(coordinateName)
  }
})

test('every imported record is searchable by proximity', () => {
  for (const location of MARINE_OPERATING_LOCATIONS) {
    const result = findNearestMarineOperatingLocations(
      { latitude: location.latitude, longitude: location.longitude },
      MARINE_OPERATING_LOCATIONS,
      { limit: 1 }
    )
    assert.equal(result[0].location.id, location.id)
    assert.equal(result[0].distanceKm, 0)
  }
})

test('the searchable MVP contains no unresolved records', () => {
  assert.equal(
    MARINE_OPERATING_LOCATIONS.some((location) => (
      location.status === 'unresolved_coordinates' ||
      location.latitude === null ||
      location.longitude === null
    )),
    false
  )
})

test('MoPSW source registry identifies the exact coordinate-bearing publication', () => {
  const source = OFFICIAL_MARINE_LOCATION_SOURCES.find(
    (entry) => entry.id === 'mopsw-port-statistics'
  )
  assert.equal(source.sourceVersion, 'Basic Port Statistics of India 2024-25')
  assert.match(source.coordinateStatus, /verified/)
})
