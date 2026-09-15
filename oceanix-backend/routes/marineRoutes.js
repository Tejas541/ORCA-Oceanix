import express from 'express'
import {
  getIncoisCatalogUrl,
  getMarineParameters,
} from '../services/incoisService.js'

const router = express.Router()

function parseCoordinate(value) {
  if (value === undefined || value === '') return NaN
  return Number(value)
}

router.get('/test', async (req, res) => {
  const latitude = parseCoordinate(req.query.lat ?? req.query.latitude)
  const longitude = parseCoordinate(req.query.lon ?? req.query.longitude)
  const time = req.query.time

  try {
    const result = await getMarineParameters({ latitude, longitude, time })
    if (result.status === 'unavailable') {
      return res.status(result.error?.status ?? 502).json(result)
    }
    return res.json(result)
  } catch (error) {
    return res.status(error.status ?? 502).json({
      isLive: false,
      status: 'unavailable',
      source: 'INCOIS ERDDAP',
      parameters: {},
      error: {
        code: error.code ?? 'INCOIS_REQUEST_FAILED',
        message: error.message,
        status: error.status ?? 502,
      },
    })
  }
})

router.get('/dataset-info-url', (_req, res) => {
  res.json({
    source: 'INCOIS ERDDAP',
    accessMethod: 'Public ERDDAP catalog discovery endpoint',
    sourceUrl: getIncoisCatalogUrl(),
  })
})

export default router
