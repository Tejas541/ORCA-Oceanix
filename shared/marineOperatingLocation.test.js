import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMarineOperatingLocation,
  dmsToDecimalDegrees,
  isMarineOperatingLocation,
} from './marineOperatingLocation.js'

test('DMS conversion is deterministic', () => {
  assert.equal(
    dmsToDecimalDegrees({
      degrees: 18,
      minutes: 54,
      hemisphere: 'N',
    }),
    18.9
  )
  assert.equal(
    dmsToDecimalDegrees({
      degrees: 72,
      minutes: 49,
      hemisphere: 'E',
    }),
    72.81666666666666
  )
})

test('canonical marine operating location accepts a coordinate-backed record', () => {
  const location = createMarineOperatingLocation({
    id: 'example-port',
    name: 'Example Port',
    type: 'major_port',
    latitude: 17.6868,
    longitude: 83.2185,
    state: 'Andhra Pradesh',
    district: 'Visakhapatnam',
    source: 'Example official port register',
    sourceVersion: '2024 register',
    sourceUrl: 'https://example.gov/ports/example-port',
    status: 'operational',
  })

  assert.equal(location.type, 'major_port')
  assert.equal(isMarineOperatingLocation(location), true)
})

test('unresolved official names may be represented without invented coordinates', () => {
  const location = createMarineOperatingLocation({
    id: 'unresolved-harbour',
    name: 'Unresolved Harbour',
    type: 'fishing_harbour',
    source: 'Department of Fisheries',
    sourceVersion: '2024 register',
    sourceUrl: 'https://dof.gov.in/',
    status: 'unresolved_coordinates',
  })

  assert.equal(location.latitude, null)
  assert.equal(location.longitude, null)
})

test('invalid coordinate-backed records are rejected', () => {
  assert.throws(
    () => createMarineOperatingLocation({
      id: 'bad-port',
      name: 'Bad Port',
      type: 'major_port',
      latitude: 91,
      longitude: 80,
      source: 'official',
      sourceVersion: '2024 register',
      sourceUrl: 'https://example.gov',
      status: 'operational',
    }),
    TypeError
  )
})
