import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getBrowserLocationErrorMessage,
  requestBrowserLocation,
} from './browserGeolocation.js'

test('browser geolocation resolves explicit user coordinates', async () => {
  const coordinates = await requestBrowserLocation({
    geolocation: {
      getCurrentPosition(success) {
        success({ coords: { latitude: 17.1234, longitude: 83.5678 } })
      },
    },
  })

  assert.deepEqual(coordinates, { latitude: 17.1234, longitude: 83.5678 })
})

test('browser geolocation preserves permission errors', async () => {
  await assert.rejects(
    requestBrowserLocation({
      geolocation: {
        getCurrentPosition(_success, failure) {
          failure({ code: 1 })
        },
      },
    }),
    (error) => error.code === 1
  )
})

test('browser geolocation exposes explicit failure messages', () => {
  assert.equal(
    getBrowserLocationErrorMessage({ code: 1 }),
    'Location access is required to find nearby marine operating locations.'
  )
  assert.equal(
    getBrowserLocationErrorMessage({ code: 2 }),
    'Unable to determine your location.'
  )
  assert.equal(
    getBrowserLocationErrorMessage({ code: 3 }),
    'Location request timed out. Please try again.'
  )
})
