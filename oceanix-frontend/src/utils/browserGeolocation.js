export function requestBrowserLocation({
  geolocation = globalThis.navigator?.geolocation,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
      reject({ code: 2 })
      return
    }

    geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}

export function getBrowserLocationErrorMessage(error) {
  if (error?.code === 1) {
    return 'Location access is required to find nearby marine operating locations.'
  }
  if (error?.code === 3) {
    return 'Location request timed out. Please try again.'
  }
  return 'Unable to determine your location.'
}
