import cors from 'cors'
import express from 'express'
import assistantRoutes from './routes/assistantRoutes.js'
import imdRoutes from './routes/imdRoutes.js'
import incoisRoutes from './routes/incoisRoutes.js'
import marineRoutes from './routes/marineRoutes.js'
import orcaRoutes from './routes/orcaRoutes.js'
import { fetchIncoisObservation } from './services/incoisService.js'

const app = express()
const PORT = Number(process.env.PORT ?? 4000)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ORCA backend',
  })
})

app.use('/api/marine', marineRoutes)
app.use('/api/assistant', assistantRoutes)
app.use('/api/incois', incoisRoutes)
app.use('/api/orca', orcaRoutes)
app.use('/api/imd', imdRoutes)

// Backward-compatible wind endpoint for the existing frontend helper.
app.get('/api/incois/wind', async (req, res) => {
  const result = await fetchIncoisObservation({
    latitude: Number(req.query.latitude),
    longitude: Number(req.query.longitude),
    time: req.query.time,
  })

  if (result.error) {
    return res.status(result.error.status ?? 502).json({
      error: 'Unable to retrieve INCOIS data',
      details: result.error.message,
      ...result,
    })
  }

  return res.json({
    ...result,
    variable: 'wind_speed',
    time: result.metadata.observationTime,
    depthM: result.metadata.depthMeters,
    windSpeedMps: result.parameters.windSpeed,
    unit: result.units.windSpeed,
    dataStatus: 'historical_external',
  })
})

app.listen(PORT, () => {
  console.log(`ORCA backend running at http://localhost:${PORT}`)
})
