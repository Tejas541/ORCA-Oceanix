import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findNearestMarineOperatingLocations,
  haversineDistanceKm,
} from './marineOperatingLocationProximity.js'

const locations = [
  {
    id: 'far',
    name: 'Far',
    latitude: 20,
    longitude: 80,
    status: 'operational',
  },
  {
    id: 'near',
    name: 'Near',
    latitude: 17.1,
    longitude: 83.1,
    status: 'operational',
  },
  {
    id: 'unresolved',
    name: 'Unresolved',
    latitude: null,
    longitude: null,
    status: 'unresolved_coordinates',
  },
  {
    id: 'inactive',
    name: 'Inactive',
    latitude: 17,
    longitude: 83,
    status: 'inactive',
  },
]

test('haversine distance is deterministic and geographic', () => {
  assert.ok(Math.abs(haversineDistanceKm(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 }
  ) - 111.195) < 0.01)
})

test('nearest search excludes unresolved and inactive records', () => {
  const result = findNearestMarineOperatingLocations(
    { latitude: 17, longitude: 83 },
    locations
  )

  assert.deepEqual(result.map((entry) => entry.location.id), ['near', 'far'])
  assert.ok(result[0].distanceKm < result[1].distanceKm)
})

test('nearest search applies a deterministic limit and tie-break', () => {
  const result = findNearestMarineOperatingLocations(
    { latitude: 17, longitude: 83 },
    [
      { id: 'b', name: 'B', latitude: 17, longitude: 83, status: 'unknown' },
      { id: 'a', name: 'A', latitude: 17, longitude: 83, status: 'unknown' },
    ],
    { limit: 1 }
  )

  assert.deepEqual(result.map((entry) => entry.location.id), ['a'])
})
