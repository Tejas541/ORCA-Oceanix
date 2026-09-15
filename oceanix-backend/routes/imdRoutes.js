import express from 'express'
import { getSeaAreaBulletin } from '../services/imdService.js'

const router = express.Router()

router.get('/seabulletin', async (_req, res) => {
  const result = await getSeaAreaBulletin()
  if (result.status !== 'ok') {
    return res.status(result.error?.status ?? 503).json(result)
  }
  return res.json(result)
})

export default router
