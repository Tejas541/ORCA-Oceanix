import express from 'express'
import { getIncoisOrcaDecision } from '../services/orcaAdapterEvidence.js'

function parseCoordinate(value) {
  if (value === undefined || value === '') return NaN
  return Number(value)
}

export function createOrcaRouter({
  getDecision = getIncoisOrcaDecision,
} = {}) {
  const router = express.Router()

  router.get('/incois', async (req, res) => {
    const latitude = parseCoordinate(req.query.lat ?? req.query.latitude)
    const longitude = parseCoordinate(req.query.lon ?? req.query.longitude)
    const time = req.query.time

    try {
      const result = await getDecision({
        latitude,
        longitude,
        time,
        ...(req.query.coordinateRole ? { coordinateRole: req.query.coordinateRole } : {}),
        ...(req.query.coordinatePolicy ? { coordinatePolicy: req.query.coordinatePolicy } : {}),
      })
      return res.json(result)
    } catch (error) {
      return res.status(error.status ?? 502).json({
        error: {
          code: error.code ?? 'INCOIS_REQUEST_FAILED',
          message: error.message,
          status: error.status ?? 502,
        },
      })
    }
  })

  return router
}

export default createOrcaRouter()
