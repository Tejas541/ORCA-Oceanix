import express from 'express'
import { fetchIncoisPfz } from '../services/incoisPfzService.js'
import { fetchIncoisWave } from '../services/incoisWaveService.js'
import { fetchIncoisWind } from '../services/incoisWindService.js'

function parseCoordinate(value) {
  if (value === undefined || value === '') return NaN
  return Number(value)
}

export function createIncoisRouter({
  getPfz = fetchIncoisPfz,
  getWave = fetchIncoisWave,
  getWind = fetchIncoisWind,
} = {}) {
  const router = express.Router()

  router.get('/pfz', async (req, res) => {
    const latitude = parseCoordinate(req.query.lat ?? req.query.latitude)
    const longitude = parseCoordinate(req.query.lon ?? req.query.longitude)
    const result = await getPfz({
      latitude,
      longitude,
      ...(req.query.coordinateRole ? { coordinateRole: req.query.coordinateRole } : {}),
      ...(req.query.coordinatePolicy ? { coordinatePolicy: req.query.coordinatePolicy } : {}),
    })
    return res.json(result)
  })

  router.get('/wave', async (req, res) => {
    const latitude = parseCoordinate(req.query.lat ?? req.query.latitude)
    const longitude = parseCoordinate(req.query.lon ?? req.query.longitude)

    try {
      const result = await getWave({
        latitude,
        longitude,
        ...(req.query.coordinateRole ? { coordinateRole: req.query.coordinateRole } : {}),
        ...(req.query.coordinatePolicy ? { coordinatePolicy: req.query.coordinatePolicy } : {}),
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

  router.get('/wind', async (req, res) => {
    const latitude = parseCoordinate(req.query.lat ?? req.query.latitude)
    const longitude = parseCoordinate(req.query.lon ?? req.query.longitude)

    try {
      const result = await getWind({
        latitude,
        longitude,
        ...(req.query.coordinateRole ? { coordinateRole: req.query.coordinateRole } : {}),
        ...(req.query.coordinatePolicy ? { coordinatePolicy: req.query.coordinatePolicy } : {}),
        time: req.query.time,
        timeStart: req.query.timeStart,
        timeEnd: req.query.timeEnd,
      })
      return res.json(result)
    } catch (error) {
      return res.status(error.status ?? 502).json({
        error: {
          code: error.code ?? 'INCOIS_WIND_REQUEST_FAILED',
          message: error.message,
          status: error.status ?? 502,
        },
      })
    }
  })

  return router
}

export default createIncoisRouter()
