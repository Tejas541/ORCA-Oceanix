import express from 'express'
import { fetchIncoisPfz } from '../services/incoisPfzService.js'

export function createIncoisRouter({
  getPfz = fetchIncoisPfz,
} = {}) {
  const router = express.Router()

  router.get('/pfz', async (_req, res) => {
    const result = await getPfz()
    return res.json(result)
  })

  return router
}

export default createIncoisRouter()
