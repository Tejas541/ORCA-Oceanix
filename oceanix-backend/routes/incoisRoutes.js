import express from 'express'
import { fetchIncoisPfz } from '../services/incoisPfzService.js'
import { fetchIncoisWave } from '../services/incoisWaveService.js'

function parseCoordinate(value) {
  if (value === undefined || value === '') return NaN
  return Number(value)
}

export function createIncoisRouter({
  getPfz = fetchIncoisPfz,
  getWave = fetchIncoisWave,
} = {}) {
  const router = express.Router()

  router.get('/pfz', async (_req, res) => {
    const result = await getPfz()
    return res.json(result)
  })

  router.get('/wave', async (req, res) => {
    const latitude = parseCoordinate(req.query.lat ?? req.query.latitude)
    const longitude = parseCoordinate(req.query.lon ?? req.query.longitude)

    try {
      const result = await getWave({
        latitude,
        longitude,
        time: req.query.time,
        timeStart: req.query.timeStart,
        timeEnd: req.query.timeEnd,
      })
      return res.json(result)
    } catch (error) {
      return res.status(error.status ?? 502).json({
        error: {
          code: error.code ?? 'INCOIS_WAVE_REQUEST_FAILED',
          message: error.message,
          status: error.status ?? 502,
        },
      })
    }
  })

  return router
}

export default createIncoisRouter()
