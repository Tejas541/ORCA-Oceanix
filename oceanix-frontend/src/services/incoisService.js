/**
 * INCOIS ERDDAP data service.
 *
 * Phase 1B:
 * - Calls the ORCA backend rather than INCOIS directly.
 * - The backend handles the external INCOIS ERDDAP request.
 * - Returns null on external-source failure so the demo remains usable.
 *
 * Current dataset:
 *   ascat_daily_datasets
 *
 * Important:
 *   This dataset ends in May 2023.
 *   It must NOT be presented as live/current data.
 */

const ORCA_BACKEND_BASE = 'http://localhost:4000'

const DEFAULT_TIME = '2023-05-21T12:00:00Z'

/**
 * Fetch a wind observation through the ORCA backend.
 *
 * @param {object} options
 * @param {number} options.latitude
 * @param {number} options.longitude
 * @param {string} [options.time]
 * @returns {Promise<object|null>}
 */
export async function fetchIncoisWindObservation({
                                                     latitude,
                                                     longitude,
                                                     time = DEFAULT_TIME,
                                                 }) {
    const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        time,
    })

    const url =
        `${ORCA_BACKEND_BASE}/api/incois/wind?${params.toString()}`

    try {
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(
                `ORCA backend returned HTTP ${response.status}`
            )
        }

        const data = await response.json()

        if (!Number.isFinite(Number(data?.windSpeedMps))) {
            throw new Error('INCOIS wind speed is not numeric')
        }

        return data
    } catch (error) {
        console.warn(
            '[INCOIS] External data unavailable:',
            error
        )

        return null
    }
}